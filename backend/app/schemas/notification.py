"""
Pydantic schemas for notification system.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, EmailStr

from app.models.notification import ChannelType, AlertSeverity, AlertStatus


# ============== Channel Schemas ==============

class NotificationChannelBase(BaseModel):
    """Base schema for notification channel."""
    name: str = Field(..., min_length=1, max_length=100)
    channel_type: ChannelType
    is_enabled: bool = True
    is_default: bool = False
    min_severity: AlertSeverity = AlertSeverity.WARNING


class EmailChannelConfig(BaseModel):
    """Configuration for email channel."""
    address: EmailStr


class TelegramChannelConfig(BaseModel):
    """Configuration for Telegram channel."""
    chat_id: str = Field(..., min_length=1)
    bot_token: Optional[str] = None  # Uses global if not set


class PushChannelConfig(BaseModel):
    """Configuration for push notification channel."""
    subscription: Dict[str, Any]


class WebhookChannelConfig(BaseModel):
    """Configuration for webhook channel."""
    url: str = Field(..., min_length=1)
    headers: Optional[Dict[str, str]] = None
    payload_template: Optional[str] = None


class NotificationChannelCreate(NotificationChannelBase):
    """Schema for creating a notification channel."""
    config: Dict[str, Any] = Field(default_factory=dict)


class NotificationChannelUpdate(BaseModel):
    """Schema for updating a notification channel."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_enabled: Optional[bool] = None
    is_default: Optional[bool] = None
    min_severity: Optional[AlertSeverity] = None
    config: Optional[Dict[str, Any]] = None


class NotificationChannelResponse(NotificationChannelBase):
    """Response schema for notification channel."""
    id: int
    config: Dict[str, Any]
    last_used_at: Optional[datetime] = None
    success_count: int = 0
    failure_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationChannelListItem(BaseModel):
    """List item schema for notification channel."""
    id: int
    name: str
    channel_type: ChannelType
    is_enabled: bool
    is_default: bool
    min_severity: AlertSeverity
    last_used_at: Optional[datetime] = None
    success_count: int = 0
    failure_count: int = 0

    class Config:
        from_attributes = True


# ============== Alert Rule Schemas ==============

class AlertRuleBase(BaseModel):
    """Base schema for alert rule."""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    is_enabled: bool = True
    rule_type: str = Field(..., min_length=1, max_length=50)
    server_id: Optional[int] = None
    source_config: Dict[str, Any] = Field(default_factory=dict)
    severity: AlertSeverity = AlertSeverity.WARNING
    cooldown_minutes: int = Field(default=15, ge=1, le=1440)
    channel_ids: List[int] = Field(default_factory=list)
    title_template: Optional[str] = Field(None, max_length=500)
    message_template: Optional[str] = None


class AlertRuleCreate(AlertRuleBase):
    """Schema for creating an alert rule."""
    pass


