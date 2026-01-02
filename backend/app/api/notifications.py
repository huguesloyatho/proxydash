"""
API endpoints for notifications and alerts.
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_admin_user
from app.models import User
from app.models.notification import (
    NotificationChannel, AlertRule, Alert, NotificationLog,
    ChannelType, AlertSeverity, AlertStatus
)
from app.models.system_config import SystemConfig
from app.schemas.notification import (
    NotificationChannelCreate, NotificationChannelUpdate, NotificationChannelResponse,
    NotificationChannelListItem,
    AlertRuleCreate, AlertRuleUpdate, AlertRuleResponse, AlertRuleListItem,
    AlertResponse, AlertListItem, AlertAcknowledge, AlertResolve,
    NotificationLogResponse, NotificationStats,
    SMTPConfig, TelegramConfig, TestNotificationRequest, TestNotificationResponse,
    RULE_TYPE_INFO, RuleTypeInfo
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ============== Channels ==============

@router.get("/channels", response_model=List[NotificationChannelListItem])
async def list_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all notification channels for the current user."""
    channels = db.query(NotificationChannel).filter(
        NotificationChannel.user_id == current_user.id
    ).order_by(NotificationChannel.created_at.desc()).all()

    return channels


@router.post("/channels", response_model=NotificationChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    data: NotificationChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new notification channel."""
    # If this is set as default, unset other defaults of same type
    if data.is_default:
        db.query(NotificationChannel).filter(
            NotificationChannel.user_id == current_user.id,
            NotificationChannel.channel_type == data.channel_type,
            NotificationChannel.is_default == True,
        ).update({"is_default": False})

    channel = NotificationChannel(
        user_id=current_user.id,
        name=data.name,
        channel_type=data.channel_type,
        is_enabled=data.is_enabled,
        is_default=data.is_default,
        min_severity=data.min_severity,
        config=data.config,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)

    return channel


@router.get("/channels/{channel_id}", response_model=NotificationChannelResponse)
async def get_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific notification channel."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id,
        NotificationChannel.user_id == current_user.id,
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    return channel


@router.put("/channels/{channel_id}", response_model=NotificationChannelResponse)
async def update_channel(
    channel_id: int,
    data: NotificationChannelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a notification channel."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id,
        NotificationChannel.user_id == current_user.id,
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # If setting as default, unset other defaults
    if data.is_default:
        db.query(NotificationChannel).filter(
            NotificationChannel.user_id == current_user.id,
            NotificationChannel.channel_type == channel.channel_type,
            NotificationChannel.is_default == True,
            NotificationChannel.id != channel_id,
        ).update({"is_default": False})

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(channel, key, value)

    db.commit()
    db.refresh(channel)

    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a notification channel."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id,
        NotificationChannel.user_id == current_user.id,
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    db.delete(channel)
    db.commit()


@router.post("/channels/test", response_model=TestNotificationResponse)
async def test_channel(
    data: TestNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test notification to a channel."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == data.channel_id,
        NotificationChannel.user_id == current_user.id,
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    service = NotificationService(db)
    success, error = await service.test_channel(channel)

    return TestNotificationResponse(success=success, error_message=error if not success else None)


# ============== Alert Rules ==============

@router.get("/rules", response_model=List[AlertRuleListItem])
async def list_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all alert rules for the current user."""
    rules = db.query(AlertRule).filter(
        AlertRule.user_id == current_user.id
    ).order_by(AlertRule.created_at.desc()).all()

    return rules


@router.get("/rules/types", response_model=List[RuleTypeInfo])
async def list_rule_types(
    current_user: User = Depends(get_current_user),
):
    """List available alert rule types."""
    return [
        RuleTypeInfo(key=key, **info)
        for key, info in RULE_TYPE_INFO.items()
    ]


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    data: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new alert rule."""
    # Validate rule type
    if data.rule_type not in RULE_TYPE_INFO:
        raise HTTPException(status_code=400, detail=f"Invalid rule type: {data.rule_type}")

    # Validate channel IDs belong to user
    if data.channel_ids:
        valid_channels = db.query(NotificationChannel.id).filter(
            NotificationChannel.user_id == current_user.id,
            NotificationChannel.id.in_(data.channel_ids),
        ).all()
        valid_ids = {c.id for c in valid_channels}
        invalid_ids = set(data.channel_ids) - valid_ids
        if invalid_ids:
            raise HTTPException(status_code=400, detail=f"Invalid channel IDs: {invalid_ids}")

    rule = AlertRule(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        is_enabled=data.is_enabled,
        rule_type=data.rule_type,
        server_id=data.server_id,
        source_config=data.source_config,
        severity=data.severity,
        cooldown_minutes=data.cooldown_minutes,
        channel_ids=data.channel_ids,
        title_template=data.title_template,
        message_template=data.message_template,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return rule


@router.get("/rules/{rule_id}", response_model=AlertRuleResponse)
async def get_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific alert rule."""
    rule = db.query(AlertRule).filter(
        AlertRule.id == rule_id,
        AlertRule.user_id == current_user.id,
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return rule


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_rule(
    rule_id: int,
    data: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an alert rule."""
    rule = db.query(AlertRule).filter(
        AlertRule.id == rule_id,
        AlertRule.user_id == current_user.id,
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Validate channel IDs if provided
    if data.channel_ids:
        valid_channels = db.query(NotificationChannel.id).filter(
            NotificationChannel.user_id == current_user.id,
            NotificationChannel.id.in_(data.channel_ids),
        ).all()
        valid_ids = {c.id for c in valid_channels}
        invalid_ids = set(data.channel_ids) - valid_ids
        if invalid_ids:
            raise HTTPException(status_code=400, detail=f"Invalid channel IDs: {invalid_ids}")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)

    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an alert rule."""
    rule = db.query(AlertRule).filter(
        AlertRule.id == rule_id,
        AlertRule.user_id == current_user.id,
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()


# ============== Alerts ==============

@router.get("/alerts", response_model=List[AlertListItem])
async def list_alerts(
    status_filter: Optional[AlertStatus] = Query(None, alias="status"),
    severity_filter: Optional[AlertSeverity] = Query(None, alias="severity"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List alerts for the current user."""
    query = db.query(Alert, AlertRule.name.label("rule_name")).join(
        AlertRule, Alert.rule_id == AlertRule.id
    ).filter(
        Alert.user_id == current_user.id
    )

    if status_filter:
        query = query.filter(Alert.status == status_filter)
    if severity_filter:
        query = query.filter(Alert.severity == severity_filter)

    results = query.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()

    return [
        AlertListItem(
            id=alert.id,
            title=alert.title,
            severity=alert.severity,
            status=alert.status,
            rule_name=rule_name,
            created_at=alert.created_at,
            acknowledged_at=alert.acknowledged_at,
            resolved_at=alert.resolved_at,
        )
        for alert, rule_name in results
    ]


@router.get("/alerts/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific alert."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.user_id == current_user.id,
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge an alert."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.user_id == current_user.id,
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.status != AlertStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Alert is not active")

    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledged_by = current_user.id
    db.commit()
    db.refresh(alert)

    return alert


@router.post("/alerts/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: int,
    data: AlertResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve an alert."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.user_id == current_user.id,
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.status == AlertStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Alert is already resolved")

    alert.status = AlertStatus.RESOLVED
    alert.resolved_at = datetime.utcnow()
    alert.resolution_note = data.resolution_note
    db.commit()
    db.refresh(alert)

    return alert


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an alert."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.user_id == current_user.id,
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()


# ============== Notification Logs ==============

@router.get("/logs", response_model=List[NotificationLogResponse])
async def list_notification_logs(
    channel_id: Optional[int] = None,
    success: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List notification logs for the current user."""
    query = db.query(NotificationLog).filter(
        NotificationLog.user_id == current_user.id
    )

    if channel_id is not None:
        query = query.filter(NotificationLog.channel_id == channel_id)
    if success is not None:
        query = query.filter(NotificationLog.success == success)

    logs = query.order_by(NotificationLog.sent_at.desc()).offset(offset).limit(limit).all()

    return logs


# ============== Stats ==============

@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notification statistics for the current user."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Channel stats
    total_channels = db.query(func.count(NotificationChannel.id)).filter(
        NotificationChannel.user_id == current_user.id
    ).scalar()

    enabled_channels = db.query(func.count(NotificationChannel.id)).filter(
        NotificationChannel.user_id == current_user.id,
        NotificationChannel.is_enabled == True,
    ).scalar()

    # Rule stats
    total_rules = db.query(func.count(AlertRule.id)).filter(
        AlertRule.user_id == current_user.id
    ).scalar()

    enabled_rules = db.query(func.count(AlertRule.id)).filter(
        AlertRule.user_id == current_user.id,
        AlertRule.is_enabled == True,
    ).scalar()

    # Alert stats
    active_alerts = db.query(func.count(Alert.id)).filter(
        Alert.user_id == current_user.id,
        Alert.status == AlertStatus.ACTIVE,
    ).scalar()

    alerts_today = db.query(func.count(Alert.id)).filter(
        Alert.user_id == current_user.id,
        Alert.created_at >= today_start,
    ).scalar()

    # Notification stats
    notifications_sent_today = db.query(func.count(NotificationLog.id)).filter(
        NotificationLog.user_id == current_user.id,
        NotificationLog.sent_at >= today_start,
        NotificationLog.success == True,
    ).scalar()

    notifications_failed_today = db.query(func.count(NotificationLog.id)).filter(
        NotificationLog.user_id == current_user.id,
        NotificationLog.sent_at >= today_start,
        NotificationLog.success == False,
    ).scalar()

    return NotificationStats(
        total_channels=total_channels or 0,
        enabled_channels=enabled_channels or 0,
        total_rules=total_rules or 0,
        enabled_rules=enabled_rules or 0,
        active_alerts=active_alerts or 0,
        alerts_today=alerts_today or 0,
        notifications_sent_today=notifications_sent_today or 0,
        notifications_failed_today=notifications_failed_today or 0,
    )


# ============== Admin Config ==============

@router.get("/config/smtp", response_model=Optional[SMTPConfig])
async def get_smtp_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get SMTP configuration (admin only)."""
    config = db.query(SystemConfig).filter(SystemConfig.key == "smtp_config").first()
    if config and config.value:
        # Mask password
        data = config.value.copy()
        if "password" in data:
            data["password"] = "********"
        return SMTPConfig(**data)
    return None


@router.put("/config/smtp", response_model=dict)
async def set_smtp_config(
    data: SMTPConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Set SMTP configuration (admin only)."""
    config = db.query(SystemConfig).filter(SystemConfig.key == "smtp_config").first()

    config_data = data.model_dump()

    # If password is masked, keep existing password
    if data.password == "********" and config and config.value:
        config_data["password"] = config.value.get("password", "")

    if config:
        config.value = config_data
    else:
        config = SystemConfig(key="smtp_config", value=config_data)
        db.add(config)

    db.commit()

    return {"message": "SMTP configuration saved"}


@router.get("/config/telegram", response_model=Optional[TelegramConfig])
async def get_telegram_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get Telegram bot configuration (admin only)."""
    config = db.query(SystemConfig).filter(SystemConfig.key == "telegram_bot_token").first()
    if config and config.value:
        # Mask token
        data = config.value.copy()
        if "token" in data:
            data["token"] = data["token"][:10] + "********"
        return TelegramConfig(**data)
    return None


@router.put("/config/telegram", response_model=dict)
async def set_telegram_config(
    data: TelegramConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Set Telegram bot configuration (admin only)."""
    config = db.query(SystemConfig).filter(SystemConfig.key == "telegram_bot_token").first()

    # If token is masked, keep existing token
    if "********" in data.token and config and config.value:
        return {"message": "Telegram configuration unchanged"}

    config_data = {"token": data.token}

    if config:
        config.value = config_data
    else:
        config = SystemConfig(key="telegram_bot_token", value=config_data)
        db.add(config)

    db.commit()

    return {"message": "Telegram configuration saved"}
