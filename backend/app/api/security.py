"""
API endpoints for security features: audit logs, sessions, backup/restore.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_admin_user
from app.models import (
    User, AuditLog, AuditAction, UserSession,
    Application, Category, Widget, Tab, Server, NpmInstance,
    NotificationChannel, AlertRule, AppTemplate
)
from app.schemas.security import (
    AuditLogResponse, AuditStats,
    UserSessionResponse, SessionRevokeRequest, SessionRevokeAllRequest, SessionRevokeResponse,
    BackupConfig, BackupData, BackupMetadata, ImportResult,
)
from app.services.audit_service import AuditService
from app.services.session_service import SessionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/security", tags=["security"])


# ============== Audit Logs ==============

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    user_id: Optional[int] = Query(None),
    action: Optional[AuditAction] = Query(None),
    resource_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List audit logs (admin only)."""
    query = db.query(AuditLog).join(User, AuditLog.user_id == User.id, isouter=True)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    # Add username to response
    result = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "user_id": log.user_id,
            "username": log.user.username if log.user else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "resource_name": log.resource_name,
            "details": log.details,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at,
        }
        result.append(log_dict)

    return result


@router.get("/audit-logs/stats", response_model=AuditStats)
async def get_audit_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get audit log statistics (admin only)."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    total = db.query(func.count(AuditLog.id)).scalar()
    today = db.query(func.count(AuditLog.id)).filter(
        AuditLog.created_at >= today_start
    ).scalar()
    this_week = db.query(func.count(AuditLog.id)).filter(
        AuditLog.created_at >= week_start
    ).scalar()

    # Top actions
    top_actions = db.query(
        AuditLog.action, func.count(AuditLog.id).label("count")
    ).group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc()).limit(10).all()

    # Top users
    top_users = db.query(
        AuditLog.user_id, User.username, func.count(AuditLog.id).label("count")
    ).join(User, AuditLog.user_id == User.id, isouter=True).filter(
        AuditLog.user_id.isnot(None)
    ).group_by(AuditLog.user_id, User.username).order_by(
        func.count(AuditLog.id).desc()
    ).limit(10).all()

    return AuditStats(
        total_entries=total or 0,
        entries_today=today or 0,
        entries_this_week=this_week or 0,
        top_actions=[{"action": a.value, "count": c} for a, c in top_actions],
        top_users=[{"user_id": u, "username": n or "Unknown", "count": c} for u, n, c in top_users],
    )


@router.get("/audit-logs/actions", response_model=List[dict])
async def get_audit_actions(
    current_user: User = Depends(get_current_admin_user),
):
    """Get list of available audit actions."""
    return [{"value": a.value, "label": a.value.replace("_", " ").title()} for a in AuditAction]


# ============== Sessions ==============

@router.get("/sessions", response_model=List[UserSessionResponse])
async def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active sessions for current user."""
    service = SessionService(db)
    sessions = service.get_user_sessions(current_user.id)

    # Get current token to mark current session
    auth_header = request.headers.get("Authorization", "")
    current_token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None
    current_hash = service.hash_token(current_token) if current_token else None

    result = []
    for session in sessions:
        result.append(UserSessionResponse(
            id=session.id,
            device_info=session.device_info,
            ip_address=session.ip_address,
            is_current=session.token_hash == current_hash,
            last_activity=session.last_activity,
            expires_at=session.expires_at,
            created_at=session.created_at,
        ))

    return result


@router.post("/sessions/revoke", response_model=SessionRevokeResponse)
async def revoke_session(
    request: Request,
    data: SessionRevokeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a specific session."""
    service = SessionService(db)
    audit = AuditService(db)

    success = service.revoke_session(data.session_id, current_user.id)

    if success:
        audit.log_from_request(
            request=request,
            action=AuditAction.SESSION_REVOKED,
            user_id=current_user.id,
            resource_type="session",
            resource_id=data.session_id,
        )
        return SessionRevokeResponse(
            success=True,
            revoked_count=1,
            message="Session révoquée avec succès"
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Session non trouvée"
    )


