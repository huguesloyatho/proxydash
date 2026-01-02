"""
Pydantic schemas for security features (audit logs, sessions, backup).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.audit_log import AuditAction


# ============== Audit Log Schemas ==============

class AuditLogResponse(BaseModel):
    """Response schema for audit log entry."""
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: AuditAction
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    resource_name: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListParams(BaseModel):
    """Query parameters for listing audit logs."""
    user_id: Optional[int] = None
    action: Optional[AuditAction] = None
    resource_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class AuditStats(BaseModel):
    """Statistics for audit logs."""
    total_entries: int
    entries_today: int
    entries_this_week: int
    top_actions: List[Dict[str, Any]]
    top_users: List[Dict[str, Any]]


# ============== Session Schemas ==============

class UserSessionResponse(BaseModel):
    """Response schema for user session."""
    id: int
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    is_current: bool = False
    last_activity: datetime
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class SessionRevokeRequest(BaseModel):
    """Request to revoke a session."""
    session_id: int


class SessionRevokeAllRequest(BaseModel):
    """Request to revoke all sessions except current."""
    keep_current: bool = True


class SessionRevokeResponse(BaseModel):
    """Response for session revocation."""
    success: bool
    revoked_count: int = 0
    message: str


# ============== Backup/Export Schemas ==============

class BackupConfig(BaseModel):
    """Configuration for what to include in backup."""
    include_applications: bool = True
    include_categories: bool = True
    include_widgets: bool = True
    include_tabs: bool = True
    include_servers: bool = True
    include_npm_instances: bool = True
    include_notification_channels: bool = True
    include_alert_rules: bool = True
    include_templates: bool = True
    include_user_settings: bool = True


class BackupMetadata(BaseModel):
    """Metadata for a backup file."""
    version: str = "1.0"
    created_at: datetime
    created_by: str
    app_version: str = "1.0.0"
    items_count: Dict[str, int]


class BackupData(BaseModel):
    """Full backup data structure."""
    metadata: BackupMetadata
    applications: Optional[List[Dict[str, Any]]] = None
    categories: Optional[List[Dict[str, Any]]] = None
    widgets: Optional[List[Dict[str, Any]]] = None
    tabs: Optional[List[Dict[str, Any]]] = None
    servers: Optional[List[Dict[str, Any]]] = None
    npm_instances: Optional[List[Dict[str, Any]]] = None
    notification_channels: Optional[List[Dict[str, Any]]] = None
    alert_rules: Optional[List[Dict[str, Any]]] = None
    templates: Optional[List[Dict[str, Any]]] = None


class ImportResult(BaseModel):
    """Result of importing a backup."""
    success: bool
    message: str
    imported_counts: Dict[str, int]
    errors: List[str] = []
    warnings: List[str] = []


# ============== 2FA Schemas ==============

class TwoFASetupResponse(BaseModel):
    """Response for 2FA setup."""
    secret: str
    qr_code: str  # Base64 encoded PNG
    backup_codes: List[str]


class TwoFAVerifyRequest(BaseModel):
    """Request to verify 2FA setup."""
    code: str = Field(..., min_length=6, max_length=6)


class TwoFADisableRequest(BaseModel):
    """Request to disable 2FA."""
    code: str = Field(..., min_length=6, max_length=6)


class RecoveryCodesResponse(BaseModel):
    """Response containing recovery codes."""
    codes: List[str]
    generated_at: datetime
