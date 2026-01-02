"""
API endpoints for webhook management and incoming webhooks.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_admin_user
from app.models import User
from app.models.webhook import Webhook, WebhookEvent, WEBHOOK_TEMPLATES
from app.schemas.webhook import (
    WebhookCreate, WebhookUpdate, WebhookResponse, WebhookListResponse,
    WebhookWithSecret, WebhookEventResponse, WebhookEventList,
    WebhookTemplateResponse, WebhookStats, WebhookTestPayload
)
from app.services.webhook_service import WebhookService
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_webhook_base_url(request: Request) -> str:
    """Get the base URL for webhook endpoints.

    Uses WEBHOOK_BASE_URL from settings if configured,
    otherwise falls back to the request's base URL.
    """
    if settings.WEBHOOK_BASE_URL:
        return settings.WEBHOOK_BASE_URL.rstrip("/")
    return str(request.base_url).rstrip("/")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ============== Configuration ==============

@router.get("/config")
async def get_webhook_config(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Get webhook configuration including base URL."""
    base_url = get_webhook_base_url(request)
    return {
        "base_url": base_url,
        "endpoint_pattern": f"{base_url}/api/webhooks/incoming/{{token}}",
    }


# ============== Webhook Management ==============

@router.get("/", response_model=List[WebhookListResponse])
async def list_webhooks(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all webhooks for current user (or all for admin)."""
    query = db.query(Webhook)
    if not current_user.is_admin:
        query = query.filter(Webhook.user_id == current_user.id)

    webhooks = query.order_by(Webhook.created_at.desc()).all()

    # Build response with URLs
    base_url = get_webhook_base_url(request)
    result = []
    for webhook in webhooks:
        response = WebhookListResponse.model_validate(webhook)
        response.url = f"{base_url}/api/webhooks/incoming/{webhook.token}"
        result.append(response)

    return result


@router.post("/", response_model=WebhookWithSecret)
async def create_webhook(
    request: Request,
    data: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new webhook."""
    audit = AuditService(db)

    # Generate token
    token = Webhook.generate_token()

    # Generate secret if requested
    secret = Webhook.generate_secret() if data.generate_secret else None

    webhook = Webhook(
        name=data.name,
        description=data.description,
        token=token,
        secret=secret,
        event_types=data.event_types,
        create_alert=data.create_alert,
        alert_severity=data.alert_severity,
        forward_to_channels=data.forward_to_channels,
        title_template=data.title_template,
        message_template=data.message_template,
        is_enabled=data.is_enabled,
        user_id=current_user.id,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    # Log creation
    audit.log_from_request(
        request=request,
        action=AuditAction.WEBHOOK_CREATED,
        user_id=current_user.id,
        resource_type="webhook",
        resource_id=webhook.id,
        resource_name=webhook.name,
    )

    # Build response with URL
    base_url = get_webhook_base_url(request)
    response = WebhookWithSecret.model_validate(webhook)
    response.url = f"{base_url}/api/webhooks/incoming/{webhook.token}"
    response.secret = secret  # Include secret only on creation

    return response


@router.get("/templates", response_model=List[WebhookTemplateResponse])
async def get_webhook_templates(
    current_user: User = Depends(get_current_user),
):
    """Get available webhook templates for common services."""
    return [
        WebhookTemplateResponse(key=key, **template)
        for key, template in WEBHOOK_TEMPLATES.items()
    ]


@router.get("/event-types")
async def get_event_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all available event types."""
    service = WebhookService(db)
    return service.get_event_types()


@router.get("/stats", response_model=WebhookStats)
async def get_webhook_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get webhook statistics (admin only)."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Counts
    total = db.query(func.count(Webhook.id)).scalar() or 0
    active = db.query(func.count(Webhook.id)).filter(Webhook.is_enabled == True).scalar() or 0
    total_events = db.query(func.count(WebhookEvent.id)).scalar() or 0
    events_today = db.query(func.count(WebhookEvent.id)).filter(
        WebhookEvent.received_at >= today_start
    ).scalar() or 0
    events_week = db.query(func.count(WebhookEvent.id)).filter(
        WebhookEvent.received_at >= week_start
    ).scalar() or 0

    # Top webhooks
    top_webhooks = db.query(
        Webhook.name, Webhook.received_count
    ).order_by(Webhook.received_count.desc()).limit(5).all()

    return WebhookStats(
        total_webhooks=total,
        active_webhooks=active,
        total_events_received=total_events,
        events_today=events_today,
        events_this_week=events_week,
        top_webhooks=[
            {"name": name, "received_count": count}
            for name, count in top_webhooks
        ],
    )


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get webhook details."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    # Build response with URL
    base_url = get_webhook_base_url(request)
    response = WebhookResponse.model_validate(webhook)
    response.url = f"{base_url}/api/webhooks/incoming/{webhook.token}"

    return response


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: int,
    request: Request,
    data: WebhookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a webhook."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(webhook, field, value)

    db.commit()
    db.refresh(webhook)

    # Log update
    audit = AuditService(db)
    audit.log_from_request(
        request=request,
        action=AuditAction.WEBHOOK_UPDATED,
        user_id=current_user.id,
        resource_type="webhook",
        resource_id=webhook.id,
        resource_name=webhook.name,
    )

    base_url = get_webhook_base_url(request)
    response = WebhookResponse.model_validate(webhook)
    response.url = f"{base_url}/api/webhooks/incoming/{webhook.token}"

    return response


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a webhook."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    webhook_name = webhook.name

    db.delete(webhook)
    db.commit()

    # Log deletion
    audit = AuditService(db)
    audit.log_from_request(
        request=request,
        action=AuditAction.WEBHOOK_DELETED,
        user_id=current_user.id,
        resource_type="webhook",
        resource_id=webhook_id,
        resource_name=webhook_name,
    )

    return {"message": "Webhook supprimé"}


@router.post("/{webhook_id}/regenerate-token", response_model=WebhookResponse)
async def regenerate_webhook_token(
    webhook_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Regenerate webhook token (invalidates old URL)."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    webhook.token = Webhook.generate_token()
    db.commit()
    db.refresh(webhook)

    base_url = get_webhook_base_url(request)
    response = WebhookResponse.model_validate(webhook)
    response.url = f"{base_url}/api/webhooks/incoming/{webhook.token}"

    return response


@router.post("/{webhook_id}/regenerate-secret")
async def regenerate_webhook_secret(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Regenerate webhook secret for signature validation."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    new_secret = Webhook.generate_secret()
    webhook.secret = new_secret
    db.commit()

    return {"secret": new_secret}


# ============== Webhook Events ==============

@router.get("/{webhook_id}/events", response_model=WebhookEventList)
async def list_webhook_events(
    webhook_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List events for a webhook."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    total = db.query(func.count(WebhookEvent.id)).filter(
        WebhookEvent.webhook_id == webhook_id
    ).scalar() or 0

    events = db.query(WebhookEvent).filter(
        WebhookEvent.webhook_id == webhook_id
    ).order_by(
        WebhookEvent.received_at.desc()
    ).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return WebhookEventList(
        items=[WebhookEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{webhook_id}/events/{event_id}", response_model=WebhookEventResponse)
async def get_webhook_event(
    webhook_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific webhook event."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    event = db.query(WebhookEvent).filter(
        WebhookEvent.id == event_id,
        WebhookEvent.webhook_id == webhook_id,
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")

    return event


# ============== Incoming Webhook Endpoint (Public) ==============

@router.post("/incoming/{token}")
async def receive_webhook(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public endpoint to receive webhooks.
    No authentication required - token in URL identifies the webhook.
    """
    service = WebhookService(db)

    # Find webhook by token
    webhook = service.get_webhook_by_token(token)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Get raw body for signature verification
    raw_body = await request.body()

    # Parse payload
    try:
        if raw_body:
            payload = await request.json()
        else:
            payload = {}
    except Exception:
        payload = {"raw": raw_body.decode("utf-8", errors="replace")}

    # Get headers (lowercase keys)
    headers = {k.lower(): v for k, v in request.headers.items()}

    # Verify signature if secret is configured
    signature_headers = ["x-hub-signature-256", "x-hub-signature", "x-gitlab-token"]
    signature = None
    for header in signature_headers:
        if header in headers:
            signature = headers[header]
            break

    if webhook.secret and signature:
        if not service.verify_signature(webhook, raw_body, signature):
            logger.warning(f"Webhook {webhook.id}: Invalid signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

    # Get client IP
    source_ip = headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not source_ip and request.client:
        source_ip = request.client.host

    # Process webhook
    event, alert = await service.process_webhook(
        webhook=webhook,
        headers=headers,
        payload=payload,
        source_ip=source_ip,
        raw_body=raw_body,
    )

    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "event_id": event.id,
            "alert_id": alert.id if alert else None,
            "message": "Webhook received and processed",
        }
    )


# ============== Test Webhook ==============

@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: int,
    data: WebhookTestPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test a webhook by simulating an incoming event."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook non trouvé")

    if not current_user.is_admin and webhook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    service = WebhookService(db)

    # Create test payload
    test_payload = {
        "test": True,
        "event_type": data.event_type,
        "timestamp": datetime.utcnow().isoformat(),
        **data.payload,
    }

    # Process as if it was a real webhook
    event, alert = await service.process_webhook(
        webhook=webhook,
        headers={"x-test": "true"},
        payload=test_payload,
        source_ip="127.0.0.1",
        raw_body=b"",
    )

    return {
        "success": True,
        "event_id": event.id,
        "alert_id": alert.id if alert else None,
        "message": "Test webhook processed successfully",
    }
