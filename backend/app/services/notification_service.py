"""
Notification Service for sending alerts via multiple channels.
Supports: Email (SMTP), Telegram, Push notifications, Webhooks.
"""

import asyncio
import aiohttp
import aiosmtplib
import json
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.notification import (
    NotificationChannel, Alert, NotificationLog,
    ChannelType, AlertSeverity
)
from app.models.system_config import SystemConfig

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending notifications through various channels."""

    def __init__(self, db: Session):
        self.db = db
        self._smtp_config: Optional[Dict] = None
        self._telegram_config: Optional[Dict] = None

    async def _get_smtp_config(self) -> Optional[Dict]:
        """Get SMTP configuration from system config."""
        if self._smtp_config is not None:
            return self._smtp_config

        config = self.db.query(SystemConfig).filter(
            SystemConfig.key == "smtp_config"
        ).first()

        if config and config.value:
            self._smtp_config = config.value
            return self._smtp_config
        return None

    async def _get_telegram_bot_token(self) -> Optional[str]:
        """Get global Telegram bot token from system config."""
        config = self.db.query(SystemConfig).filter(
            SystemConfig.key == "telegram_bot_token"
        ).first()

        if config and config.value:
            return config.value.get("token")
        return None

    async def send_notification(
        self,
        channel: NotificationChannel,
        title: str,
        message: str,
        severity: AlertSeverity = AlertSeverity.INFO,
        alert_id: Optional[int] = None,
    ) -> bool:
        """
        Send a notification through a specific channel.

        Args:
            channel: The notification channel to use
            title: Notification title
            message: Notification body
            severity: Alert severity level
            alert_id: Optional alert ID for logging

        Returns:
            True if notification was sent successfully
        """
        success = False
        error_message = None
        recipient = ""

        try:
            if channel.channel_type == ChannelType.EMAIL:
                success, recipient = await self._send_email(channel, title, message, severity)
            elif channel.channel_type == ChannelType.TELEGRAM:
                success, recipient = await self._send_telegram(channel, title, message, severity)
            elif channel.channel_type == ChannelType.PUSH:
                success, recipient = await self._send_push(channel, title, message, severity)
            elif channel.channel_type == ChannelType.WEBHOOK:
                success, recipient = await self._send_webhook(channel, title, message, severity)
            else:
                error_message = f"Unknown channel type: {channel.channel_type}"

        except Exception as e:
            logger.error(f"Error sending notification via {channel.channel_type}: {e}")
            error_message = str(e)
            success = False

        # Update channel stats
        if success:
            channel.success_count += 1
        else:
            channel.failure_count += 1
        channel.last_used_at = datetime.utcnow()
        self.db.commit()

        # Log the notification
        log_entry = NotificationLog(
            channel_id=channel.id,
            alert_id=alert_id,
            user_id=channel.user_id,
            channel_type=channel.channel_type,
            recipient=recipient or "unknown",
            title=title,
            message=message,
            success=success,
            error_message=error_message,
        )
        self.db.add(log_entry)
        self.db.commit()

        return success

    async def _send_email(
        self,
        channel: NotificationChannel,
        title: str,
        message: str,
        severity: AlertSeverity,
    ) -> tuple[bool, str]:
        """Send notification via email."""
        config = channel.config
        recipient = config.get("address", "")

        if not recipient:
            raise ValueError("Email address not configured")

        smtp_config = await self._get_smtp_config()
        if not smtp_config:
            raise ValueError("SMTP not configured in system settings")

        # Build email
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{severity.value.upper()}] {title}"
        msg["From"] = smtp_config.get("from_address", smtp_config.get("username"))
        msg["To"] = recipient

        # Plain text version
        text_content = f"{title}\n\n{message}\n\n---\nDashboard Auto Alerts"

        # HTML version with severity styling
        severity_colors = {
            AlertSeverity.INFO: "#3498db",
            AlertSeverity.WARNING: "#f39c12",
            AlertSeverity.ERROR: "#e74c3c",
            AlertSeverity.CRITICAL: "#c0392b",
        }
        color = severity_colors.get(severity, "#3498db")

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {color}; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">{title}</h2>
                <small style="opacity: 0.8;">{severity.value.upper()}</small>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
                <p style="white-space: pre-wrap;">{message}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <small style="color: #666;">Dashboard Auto Alerts - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</small>
            </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Send via SMTP
        await aiosmtplib.send(
            msg,
            hostname=smtp_config.get("host", "localhost"),
            port=smtp_config.get("port", 587),
            username=smtp_config.get("username"),
            password=smtp_config.get("password"),
            use_tls=smtp_config.get("use_tls", True),
            start_tls=smtp_config.get("start_tls", True),
        )

        return True, recipient

    async def _send_telegram(
        self,
        channel: NotificationChannel,
        title: str,
        message: str,
        severity: AlertSeverity,
    ) -> tuple[bool, str]:
        """Send notification via Telegram."""
        config = channel.config
        chat_id = config.get("chat_id", "")

        if not chat_id:
            raise ValueError("Telegram chat_id not configured")

        # Use channel-specific bot token or global one
        bot_token = config.get("bot_token") or await self._get_telegram_bot_token()
        if not bot_token:
            raise ValueError("Telegram bot token not configured")

        # Format message with severity emoji
        severity_emojis = {
            AlertSeverity.INFO: "ℹ️",
            AlertSeverity.WARNING: "⚠️",
            AlertSeverity.ERROR: "❌",
            AlertSeverity.CRITICAL: "🚨",
        }
        emoji = severity_emojis.get(severity, "📢")

        text = f"{emoji} *{title}*\n\n{message}"

        # Send via Telegram API
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    error = await response.text()
                    raise ValueError(f"Telegram API error: {error}")
                return True, str(chat_id)

    async def _send_push(
        self,
        channel: NotificationChannel,
        title: str,
        message: str,
        severity: AlertSeverity,
    ) -> tuple[bool, str]:
        """Send web push notification."""
        config = channel.config
        subscription = config.get("subscription")

        if not subscription:
            raise ValueError("Push subscription not configured")

        # Get VAPID keys from system config
        vapid_config = self.db.query(SystemConfig).filter(
            SystemConfig.key == "vapid_keys"
        ).first()

        if not vapid_config or not vapid_config.value:
            raise ValueError("VAPID keys not configured for push notifications")

        # Web Push implementation would go here
        # For now, we'll use a placeholder
        # In production, use pywebpush library
        logger.warning("Push notifications not fully implemented yet")
        return False, "push"

    async def _send_webhook(
        self,
        channel: NotificationChannel,
        title: str,
        message: str,
        severity: AlertSeverity,
    ) -> tuple[bool, str]:
        """Send notification via webhook."""
        config = channel.config
        url = config.get("url", "")

        if not url:
            raise ValueError("Webhook URL not configured")

        headers = config.get("headers", {})
        headers["Content-Type"] = "application/json"

        payload = {
            "title": title,
            "message": message,
            "severity": severity.value,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "dashboard-auto",
        }

        # Support for custom payload template
        if config.get("payload_template"):
            try:
                template = config["payload_template"]
                payload = json.loads(
                    template
                    .replace("{{title}}", title)
                    .replace("{{message}}", message)
                    .replace("{{severity}}", severity.value)
                )
            except Exception as e:
                logger.warning(f"Error parsing webhook template: {e}")

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                if response.status >= 400:
                    error = await response.text()
                    raise ValueError(f"Webhook error ({response.status}): {error}")
                return True, url

    async def send_alert(
        self,
        alert: Alert,
        channels: List[NotificationChannel],
    ) -> Dict[int, bool]:
        """
        Send an alert to multiple channels.

        Args:
            alert: The alert to send
            channels: List of channels to send to

        Returns:
            Dict mapping channel_id to success status
        """
        results = {}

        for channel in channels:
            if not channel.is_enabled:
                continue

            # Check severity filter
            severity_order = [AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.ERROR, AlertSeverity.CRITICAL]
            if severity_order.index(alert.severity) < severity_order.index(channel.min_severity):
                continue

            try:
                success = await self.send_notification(
                    channel=channel,
                    title=alert.title,
                    message=alert.message,
                    severity=alert.severity,
                    alert_id=alert.id,
                )
                results[channel.id] = success
            except Exception as e:
                logger.error(f"Error sending alert {alert.id} to channel {channel.id}: {e}")
                results[channel.id] = False

        return results

    async def test_channel(
        self,
        channel: NotificationChannel,
    ) -> tuple[bool, str]:
        """
        Send a test notification to verify channel configuration.

        Returns:
            Tuple of (success, error_message)
        """
        try:
            success = await self.send_notification(
                channel=channel,
                title="🧪 Test de notification",
                message="Ceci est un test de notification depuis Dashboard Auto.\n\nSi vous recevez ce message, votre canal de notification est correctement configuré !",
                severity=AlertSeverity.INFO,
            )
            return success, "" if success else "Échec de l'envoi"
        except Exception as e:
            return False, str(e)


async def send_notification_async(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    severity: AlertSeverity = AlertSeverity.INFO,
    channel_types: Optional[List[ChannelType]] = None,
) -> Dict[int, bool]:
    """
    Helper function to send notifications to a user's configured channels.

    Args:
        db: Database session
        user_id: User ID
        title: Notification title
        message: Notification message
        severity: Alert severity
        channel_types: Optional filter for specific channel types

    Returns:
        Dict mapping channel_id to success status
    """
    service = NotificationService(db)

    # Get user's enabled channels
    query = db.query(NotificationChannel).filter(
        NotificationChannel.user_id == user_id,
        NotificationChannel.is_enabled == True,
    )

    if channel_types:
        query = query.filter(NotificationChannel.channel_type.in_(channel_types))

    channels = query.all()

    results = {}
    for channel in channels:
        try:
            success = await service.send_notification(
                channel=channel,
                title=title,
                message=message,
                severity=severity,
            )
            results[channel.id] = success
        except Exception as e:
            logger.error(f"Error sending to channel {channel.id}: {e}")
            results[channel.id] = False

    return results
