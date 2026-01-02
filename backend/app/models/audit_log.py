"""
Audit Log model for tracking user actions.
"""

import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditAction(str, enum.Enum):
    """Types of auditable actions."""
    # Auth
    LOGIN = "login"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    TWO_FA_ENABLED = "2fa_enabled"
    TWO_FA_DISABLED = "2fa_disabled"

    # User management
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    USER_APPROVED = "user_approved"

    # Applications
    APP_CREATED = "app_created"
    APP_UPDATED = "app_updated"
    APP_DELETED = "app_deleted"

    # Servers
    SERVER_CREATED = "server_created"
    SERVER_UPDATED = "server_updated"
    SERVER_DELETED = "server_deleted"

    # NPM Instances
    NPM_CREATED = "npm_created"
    NPM_UPDATED = "npm_updated"
    NPM_DELETED = "npm_deleted"

    # Notifications
    CHANNEL_CREATED = "channel_created"
    CHANNEL_UPDATED = "channel_updated"
    CHANNEL_DELETED = "channel_deleted"
    RULE_CREATED = "rule_created"
    RULE_UPDATED = "rule_updated"
    RULE_DELETED = "rule_deleted"

    # Sessions
    SESSION_REVOKED = "session_revoked"
    ALL_SESSIONS_REVOKED = "all_sessions_revoked"

    # Config
    CONFIG_EXPORTED = "config_exported"
    CONFIG_IMPORTED = "config_imported"

    # Webhooks
    WEBHOOK_CREATED = "webhook_created"
    WEBHOOK_UPDATED = "webhook_updated"
    WEBHOOK_DELETED = "webhook_deleted"

    # Other
    SYNC_TRIGGERED = "sync_triggered"
    SETTINGS_CHANGED = "settings_changed"


class AuditLog(Base):
    """Model for audit logs."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(Enum(AuditAction), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)  # user, server, app, etc.
    resource_id = Column(Integer, nullable=True)
    resource_name = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)  # Additional context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", backref="audit_logs")

    def __repr__(self):
        return f"<AuditLog {self.id}: {self.action} by user {self.user_id}>"