@router.post("/sessions/revoke-all", response_model=SessionRevokeResponse)
async def revoke_all_sessions(
    request: Request,
    data: SessionRevokeAllRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke all sessions except optionally the current one."""
    service = SessionService(db)
    audit = AuditService(db)

    # Get current token if keeping current session
    current_token = None
    if data.keep_current:
        auth_header = request.headers.get("Authorization", "")
        current_token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None

    count = service.revoke_all_sessions(current_user.id, except_token=current_token)

    audit.log_from_request(
        request=request,
        action=AuditAction.ALL_SESSIONS_REVOKED,
        user_id=current_user.id,
        details={"revoked_count": count, "kept_current": data.keep_current},
    )

    return SessionRevokeResponse(
        success=True,
        revoked_count=count,
        message=f"{count} session(s) révoquée(s)"
    )


# ============== Backup/Export ==============

@router.post("/backup/export")
async def export_config(
    request: Request,
    config: BackupConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Export configuration to JSON (admin only)."""
    audit = AuditService(db)
    data = {}
    counts = {}

    # Export applications
    if config.include_applications:
        apps = db.query(Application).all()
        data["applications"] = [
            {
                "name": a.name,
                "url": a.url,
                "icon": a.icon,
                "description": a.description,
                "category_slug": a.category.slug if a.category else None,
                "is_visible": a.is_visible,
                "is_public": a.is_public,
                "display_order": a.display_order,
            }
            for a in apps
        ]
        counts["applications"] = len(data["applications"])

    # Export categories
    if config.include_categories:
        cats = db.query(Category).all()
        data["categories"] = [
            {
                "slug": c.slug,
                "name": c.name,
                "icon": c.icon,
                "order": c.order,
                "is_public": c.is_public,
            }
            for c in cats
        ]
        counts["categories"] = len(data["categories"])

    # Export widgets (widgets are global, no user_id filter)
    if config.include_widgets:
        widgets = db.query(Widget).all()
        data["widgets"] = [
            {
                "widget_type": w.widget_type,
                "title": w.title,
                "position": w.position,
                "column": w.column,
                "size": w.size,
                "col_span": w.col_span,
                "row_span": w.row_span,
                "config": w.config,
                "is_visible": w.is_visible,
                "is_public": w.is_public,
            }
            for w in widgets
        ]
        counts["widgets"] = len(data["widgets"])

    # Export tabs
    if config.include_tabs:
        tabs = db.query(Tab).filter(Tab.owner_id == current_user.id).all()
        data["tabs"] = [
            {
                "name": t.name,
                "slug": t.slug,
                "icon": t.icon,
                "position": t.position,
                "tab_type": t.tab_type,
                "content": t.content,
                "is_visible": t.is_visible,
                "is_public": t.is_public,
            }
            for t in tabs
        ]
        counts["tabs"] = len(data["tabs"])

    # Export servers
    if config.include_servers:
        servers = db.query(Server).all()
        data["servers"] = [
            {
                "name": s.name,
                "description": s.description,
                "icon": s.icon,
                "host": s.host,
                "ssh_port": s.ssh_port,
                "ssh_user": s.ssh_user,
                # Note: SSH keys/passwords are NOT exported for security
                "has_docker": s.has_docker,
                "has_proxmox": s.has_proxmox,
            }
            for s in servers
        ]
        counts["servers"] = len(data["servers"])

    # Export NPM instances
    if config.include_npm_instances:
        npms = db.query(NpmInstance).all()
        data["npm_instances"] = [
            {
                "name": n.name,
                "connection_mode": n.connection_mode,
                "db_host": n.db_host,
                "db_port": n.db_port,
                "db_name": n.db_name,
                "db_user": n.db_user,
                # Note: Passwords are NOT exported
                "api_url": n.api_url,
                "api_email": n.api_email,
                "priority": n.priority,
                "is_active": n.is_active,
            }
            for n in npms
        ]
        counts["npm_instances"] = len(data["npm_instances"])

    # Export notification channels
    if config.include_notification_channels:
        channels = db.query(NotificationChannel).filter(
            NotificationChannel.user_id == current_user.id
        ).all()
        data["notification_channels"] = [
            {
                "name": c.name,
                "channel_type": c.channel_type.value,
                "is_enabled": c.is_enabled,
                "is_default": c.is_default,
                "min_severity": c.min_severity.value,
                # Note: Config may contain sensitive data, export carefully
                "config": {k: v for k, v in (c.config or {}).items() if k not in ["bot_token", "password"]},
            }
            for c in channels
        ]
        counts["notification_channels"] = len(data["notification_channels"])

    # Export alert rules
    if config.include_alert_rules:
        rules = db.query(AlertRule).filter(AlertRule.user_id == current_user.id).all()
        data["alert_rules"] = [
            {
                "name": r.name,
                "description": r.description,
                "is_enabled": r.is_enabled,
                "rule_type": r.rule_type,
                "source_config": r.source_config,
                "severity": r.severity.value,
                "cooldown_minutes": r.cooldown_minutes,
                "title_template": r.title_template,
                "message_template": r.message_template,
            }
            for r in rules
        ]
        counts["alert_rules"] = len(data["alert_rules"])

    # Export templates (templates are global, filter by is_public or all for admin)
    if config.include_templates:
        templates = db.query(AppTemplate).all()
        data["templates"] = [
            {
                "name": t.name,
                "slug": t.slug,
                "description": t.description,
                "icon": t.icon,
                "version": t.version,
                "author": t.author,
                "config_schema": t.config_schema,
                "blocks": t.blocks,
                "is_public": t.is_public,
            }
            for t in templates
        ]
        counts["templates"] = len(data["templates"])

    # Create backup structure
    backup = BackupData(
        metadata=BackupMetadata(
            created_at=datetime.utcnow(),
            created_by=current_user.username,
            items_count=counts,
        ),
        **data
    )

    # Log export
    audit.log_from_request(
        request=request,
        action=AuditAction.CONFIG_EXPORTED,
        user_id=current_user.id,
        details={"items_count": counts},
    )

    return JSONResponse(
        content=backup.model_dump(mode="json"),
        headers={
            "Content-Disposition": f"attachment; filename=proxydash-backup-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
        }
    )


@router.post("/backup/import", response_model=ImportResult)
async def import_config(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Import configuration from JSON (admin only)."""
    audit = AuditService(db)
    errors = []
    warnings = []
    imported = {}

    try:
        content = await file.read()
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fichier JSON invalide"
        )

    # Validate backup structure
    if "metadata" not in data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format de backup invalide"
        )

    # Import categories first (apps depend on them)
    if "categories" in data and data["categories"]:
        count = 0
        for cat_data in data["categories"]:
            existing = db.query(Category).filter(Category.slug == cat_data["slug"]).first()
            if existing:
                warnings.append(f"Catégorie '{cat_data['slug']}' existe déjà, ignorée")
                continue

            cat = Category(
                slug=cat_data["slug"],
                name=cat_data["name"],
                icon=cat_data.get("icon"),
                order=cat_data.get("order", 0),
                is_public=cat_data.get("is_public", False),
            )
            db.add(cat)
            count += 1
        imported["categories"] = count

    db.commit()

    # Import applications
    if "applications" in data and data["applications"]:
        count = 0
        for app_data in data["applications"]:
            existing = db.query(Application).filter(Application.url == app_data["url"]).first()
            if existing:
                warnings.append(f"Application '{app_data['name']}' existe déjà, ignorée")
                continue

            category = None
            if app_data.get("category_slug"):
                category = db.query(Category).filter(Category.slug == app_data["category_slug"]).first()

            app = Application(
                name=app_data["name"],
                url=app_data["url"],
                icon=app_data.get("icon"),
                description=app_data.get("description"),
                category_id=category.id if category else None,
                is_visible=app_data.get("is_visible", True),
                is_public=app_data.get("is_public", False),
                display_order=app_data.get("display_order", 0),
            )
            db.add(app)
            count += 1
        imported["applications"] = count

    # Import widgets (widgets are global, no user_id)
    if "widgets" in data and data["widgets"]:
        count = 0
        for w_data in data["widgets"]:
            widget = Widget(
                widget_type=w_data["widget_type"],
                title=w_data.get("title"),
                position=w_data.get("position", 0),
                column=w_data.get("column", 0),
                size=w_data.get("size", "medium"),
                col_span=w_data.get("col_span", 1),
                row_span=w_data.get("row_span", 1),
                config=w_data.get("config", {}),
                is_visible=w_data.get("is_visible", True),
                is_public=w_data.get("is_public", False),
            )
            db.add(widget)
            count += 1
        imported["widgets"] = count

    # Import tabs
    if "tabs" in data and data["tabs"]:
        count = 0
        for t_data in data["tabs"]:
            existing = db.query(Tab).filter(
                Tab.slug == t_data["slug"],
                Tab.owner_id == current_user.id
            ).first()
            if existing:
                warnings.append(f"Tab '{t_data['name']}' existe déjà, ignorée")
                continue

            tab = Tab(
                owner_id=current_user.id,
                name=t_data["name"],
                slug=t_data["slug"],
                icon=t_data.get("icon"),
                position=t_data.get("position", 0),
                tab_type=t_data.get("tab_type", "custom"),
                content=t_data.get("content", {}),
                is_visible=t_data.get("is_visible", True),
                is_public=t_data.get("is_public", False),
            )
            db.add(tab)
            count += 1
        imported["tabs"] = count

    # Import notification channels
    if "notification_channels" in data and data["notification_channels"]:
        count = 0
        for c_data in data["notification_channels"]:
            channel = NotificationChannel(
                user_id=current_user.id,
                name=c_data["name"],
                channel_type=c_data["channel_type"],
                is_enabled=c_data.get("is_enabled", True),
                is_default=c_data.get("is_default", False),
                min_severity=c_data.get("min_severity", "warning"),
                config=c_data.get("config", {}),
            )
            db.add(channel)
            count += 1
        imported["notification_channels"] = count

    # Import alert rules
    if "alert_rules" in data and data["alert_rules"]:
        count = 0
        for r_data in data["alert_rules"]:
            rule = AlertRule(
                user_id=current_user.id,
                name=r_data["name"],
                description=r_data.get("description"),
                is_enabled=r_data.get("is_enabled", True),
                rule_type=r_data["rule_type"],
                source_config=r_data.get("source_config", {}),
                severity=r_data.get("severity", "warning"),
                cooldown_minutes=r_data.get("cooldown_minutes", 15),
                title_template=r_data.get("title_template"),
                message_template=r_data.get("message_template"),
            )
            db.add(rule)
            count += 1
        imported["alert_rules"] = count

    db.commit()

    # Log import
    audit.log_from_request(
        request=request,
        action=AuditAction.CONFIG_IMPORTED,
        user_id=current_user.id,
        details={"imported_counts": imported, "warnings_count": len(warnings)},
    )

    return ImportResult(
        success=True,
        message="Import terminé avec succès",
        imported_counts=imported,
        errors=errors,
        warnings=warnings,
    )
