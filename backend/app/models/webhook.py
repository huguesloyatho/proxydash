"""
Webhook model for receiving external notifications.
"""

import secrets
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class WebhookEventType(str, enum.Enum):
    """Types of webhook events."""
    # Generic events
    GENERIC = "generic"

    # CI/CD
    GITHUB_PUSH = "github.push"
    GITHUB_PR = "github.pull_request"
    GITHUB_ISSUE = "github.issue"
    GITHUB_RELEASE = "github.release"
    GITLAB_PUSH = "gitlab.push"
    GITLAB_MR = "gitlab.merge_request"
    GITLAB_PIPELINE = "gitlab.pipeline"

    # Monitoring
    UPTIME_KUMA = "uptime_kuma"
    PROMETHEUS_ALERT = "prometheus.alert"
    GRAFANA_ALERT = "grafana.alert"
    HEALTHCHECKS = "healthchecks"

    # Infrastructure
    DOCKER_HUB = "docker_hub"
    PORTAINER = "portainer"

    # Custom
    CUSTOM = "custom"


class Webhook(Base):
    """
    Webhook configuration for receiving external notifications.
    Each webhook has a unique endpoint URL and optional secret for validation.
    """
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)

    # Basic info
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Unique token for the webhook URL (/api/webhooks/incoming/{token})
    token = Column(String(64), unique=True, nullable=False, index=True)

    # Optional secret for HMAC signature validation
    secret = Column(String(128), nullable=True)

    # Event filtering
    event_types = Column(JSON, default=list)  # List of WebhookEventType values to accept

    # Actions on receive
    create_alert = Column(Boolean, default=True)  # Create an alert when received
    alert_severity = Column(String(20), default="info")  # info, warning, error, critical
    forward_to_channels = Column(JSON, default=list)  # List of notification channel IDs

    # Payload transformation
    title_template = Column(String(500), nullable=True)  # Template for alert title
    message_template = Column(Text, nullable=True)  # Template for alert message

    # Status
    is_enabled = Column(Boolean, default=True)

    # Stats
    received_count = Column(Integer, default=0)
    last_received_at = Column(DateTime, nullable=True)

    # Ownership
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="webhooks")
    events = relationship("WebhookEvent", back_populates="webhook", cascade="all, delete-orphan")

    @staticmethod
    def generate_token() -> str:
        """Generate a secure random token for webhook URL."""
        return secrets.token_urlsafe(32)

    @staticmethod
    def generate_secret() -> str:
        """Generate a secure random secret for HMAC validation."""
        return secrets.token_hex(32)


class WebhookEvent(Base):
    """
    Log of received webhook events.
    Stores the raw payload and processing status.
    """
    __tablename__ = "webhook_events"

    id = Column(Integer, primary_key=True, index=True)

    # Link to webhook config
    webhook_id = Column(Integer, ForeignKey("webhooks.id", ondelete="CASCADE"), nullable=False, index=True)

    # Event details
    event_type = Column(String(50), nullable=True)  # Detected or specified event type
    source_ip = Column(String(45), nullable=True)

    # Raw data
    headers = Column(JSON, nullable=True)  # Relevant headers (stripped of sensitive data)
    payload = Column(JSON, nullable=True)  # Request body

    # Processing
    processed = Column(Boolean, default=False)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True)
    error_message = Column(Text, nullable=True)

    # Timestamps
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    webhook = relationship("Webhook", back_populates="events")


# Pre-configured webhook templates for common services
WEBHOOK_TEMPLATES = {
    "github": {
        "name": "GitHub",
        "description": "Receive GitHub repository events (push, pull requests, issues)",
        "event_types": [
            WebhookEventType.GITHUB_PUSH.value,
            WebhookEventType.GITHUB_PR.value,
            WebhookEventType.GITHUB_ISSUE.value,
            WebhookEventType.GITHUB_RELEASE.value,
        ],
        "title_template": "GitHub: {{event}} on {{repository.name}}",
        "message_template": "{{sender.login}} triggered {{event}} on {{repository.full_name}}\n\n{{action or ''}}",
        "signature_header": "X-Hub-Signature-256",
        "event_header": "X-GitHub-Event",
    },
    "gitlab": {
        "name": "GitLab",
        "description": "Receive GitLab repository events (push, merge requests, pipelines)",
        "event_types": [
            WebhookEventType.GITLAB_PUSH.value,
            WebhookEventType.GITLAB_MR.value,
            WebhookEventType.GITLAB_PIPELINE.value,
        ],
        "title_template": "GitLab: {{object_kind}} on {{project.name}}",
        "message_template": "{{user_name}} triggered {{object_kind}} on {{project.path_with_namespace}}",
        "signature_header": "X-Gitlab-Token",
        "event_header": "X-Gitlab-Event",
    },
    "uptime_kuma": {
        "name": "Uptime Kuma",
        "description": "Receive Uptime Kuma monitoring alerts",
        "event_types": [WebhookEventType.UPTIME_KUMA.value],
        "title_template": "{{monitor.name}}: {{msg}}",
        "message_template": "Monitor: {{monitor.name}}\nStatus: {{heartbeat.status}}\nMessage: {{msg}}",
        "signature_header": None,
        "event_header": None,
    },
    "prometheus": {
        "name": "Prometheus Alertmanager",
        "description": "Receive Prometheus/Alertmanager alerts",
        "event_types": [WebhookEventType.PROMETHEUS_ALERT.value],
        "title_template": "[{{status}}] {{labels.alertname}}",
        "message_template": "Alert: {{labels.alertname}}\nSeverity: {{labels.severity}}\nDescription: {{annotations.description}}",
        "signature_header": None,
        "event_header": None,
    },
    "grafana": {
        "name": "Grafana",
        "description": "Receive Grafana alerting notifications",
        "event_types": [WebhookEventType.GRAFANA_ALERT.value],
        "title_template": "[{{state}}] {{title}}",
        "message_template": "Alert: {{title}}\nState: {{state}}\nMessage: {{message}}",
        "signature_header": None,
        "event_header": None,
    },
    "healthchecks": {
        "name": "Healthchecks.io",
        "description": "Receive Healthchecks.io notifications",
        "event_types": [WebhookEventType.HEALTHCHECKS.value],
        "title_template": "Healthcheck: {{name}} is {{status}}",
        "message_template": "Check: {{name}}\nStatus: {{status}}\nLast ping: {{last_ping}}",
        "signature_header": None,
        "event_header": None,
    },
    "generic": {
        "name": "Generic Webhook",
        "description": "Receive generic JSON webhooks",
        "event_types": [WebhookEventType.GENERIC.value],
        "title_template": "Webhook received: {{title or 'Event'}}",
        "message_template": "{{message or payload}}",
        "signature_header": None,
        "event_header": None,
    },
}