class AlertRuleUpdate(BaseModel):
    """Schema for updating an alert rule."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    server_id: Optional[int] = None
    source_config: Optional[Dict[str, Any]] = None
    severity: Optional[AlertSeverity] = None
    cooldown_minutes: Optional[int] = Field(None, ge=1, le=1440)
    channel_ids: Optional[List[int]] = None
    title_template: Optional[str] = Field(None, max_length=500)
    message_template: Optional[str] = None


class AlertRuleResponse(AlertRuleBase):
    """Response schema for alert rule."""
    id: int
    user_id: int
    last_triggered_at: Optional[datetime] = None
    trigger_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertRuleListItem(BaseModel):
    """List item schema for alert rule."""
    id: int
    name: str
    rule_type: str
    severity: AlertSeverity
    is_enabled: bool
    server_id: Optional[int] = None
    last_triggered_at: Optional[datetime] = None
    trigger_count: int = 0

    class Config:
        from_attributes = True


# ============== Alert Schemas ==============

class AlertResponse(BaseModel):
    """Response schema for an alert."""
    id: int
    rule_id: int
    user_id: int
    title: str
    message: str
    severity: AlertSeverity
    status: AlertStatus
    context: Dict[str, Any] = {}
    notifications_sent: List[Dict[str, Any]] = []
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AlertListItem(BaseModel):
    """List item schema for alert."""
    id: int
    title: str
    severity: AlertSeverity
    status: AlertStatus
    rule_name: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertAcknowledge(BaseModel):
    """Schema for acknowledging an alert."""
    pass


class AlertResolve(BaseModel):
    """Schema for resolving an alert."""
    resolution_note: Optional[str] = Field(None, max_length=1000)


# ============== Notification Log Schemas ==============

class NotificationLogResponse(BaseModel):
    """Response schema for notification log."""
    id: int
    channel_id: Optional[int] = None
    alert_id: Optional[int] = None
    channel_type: ChannelType
    recipient: str
    title: str
    message: str
    success: bool
    error_message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True


# ============== System Config Schemas ==============

class SMTPConfig(BaseModel):
    """SMTP configuration schema."""
    host: str = Field(..., min_length=1)
    port: int = Field(default=587, ge=1, le=65535)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    from_address: Optional[str] = None
    use_tls: bool = True
    start_tls: bool = True


class TelegramConfig(BaseModel):
    """Telegram bot configuration schema."""
    token: str = Field(..., min_length=1)


class TestNotificationRequest(BaseModel):
    """Request schema for testing a notification channel."""
    channel_id: int


class TestNotificationResponse(BaseModel):
    """Response schema for test notification result."""
    success: bool
    error_message: Optional[str] = None


# ============== Dashboard Stats ==============

class NotificationStats(BaseModel):
    """Statistics for notification dashboard."""
    total_channels: int = 0
    enabled_channels: int = 0
    total_rules: int = 0
    enabled_rules: int = 0
    active_alerts: int = 0
    alerts_today: int = 0
    notifications_sent_today: int = 0
    notifications_failed_today: int = 0


# ============== Rule Types ==============

RULE_TYPE_INFO = {
    "crowdsec_ban": {
        "name": "CrowdSec - IP Bannie",
        "description": "Alerte quand une IP est bannie par CrowdSec",
        "config_fields": [
            {"key": "container_name", "label": "Nom du conteneur", "type": "text", "default": "crowdsec"}
        ]
    },
    "server_down": {
        "name": "Serveur inaccessible",
        "description": "Alerte quand un serveur ne répond plus au ping SSH",
        "config_fields": []
    },
    "container_down": {
        "name": "Conteneur arrêté",
        "description": "Alerte quand un conteneur Docker s'arrête",
        "config_fields": [
            {"key": "container_name", "label": "Nom du conteneur", "type": "text", "required": True}
        ]
    },
    "threshold": {
        "name": "Seuil dépassé",
        "description": "Alerte quand une métrique dépasse un seuil",
        "config_fields": [
            {"key": "metric", "label": "Métrique", "type": "select", "options": ["cpu", "memory", "disk"]},
            {"key": "condition", "label": "Condition", "type": "select", "options": [">", "<", ">=", "<=", "=="]},
            {"key": "threshold", "label": "Seuil", "type": "number"}
        ]
    },
    "custom_command": {
        "name": "Commande personnalisée",
        "description": "Exécute une commande et vérifie la sortie",
        "config_fields": [
            {"key": "command", "label": "Commande", "type": "text", "required": True},
            {"key": "parser", "label": "Parser", "type": "select", "options": ["number", "boolean", "text"]},
            {"key": "condition", "label": "Condition", "type": "select", "options": [">", "<", ">=", "<=", "==", "contains", "not_contains"]},
            {"key": "threshold", "label": "Valeur attendue", "type": "text"}
        ]
    }
}


class RuleTypeInfo(BaseModel):
    """Information about a rule type."""
    key: str
    name: str
    description: str
    config_fields: List[Dict[str, Any]]
