"""
Widgets API routes.
Supports server_id for centralized SSH connection management.
Includes Redis caching and WebSocket broadcasting.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Widget, WIDGET_TYPES
from app.schemas import WidgetCreate, WidgetUpdate, WidgetResponse, WidgetDataResponse
from app.api.deps import get_current_user, get_current_admin_user
from app.services.widget_data import fetch_widget_data
from app.services.server_connection import merge_server_config
from app.services.cache_service import cache_service, get_widget_ttl
from app.services.websocket_service import ws_manager

router = APIRouter(prefix="/widgets", tags=["Widgets"])


@router.get("/types")
async def get_widget_types():
    """Get all available widget types and their configuration schemas."""
    return WIDGET_TYPES


@router.get("", response_model=List[WidgetResponse])
async def list_widgets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """List all widgets for the dashboard."""
    widgets = db.query(Widget).filter(
        Widget.is_visible == True
    ).order_by(Widget.column, Widget.position).all()
    return widgets


@router.get("/public", response_model=List[WidgetResponse])
async def list_public_widgets(db: Session = Depends(get_db)):
    """List public widgets (no auth required)."""
    widgets = db.query(Widget).filter(
        Widget.is_visible == True,
        Widget.is_public == True
    ).order_by(Widget.column, Widget.position).all()
    return widgets


@router.get("/all", response_model=List[WidgetResponse])
async def list_all_widgets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user)
):
    """List all widgets including hidden (admin only)."""
    widgets = db.query(Widget).order_by(Widget.column, Widget.position).all()
    return widgets


@router.post("", response_model=WidgetResponse)
async def create_widget(
    data: WidgetCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user)
):
    """Create a new widget (admin only)."""
    if data.widget_type not in WIDGET_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de widget invalide. Types disponibles: {list(WIDGET_TYPES.keys())}"
        )

    widget = Widget(
        widget_type=data.widget_type,
        title=data.title,
        position=data.position,
        column=data.column,
        size=data.size,
        col_span=data.col_span,
        row_span=data.row_span,
        config=data.config,
        is_visible=data.is_visible,
        is_public=data.is_public,
    )

    db.add(widget)
    db.commit()
    db.refresh(widget)

    return widget


@router.get("/{widget_id}", response_model=WidgetResponse)
async def get_widget(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get a specific widget."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget non trouvé"
        )
    return widget


@router.patch("/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    widget_id: int,
    data: WidgetUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user)
):
    """Update a widget (admin only). Invalidates cache on update."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget non trouvé"
        )

    update_data = data.model_dump(exclude_unset=True)

    if "widget_type" in update_data and update_data["widget_type"] not in WIDGET_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de widget invalide"
        )

    for field, value in update_data.items():
        setattr(widget, field, value)

    db.commit()
    db.refresh(widget)

    # Invalidate cache when widget config changes
    await cache_service.invalidate_widget(widget_id)

    return widget


@router.delete("/{widget_id}")
async def delete_widget(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user)
):
    """Delete a widget (admin only)."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget non trouvé"
        )

    db.delete(widget)
    db.commit()

    return {"message": "Widget supprimé"}


@router.post("/{widget_id}/data", response_model=WidgetDataResponse)
async def get_widget_data(
    widget_id: int,
    skip_cache: bool = Query(False, description="Skip cache and fetch fresh data"),
    broadcast: bool = Query(True, description="Broadcast update to WebSocket clients"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Fetch live data for a widget.
    Supports server_id for centralized credentials.
    Uses Redis cache when available.
    """
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget non trouvé"
        )

    data = None
    from_cache = False

    # Try to get from cache first (unless skip_cache is True)
    if not skip_cache:
        cached_data = await cache_service.get_widget_data(widget_id)
        if cached_data:
            data = cached_data
            from_cache = True

    # Fetch fresh data if not in cache
    if not data:
        # Merge server credentials if server_id is present in config
        config = merge_server_config(db, widget.config or {})
        data = await fetch_widget_data(widget.widget_type, config)

        # Cache the result
        ttl = get_widget_ttl(widget.widget_type)
        if ttl > 0:
            await cache_service.set_widget_data(widget_id, data, ttl)

        # Broadcast to WebSocket clients
        if broadcast and not data.get("error"):
            await ws_manager.broadcast_widget_update(
                widget_id=widget_id,
                widget_type=widget.widget_type,
                data=data
            )
        elif broadcast and data.get("error"):
            await ws_manager.broadcast_widget_error(
                widget_id=widget_id,
                widget_type=widget.widget_type,
                error=data.get("error")
            )

    response = WidgetDataResponse(
        widget_id=widget_id,
        widget_type=widget.widget_type,
        data=data,
        error=data.get("error") if isinstance(data, dict) else None,
        fetched_at=datetime.utcnow()
    )

    # Add cache info to response data
    if isinstance(data, dict):
        data["_from_cache"] = from_cache

    return response


@router.post("/fetch-data")
async def fetch_widget_data_direct(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Fetch live data for a widget using direct configuration.
    This endpoint is used for widgets in custom tabs that don't exist in the database.
    Supports server_id for centralized credentials.

    Accepts:
    - {"widget_type": "vm_status", "config": {...}}
    - {"widget_type": "docker", "config": {"server_id": 1, ...}}
    """
    widget_type = data.get("widget_type")
    config = data.get("config", {})

    if not widget_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="widget_type est requis"
        )

    # Merge server credentials if server_id is present in config
    config = merge_server_config(db, config)
    result = await fetch_widget_data(widget_type, config)

    return {
        "widget_type": widget_type,
        "data": result,
        "error": result.get("error") if isinstance(result, dict) else None,
        "fetched_at": datetime.utcnow().isoformat()
    }


@router.post("/reorder")
async def reorder_widgets(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user)
):
    """
    Reorder widgets (admin only).

    Accepts:
    - {"widget_ids": [1, 2, 3]} - simple list of IDs in order
    """
    widget_ids = data.get("widget_ids", [])

    for position, widget_id in enumerate(widget_ids):
        widget = db.query(Widget).filter(Widget.id == widget_id).first()
        if widget:
            widget.position = position

    db.commit()

    return {"message": "Ordre des widgets mis à jour"}


@router.post("/bulk-update")
async def bulk_update_widgets(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user)
):
    """
    Bulk update widgets position and size (admin only).

    Accepts:
    - {"updates": [{"id": 1, "position": 0, "col_span": 2, "row_span": 1}, ...]}
    """
    updates = data.get("updates", [])
    updated_count = 0

    for update in updates:
        widget_id = update.get("id")
        if not widget_id:
            continue

        widget = db.query(Widget).filter(Widget.id == widget_id).first()
        if widget:
            if "position" in update:
                widget.position = update["position"]
            if "col_span" in update:
                widget.col_span = update["col_span"]
            if "row_span" in update:
                widget.row_span = update["row_span"]
            updated_count += 1

    db.commit()

    return {"message": f"{updated_count} widgets mis à jour"}
