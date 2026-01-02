"""
Pydantic schemas for webhooks.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.webhook import WebhookEventType


# ============== Webhook Schemas ==============

class WebhookBase(BaseModel):
    """Base webhook schema."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    event_types: List[str] = Field(default_factory=list)
    create_alert: bool = True
    alert_severity: str = Field(default="info", pattern="^(info|warning|error|critical)$")
    forward_to_channels: List[int] = Field(default_factory=list)
    title_template: Optional[str] = None
    message_template: Optional[str] = None
    is_enabled: bool = True


class WebhookCreate(WebhookBase):
    """Schema for creating a webhook."""
    generate_secret: bool = True  # Whether to generate a secret for signature validation


class WebhookUpdate(BaseModel):
    """Schema for updating a webhook."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    event_types: Optional[List[str]] = None
    create_alert: Optional[bool] = None
    alert_severity: Optional[str] = Field(None, pattern="^(info|warning|error|critical)$")
    forward_to_channels: Optional[List[int]] = None
    title_template: Optional[str] = None
    message_template: Optional[str] = None
    is_enabled: Optional[bool] = None


class WebhookResponse(WebhookBase):
    """Schema for webhook response."""
    id: int
    token: str
    secret: Optional[str] = None  # Only shown on creation
    user_id: int
    received_count: int
    last_received_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Computed fields
    url: Optional[str] = None  # Full webhook URL

    class Config:
        from_attributes = True


class WebhookListResponse(BaseModel):
    """Schema for webhook list item (without secret)."""
    id: int
    name: str
    description: Optional[str] = None
    token: str
    event_types: List[str]
    is_enabled: bool
    received_count: int
    last_received_at: Optional[datetime] = None
    created_at: datetime

    # Computed fields
    url: Optional[str] = None  # Full webhook URL

    class Config:
        from_attributes = True


class WebhookWithSecret(WebhookResponse):
    """Schema for webhook response including secret (only on creation)."""
    secret: str


# ============== Webhook Event Schemas ==============

class WebhookEventResponse(BaseModel):
    """Schema for webhook event response."""
    id: int
    webhook_id: int
    event_type: Optional[str] = None
    source_ip: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    payload: Optional[Dict[str, Any]] = None
    processed: bool
    alert_id: Optional[int] = None
    error_message: Optional[str] = None
    received_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WebhookEventList(BaseModel):
    """Schema for paginated webhook events."""
    items: List[WebhookEventResponse]
    total: int
    page: int
    page_size: int


# ============== Template Schemas ==============

class WebhookTemplateResponse(BaseModel):
    """Schema for webhook template."""
    key: str
    name: str
    description: str
    event_types: List[str]
    title_template: str
    message_template: str
    signature_header: Optional[str] = None
    event_header: Optional[str] = None


# ============== Stats ==============

class WebhookStats(BaseModel):
    """Schema for webhook statistics."""
    total_webhooks: int
    active_webhooks: int
    total_events_received: int
    events_today: int
    events_this_week: int
    top_webhooks: List[Dict[str, Any]]  # [{name, received_count}]


# ============== Test Webhook ==============

class WebhookTestPayload(BaseModel):
    """Schema for testing webhook."""
    event_type: str = "generic"
    payload: Dict[str, Any] = Field(default_factory=dict)
