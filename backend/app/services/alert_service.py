"""
Alert Service for monitoring conditions and triggering notifications.
Monitors CrowdSec bans, server status, container health, and custom thresholds.
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Server
from app.models.notification import (
    AlertRule, Alert, NotificationChannel,
    AlertSeverity, AlertStatus
)
from app.services.notification_service import NotificationService
from app.services.command_executor import CommandExecutor

logger = logging.getLogger(__name__)


class AlertService:
    """Service for monitoring alert conditions and triggering notifications."""

    def __init__(self, db: Session):
        self.db = db
        self.notification_service = NotificationService(db)

    async def check_all_rules(self) -> Dict[str, int]:
        """
        Check all enabled alert rules.

        Returns:
            Dict with counts of checked, triggered, and failed rules
        """
        stats = {"checked": 0, "triggered": 0, "failed": 0}

        rules = self.db.query(AlertRule).filter(
            AlertRule.is_enabled == True
        ).all()

        for rule in rules:
            stats["checked"] += 1
            try:
                triggered = await self.check_rule(rule)
                if triggered:
                    stats["triggered"] += 1
            except Exception as e:
                logger.error(f"Error checking rule {rule.id} ({rule.name}): {e}")
                stats["failed"] += 1

        return stats

    async def check_rule(self, rule: AlertRule) -> bool:
        """
        Check a single alert rule and trigger alert if condition is met.

        Returns:
            True if alert was triggered
        """
        # Check cooldown
        if rule.last_triggered_at:
            cooldown_end = rule.last_triggered_at + timedelta(minutes=rule.cooldown_minutes)
            if datetime.utcnow() < cooldown_end:
                return False

        # Check based on rule type
        triggered = False
        context = {}

        if rule.rule_type == "crowdsec_ban":
            triggered, context = await self._check_crowdsec_ban(rule)
        elif rule.rule_type == "server_down":
            triggered, context = await self._check_server_down(rule)
        elif rule.rule_type == "container_down":
            triggered, context = await self._check_container_down(rule)
        elif rule.rule_type == "threshold":
            triggered, context = await self._check_threshold(rule)
        elif rule.rule_type == "custom_command":
            triggered, context = await self._check_custom_command(rule)
        else:
            logger.warning(f"Unknown rule type: {rule.rule_type}")
            return False

        if triggered:
            await self._trigger_alert(rule, context)
            return True

        return False

    async def _check_crowdsec_ban(self, rule: AlertRule) -> tuple[bool, Dict]:
        """Check for new CrowdSec bans."""
        if not rule.server_id:
            return False, {}

        server = self.db.query(Server).filter(Server.id == rule.server_id).first()
        if not server:
            return False, {}

        container_name = rule.source_config.get("container_name", "crowdsec")

        try:
            executor = CommandExecutor(
                host=server.host,
                ssh_port=server.ssh_port,
                ssh_user=server.ssh_user,
                ssh_key=server.ssh_key or "",
                ssh_password=server.ssh_password or "",
            )

            # Get recent decisions (last 5 minutes)
            command = f"docker exec {container_name} cscli decisions list -o json 2>/dev/null || echo '[]'"
            result = await executor.execute(command, parser="json", validate=False)
            await executor.close()

            if not result.success or not result.output:
                return False, {}

            decisions = result.output if isinstance(result.output, list) else []

            # Check for decisions in last check interval (e.g., last 5 minutes)
            check_interval = timedelta(minutes=5)
            now = datetime.utcnow()

            for decision in decisions:
                try:
                    # CrowdSec returns decisions with created_at field
                    created_at_str = decision.get("created_at") or decision.get("timestamp")
                    if not created_at_str:
                        continue

                    # Parse ISO format date
                    created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00").replace("+00:00", ""))

                    if now - created_at < check_interval:
                        # Found a recent ban
                        source = decision.get("source", {})
                        ip = source.get("ip") or decision.get("value", "unknown")
                        reason = decision.get("scenario", "unknown")
                        duration = decision.get("duration", "unknown")

                        return True, {
                            "ip": ip,
                            "reason": reason,
                            "duration": duration,
                            "server_name": server.name,
                            "server_host": server.host,
                        }
                except Exception as e:
                    logger.debug(f"Error parsing decision: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error checking CrowdSec on {server.name}: {e}")

        return False, {}

    async def _check_server_down(self, rule: AlertRule) -> tuple[bool, Dict]:
        """Check if a server is down (SSH unreachable)."""
        if not rule.server_id:
            return False, {}

        server = self.db.query(Server).filter(Server.id == rule.server_id).first()
        if not server:
            return False, {}

        try:
            executor = CommandExecutor(
                host=server.host,
                ssh_port=server.ssh_port,
                ssh_user=server.ssh_user,
                ssh_key=server.ssh_key or "",
                ssh_password=server.ssh_password or "",
            )

            # Simple connectivity check
            result = await executor.execute("echo ok", timeout=10.0, validate=False)
            await executor.close()

            if result.success:
                return False, {}  # Server is up

            return True, {
                "server_name": server.name,
                "server_host": server.host,
                "last_check": datetime.utcnow().isoformat(),
                "error": result.error or "Connection failed",
            }

        except Exception as e:
            return True, {
                "server_name": server.name,
                "server_host": server.host,
                "last_check": datetime.utcnow().isoformat(),
                "error": str(e),
            }

    async def _check_container_down(self, rule: AlertRule) -> tuple[bool, Dict]:
        """Check if a container is stopped."""
        if not rule.server_id:
            return False, {}

        server = self.db.query(Server).filter(Server.id == rule.server_id).first()
        if not server:
            return False, {}

        container_name = rule.source_config.get("container_name")
        if not container_name:
            return False, {}

        try:
            executor = CommandExecutor(
                host=server.host,
                ssh_port=server.ssh_port,
                ssh_user=server.ssh_user,
                ssh_key=server.ssh_key or "",
                ssh_password=server.ssh_password or "",
            )

            # Check container status
            command = f"docker inspect --format '{{{{.State.Status}}}}' {container_name} 2>/dev/null || echo 'not_found'"
            result = await executor.execute(command, validate=False)
            await executor.close()

            if not result.success:
                return True, {
                    "container_name": container_name,
                    "server_name": server.name,
                    "status": "error",
                    "error": result.error,
                }

            status = result.output.strip() if result.output else "unknown"

            if status not in ["running", "restarting"]:
                return True, {
                    "container_name": container_name,
                    "server_name": server.name,
                    "status": status,
                }

        except Exception as e:
            logger.error(f"Error checking container {container_name} on {server.name}: {e}")

        return False, {}

    async def _check_threshold(self, rule: AlertRule) -> tuple[bool, Dict]:
        """Check if a metric exceeds a threshold."""
        if not rule.server_id:
            return False, {}

        server = self.db.query(Server).filter(Server.id == rule.server_id).first()
        if not server:
            return False, {}

        metric = rule.source_config.get("metric", "cpu")
        condition = rule.source_config.get("condition", ">")
        threshold = float(rule.source_config.get("threshold", 80))

        try:
            executor = CommandExecutor(
                host=server.host,
                ssh_port=server.ssh_port,
                ssh_user=server.ssh_user,
                ssh_key=server.ssh_key or "",
                ssh_password=server.ssh_password or "",
            )

            # Get metric value
            if metric == "cpu":
                command = "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"
            elif metric == "memory":
                command = "free | grep Mem | awk '{print $3/$2 * 100.0}'"
            elif metric == "disk":
                command = "df / | tail -1 | awk '{print $5}' | tr -d '%'"
            else:
                return False, {}

            result = await executor.execute(command, parser="number", validate=False)
            await executor.close()

            if not result.success:
                return False, {}

            value = float(result.output) if result.output else 0

            # Check condition
            triggered = False
            if condition == ">" and value > threshold:
                triggered = True
            elif condition == ">=" and value >= threshold:
                triggered = True
            elif condition == "<" and value < threshold:
                triggered = True
            elif condition == "<=" and value <= threshold:
                triggered = True
            elif condition == "==" and value == threshold:
                triggered = True

            if triggered:
                return True, {
                    "metric": metric,
                    "value": value,
                    "threshold": threshold,
                    "condition": condition,
                    "server_name": server.name,
                }

        except Exception as e:
            logger.error(f"Error checking threshold on {server.name}: {e}")

        return False, {}

    async def _check_custom_command(self, rule: AlertRule) -> tuple[bool, Dict]:
        """Check a custom command output."""
        if not rule.server_id:
            return False, {}

        server = self.db.query(Server).filter(Server.id == rule.server_id).first()
        if not server:
            return False, {}

        command = rule.source_config.get("command")
        if not command:
            return False, {}

        parser = rule.source_config.get("parser", "text")
        condition = rule.source_config.get("condition", "==")
        expected = rule.source_config.get("threshold", "")

        try:
            executor = CommandExecutor(
                host=server.host,
                ssh_port=server.ssh_port,
                ssh_user=server.ssh_user,
                ssh_key=server.ssh_key or "",
                ssh_password=server.ssh_password or "",
            )

            result = await executor.execute(command, parser=parser, validate=False)
            await executor.close()

            if not result.success:
                return False, {}

            value = result.output

            # Check condition based on parser type
            triggered = False
            if parser == "number":
                value = float(value) if value else 0
                expected_num = float(expected) if expected else 0

                if condition == ">" and value > expected_num:
                    triggered = True
                elif condition == ">=" and value >= expected_num:
                    triggered = True
                elif condition == "<" and value < expected_num:
                    triggered = True
                elif condition == "<=" and value <= expected_num:
                    triggered = True
                elif condition == "==" and value == expected_num:
                    triggered = True

            elif parser == "boolean":
                value_bool = str(value).lower() in ["true", "1", "yes"]
                expected_bool = str(expected).lower() in ["true", "1", "yes"]
                triggered = value_bool == expected_bool

            else:  # text
                value_str = str(value)
                if condition == "contains":
                    triggered = expected in value_str
                elif condition == "not_contains":
                    triggered = expected not in value_str
                elif condition == "==":
                    triggered = value_str.strip() == expected.strip()

            if triggered:
                return True, {
                    "command": command[:100],
                    "value": str(value)[:200],
                    "expected": expected,
                    "condition": condition,
                    "server_name": server.name,
                }

        except Exception as e:
            logger.error(f"Error running custom command on {server.name}: {e}")

        return False, {}

    async def _trigger_alert(self, rule: AlertRule, context: Dict) -> Alert:
        """Create an alert and send notifications."""
        # Build title and message from templates
        title = rule.title_template or f"Alert: {rule.name}"
        message = rule.message_template or f"Rule '{rule.name}' triggered"

        # Substitute context variables
        for key, value in context.items():
            title = title.replace(f"{{{{{key}}}}}", str(value))
            message = message.replace(f"{{{{{key}}}}}", str(value))

        # Create alert
        alert = Alert(
            rule_id=rule.id,
            user_id=rule.user_id,
            title=title,
            message=message,
            severity=rule.severity,
            status=AlertStatus.ACTIVE,
            context=context,
        )
        self.db.add(alert)

        # Update rule stats
        rule.last_triggered_at = datetime.utcnow()
        rule.trigger_count += 1

        self.db.commit()
        self.db.refresh(alert)

        # Get notification channels
        if rule.channel_ids:
            channels = self.db.query(NotificationChannel).filter(
                NotificationChannel.id.in_(rule.channel_ids),
                NotificationChannel.is_enabled == True,
            ).all()

            # Send notifications
            results = await self.notification_service.send_alert(alert, channels)

            # Update alert with notification results
            notifications_sent = []
            for channel_id, success in results.items():
                notifications_sent.append({
                    "channel_id": channel_id,
                    "sent_at": datetime.utcnow().isoformat(),
                    "success": success,
                })
            alert.notifications_sent = notifications_sent
            self.db.commit()

        logger.info(f"Alert triggered: {alert.title} (rule: {rule.name})")
        return alert


# Background task for periodic alert checking
async def run_alert_check():
    """Background task to check all alert rules periodically."""
    db = SessionLocal()
    try:
        service = AlertService(db)
        stats = await service.check_all_rules()
        logger.info(f"Alert check completed: {stats}")
    except Exception as e:
        logger.error(f"Alert check failed: {e}")
    finally:
        db.close()


# Manual alert trigger (for testing or manual notifications)
async def trigger_manual_alert(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    severity: AlertSeverity = AlertSeverity.INFO,
    channel_ids: Optional[List[int]] = None,
) -> Alert:
    """
    Trigger a manual alert for a user.

    Args:
        db: Database session
        user_id: User ID
        title: Alert title
        message: Alert message
        severity: Alert severity
        channel_ids: Specific channels to use (or None for all enabled)

    Returns:
        Created Alert object
    """
    # Create a temporary rule-less alert
    alert = Alert(
        rule_id=None,  # No rule associated
        user_id=user_id,
        title=title,
        message=message,
        severity=severity,
        status=AlertStatus.ACTIVE,
        context={"manual": True},
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Get channels
    query = db.query(NotificationChannel).filter(
        NotificationChannel.user_id == user_id,
        NotificationChannel.is_enabled == True,
    )

    if channel_ids:
        query = query.filter(NotificationChannel.id.in_(channel_ids))

    channels = query.all()

    # Send notifications
    service = NotificationService(db)
    results = await service.send_alert(alert, channels)

    # Update alert
    notifications_sent = []
    for channel_id, success in results.items():
        notifications_sent.append({
            "channel_id": channel_id,
            "sent_at": datetime.utcnow().isoformat(),
            "success": success,
        })
    alert.notifications_sent = notifications_sent
    db.commit()

    return alert
