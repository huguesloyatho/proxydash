"""
Notification models for alerts and notifications.
Supports multiple channels: Email, Telegram, Push notifications.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class ChannelType(str, enum.Enum):
    """Supported notification channel types."""
    EMAIL = "email"
    TELEGRAM = "telegram"
    PUSH = "push"
    WEBHOOK = "webhook"


class AlertSeverity(str, enum.Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertStatus(str, enum.Enum):
    """Alert status."""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class NotificationChannel(Base):
    """
    Notification channel configuration.
    Each user can have multiple channels configured.
    """
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Channel info
    name = Column(String(100), nullable=False)  # e.g., "Mon Email", "Telegram perso"
    channel_type = Column(SQLEnum(ChannelType), nullable=False)
    is_enabled = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default channel for this type

    # Channel-specific configuration (encrypted sensitive data)
    config = Column(JSON, nullable=False, default=dict)
    # For email: {"address": "user@example.com"}
    # For telegram: {"chat_id": "123456789", "bot_token": "..."}
    # For push: {"subscription": {...}}
    # For webhook: {"url": "https://...", "headers": {...}}

    # Filtering options
    min_severity = Column(SQLEnum(AlertSeverity), default=AlertSeverity.WARNING)

    # Stats
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="notification_channels")


class AlertRule(Base):
    """
    Alert rules define conditions that trigger notifications.
    """
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Rule identification
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True)

    # Rule type and source
    rule_type = Column(String(50), nullable=False)
    # Types: "crowdsec_ban", "server_down", "container_down", "custom_command", "threshold"

    # Source configuration
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=True)
    source_config = Column(JSON, nullable=False, default=dict)
    # For crowdsec_ban: {"container_name": "crowdsec"}
    # For server_down: {} (uses server_id)
    # For container_down: {"container_name": "nginx"}
    # For custom_command: {"command": "...", "parser": "number", "condition": ">", "threshold": 90}
    # For threshold: {"metric": "cpu", "condition": ">", "threshold": 80}

    # Alert configuration
    severity = Column(SQLEnum(AlertSeverity), default=AlertSeverity.WARNING)
    cooldown_minutes = Column(Integer, default=15)  # Min time between alerts

    # Notification channels (list of channel IDs)
    channel_ids = Column(JSON, default=list)  # [1, 2, 3]

    # Message customization
    title_template = Column(String(500), nullable=True)
    message_template = Column(Text, nullable=True)

    # Stats
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    trigger_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="alert_rules")
    server = relationship("Server")
    alerts = relationship("Alert", back_populates="rule", cascade="all, delete-orphan")


class Alert(Base):
    """
    Individual alert instances triggered by rules.
    """
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Alert details
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(SQLEnum(AlertSeverity), nullable=False)
    status = Column(SQLEnum(AlertStatus), default=AlertStatus.ACTIVE)

    # Context data (for debugging and display)
    context = Column(JSON, default=dict)
    # e.g., {"ip": "1.2.3.4", "reason": "brute-force", "server": "prod-1"}

    # Notification tracking
    notifications_sent = Column(JSON, default=list)
    # [{"channel_id": 1, "sent_at": "...", "success": true}, ...]

    # Resolution
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    rule = relationship("AlertRule", back_populates="alerts")
    user = relationship("User", foreign_keys=[user_id])


class NotificationLog(Base):
    """
    Log of all notification attempts.
    """
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="SET NULL"), nullable=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Notification details
    channel_type = Column(SQLEnum(ChannelType), nullable=False)
    recipient = Column(String(500), nullable=False)  # email address, chat_id, etc.
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)

    # Status
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)

    # Timestamps
    sent_at = Column(DateTime(timezone=True), server_default=func.now())


# Default alert rule templates
DEFAULT_ALERT_RULES = [
    {
        "name": "CrowdSec - Nouvelle IP bannie",
        "rule_type": "crowdsec_ban",
        "severity": "warning",
        "source_config": {"container_name": "crowdsec"},
        "title_template": "🚫 IP Bannie: {{ip}}",
        "message_template": "L'IP {{ip}} a été bannie par CrowdSec.\n\nRaison: {{reason}}\nDurée: {{duration}}\nServeur: {{server_name}}"
    },
    {
        "name": "Serveur inaccessible",
        "rule_type": "server_down",
        "severity": "critical",
        "source_config": {},
        "title_template": "🔴 Serveur DOWN: {{server_name}}",
        "message_template": "Le serveur {{server_name}} ({{server_host}}) est inaccessible.\n\nDernière vérification: {{last_check}}"
    },
    {
        "name": "Conteneur arrêté",
        "rule_type": "container_down",
        "severity": "error",
        "source_config": {"container_name": ""},
        "title_template": "⚠️ Conteneur arrêté: {{container_name}}",
        "message_template": "Le conteneur {{container_name}} s'est arrêté sur {{server_name}}.\n\nStatut: {{status}}"
    }
]
