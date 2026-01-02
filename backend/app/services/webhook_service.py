"""
Webhook Service for processing incoming webhooks.
"""

import hashlib
import hmac
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.webhook import Webhook, WebhookEvent, WebhookEventType, WEBHOOK_TEMPLATES
from app.models.notification import Alert, AlertSeverity, AlertStatus
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for processing incoming webhooks."""

    def __init__(self, db: Session):
        self.db = db

    def get_webhook_by_token(self, token: str) -> Optional[Webhook]:
        """Get webhook configuration by token."""
        return self.db.query(Webhook).filter(
            Webhook.token == token,
            Webhook.is_enabled == True,
        ).first()

    def verify_signature(
        self,
        webhook: Webhook,
        payload: bytes,
        signature: str,
        signature_type: str = "sha256"
    ) -> bool:
        """
        Verify webhook signature using HMAC.

        Args:
            webhook: Webhook configuration
            payload: Raw request body
            signature: Signature from header
            signature_type: Hash algorithm (sha1, sha256)

        Returns:
            True if signature is valid
        """
        if not webhook.secret:
            return True  # No secret configured, skip validation

        if not signature:
            logger.warning(f"Webhook {webhook.id}: Missing signature")
            return False

        # Handle different signature formats (e.g., "sha256=xxx" or just "xxx")
        if "=" in signature:
            sig_type, sig_value = signature.split("=", 1)
            signature_type = sig_type
            signature = sig_value
        else:
            sig_value = signature

        # Compute expected signature
        if signature_type == "sha256":
            expected = hmac.new(
                webhook.secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
        elif signature_type == "sha1":
            expected = hmac.new(
                webhook.secret.encode(),
                payload,
                hashlib.sha1
            ).hexdigest()
        else:
            logger.warning(f"Webhook {webhook.id}: Unknown signature type {signature_type}")
            return False

        return hmac.compare_digest(expected, sig_value)

    def detect_event_type(
        self,
        webhook: Webhook,
        headers: Dict[str, str],
        payload: Dict[str, Any]
    ) -> str:
        """
        Detect the event type from headers or payload.

        Args:
            webhook: Webhook configuration
            headers: Request headers
            payload: Request body

        Returns:
            Detected event type string
        """
        # Check GitHub
        if "x-github-event" in headers:
            event = headers["x-github-event"]
            event_mapping = {
                "push": WebhookEventType.GITHUB_PUSH.value,
                "pull_request": WebhookEventType.GITHUB_PR.value,
                "issues": WebhookEventType.GITHUB_ISSUE.value,
                "release": WebhookEventType.GITHUB_RELEASE.value,
            }
            return event_mapping.get(event, f"github.{event}")

        # Check GitLab
        if "x-gitlab-event" in headers:
            event = headers["x-gitlab-event"].lower()
            if "push" in event:
                return WebhookEventType.GITLAB_PUSH.value
            elif "merge" in event:
                return WebhookEventType.GITLAB_MR.value
            elif "pipeline" in event:
                return WebhookEventType.GITLAB_PIPELINE.value
            return f"gitlab.{event.replace(' ', '_')}"

        # Check Uptime Kuma (by payload structure)
        if "monitor" in payload and "heartbeat" in payload:
            return WebhookEventType.UPTIME_KUMA.value

        # Check Prometheus/Alertmanager
        if "alerts" in payload and isinstance(payload.get("alerts"), list):
            return WebhookEventType.PROMETHEUS_ALERT.value

        # Check Grafana
        if "state" in payload and "title" in payload and "ruleId" in payload:
            return WebhookEventType.GRAFANA_ALERT.value

        # Check Healthchecks
        if "check" in payload and "last_ping" in payload.get("check", {}):
            return WebhookEventType.HEALTHCHECKS.value

        return WebhookEventType.GENERIC.value

    def render_template(self, template: str, data: Dict[str, Any]) -> str:
        """
        Render a template string with data.
        Supports {{variable}} and {{nested.variable}} syntax.

        Args:
            template: Template string
            data: Data dictionary

        Returns:
            Rendered string
        """
        if not template:
            return ""

        def get_nested_value(obj: Any, path: str) -> Any:
            """Get value from nested dict using dot notation."""
            parts = path.split(".")
            current = obj
            for part in parts:
                if isinstance(current, dict):
                    current = current.get(part, "")
                else:
                    return ""
            return current if current is not None else ""

        def replace_var(match):
            expr = match.group(1).strip()
            # Handle "or" expressions: {{var or 'default'}}
            if " or " in expr:
                var, default = expr.split(" or ", 1)
                var = var.strip()
                default = default.strip().strip("'\"")
                value = get_nested_value(data, var)
                return str(value) if value else default
            return str(get_nested_value(data, expr))

        pattern = r"\{\{([^}]+)\}\}"
        return re.sub(pattern, replace_var, template)

    async def process_webhook(
        self,
        webhook: Webhook,
        headers: Dict[str, str],
        payload: Dict[str, Any],
        source_ip: Optional[str] = None,
        raw_body: bytes = b"",
    ) -> Tuple[WebhookEvent, Optional[Alert]]:
        """
        Process an incoming webhook.

        Args:
            webhook: Webhook configuration
            headers: Request headers (lowercase keys)
            payload: Parsed JSON payload
            source_ip: Client IP address
            raw_body: Raw request body for signature verification

        Returns:
            Tuple of (WebhookEvent, Alert or None)
        """
        alert = None
        error_message = None

        # Detect event type
        event_type = self.detect_event_type(webhook, headers, payload)

        # Filter relevant headers
        relevant_headers = {
            k: v for k, v in headers.items()
            if k.startswith(("x-", "content-")) and "authorization" not in k.lower()
        }

        # Create event record
        event = WebhookEvent(
            webhook_id=webhook.id,
            event_type=event_type,
            source_ip=source_ip,
            headers=relevant_headers,
            payload=payload,
            processed=False,
        )
        self.db.add(event)

        try:
            # Check if event type is allowed
            if webhook.event_types and event_type not in webhook.event_types:
                # Event type not in allowed list, but still log it
                if WebhookEventType.GENERIC.value not in webhook.event_types:
                    error_message = f"Event type '{event_type}' not in allowed types"
                    event.error_message = error_message
                    event.processed = True
                    event.processed_at = datetime.utcnow()
                    self.db.commit()
                    return event, None

            # Prepare template data
            template_data = {
                "event": event_type,
                "event_type": event_type,
                "source_ip": source_ip,
                "webhook_name": webhook.name,
                **payload,
            }

            # Create alert if configured
            if webhook.create_alert:
                # Render title and message
                title = self.render_template(
                    webhook.title_template or "Webhook: {{webhook_name}}",
                    template_data
                )
                message = self.render_template(
                    webhook.message_template or "Received {{event_type}} event",
                    template_data
                )

                # Map severity
                severity_map = {
                    "info": AlertSeverity.INFO,
                    "warning": AlertSeverity.WARNING,
                    "error": AlertSeverity.ERROR,
                    "critical": AlertSeverity.CRITICAL,
                }
                severity = severity_map.get(webhook.alert_severity, AlertSeverity.INFO)

                # Create alert
                alert = Alert(
                    rule_id=None,  # No rule, webhook-triggered
                    title=title[:500],  # Limit title length
                    message=message,
                    severity=severity,
                    status=AlertStatus.ACTIVE,
                    source=f"webhook:{webhook.name}",
                    context={
                        "webhook_id": webhook.id,
                        "webhook_name": webhook.name,
                        "event_type": event_type,
                        "source_ip": source_ip,
                    },
                )
                self.db.add(alert)
                self.db.flush()  # Get alert ID

                event.alert_id = alert.id

                # Forward to notification channels if configured
                if webhook.forward_to_channels:
                    notification_service = NotificationService(self.db)
                    await notification_service.send_alert_to_channels(
                        alert,
                        webhook.forward_to_channels
                    )

            # Mark as processed
            event.processed = True
            event.processed_at = datetime.utcnow()

            # Update webhook stats
            webhook.received_count += 1
            webhook.last_received_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Error processing webhook {webhook.id}: {e}")
            event.error_message = str(e)
            event.processed = True
            event.processed_at = datetime.utcnow()

        self.db.commit()
        return event, alert

    def get_templates(self) -> Dict[str, Any]:
        """Get available webhook templates."""
        return WEBHOOK_TEMPLATES

    def get_event_types(self) -> List[Dict[str, str]]:
        """Get all available event types."""
        return [
            {"value": e.value, "label": e.value.replace(".", " ").replace("_", " ").title()}
            for e in WebhookEventType
        ]
