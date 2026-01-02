"""
Ping API endpoints for uptime monitoring.
Provides ping functionality and history for the Uptime/Ping widget.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, Widget, PingHistory
from app.services.ping_service import PingService, PingHistoryService, PingResult

router = APIRouter(prefix="/ping", tags=["ping"])


# Pydantic models
class PingRequest(BaseModel):
    """Request model for single ping."""
    target: str
    count: int = 5
    timeout: int = 5


class MultiplePingRequest(BaseModel):
    """Request model for multiple pings."""
    targets: List[str]
    count: int = 5
    timeout: int = 5


class PingResponse(BaseModel):
    """Response model for ping result."""
    target: str
    is_reachable: bool
    latency_min: Optional[float] = None
    latency_avg: Optional[float] = None
    latency_max: Optional[float] = None
    jitter: Optional[float] = None
    packets_sent: int = 0
    packets_received: int = 0
    packet_loss_percent: float = 100.0
    error_message: Optional[str] = None
    timestamp: Optional[str] = None


@router.post("/single", response_model=PingResponse)
async def ping_single(
    request: PingRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Ping a single target and return detailed statistics.
    Does not save to history.
    """
    ping_service = PingService()
    result = await ping_service.ping(
        target=request.target,
        count=request.count,
        timeout=request.timeout,
    )
    return result.to_dict()


@router.post("/multiple")
async def ping_multiple(
    request: MultiplePingRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Ping multiple targets concurrently.
    Does not save to history.
    """
    ping_service = PingService()
    results = await ping_service.ping_multiple(
        targets=request.targets,
        count=request.count,
        timeout=request.timeout,
    )
    return {"results": [r.to_dict() for r in results]}


@router.post("/record")
async def ping_and_record(
    request: PingRequest,
    widget_id: Optional[int] = None,
    target_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ping a target and save the result to history.
    """
    # Verify widget ownership if provided
    if widget_id:
        widget = db.query(Widget).filter(
            Widget.id == widget_id,
        ).first()
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")

    history_service = PingHistoryService(db)
    result = await history_service.perform_and_record_ping(
        target=request.target,
        target_name=target_name,
        widget_id=widget_id,
        count=request.count,
        timeout=request.timeout,
    )
    return result.to_dict()


@router.get("/history/{target}")
async def get_ping_history(
    target: str,
    hours: int = Query(default=24, ge=1, le=8760),  # Max 1 year (365 days)
    widget_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get ping history for a specific target.
    Returns data points for SmokePing-style visualization.
    Supports up to 1 year of history.
    """
    history_service = PingHistoryService(db)
    history = history_service.get_history(
        target=target,
        hours=hours,
        widget_id=widget_id,
    )
    return {"target": target, "hours": hours, "data": history, "count": len(history)}


@router.get("/statistics/{target}")
async def get_ping_statistics(
    target: str,
    hours: int = Query(default=24, ge=1, le=8760),  # Max 1 year
    widget_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get aggregated statistics for a target.
    """
    history_service = PingHistoryService(db)
    stats = history_service.get_statistics(
        target=target,
        hours=hours,
        widget_id=widget_id,
    )
    return {"target": target, "hours": hours, "statistics": stats}


@router.get("/widget/{widget_id}/data")
async def get_widget_ping_data(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all ping data for a widget (for widget display).
    Performs fresh pings and returns historical data.
    """
    # Get widget configuration
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.widget_type == "uptime_ping",
    ).first()

    if not widget:
        raise HTTPException(status_code=404, detail="Uptime widget not found")

    config = widget.config or {}
    targets_str = config.get("targets", "")
    names_str = config.get("target_names", "")
    history_hours = config.get("history_hours", 24)
    ping_count = config.get("ping_count", 5)
    ping_timeout = config.get("ping_timeout", 5)

    # Parse targets
    targets = [t.strip() for t in targets_str.split("\n") if t.strip()]
    names = [n.strip() for n in names_str.split("\n") if n.strip()]

    if not targets:
        return {"targets": [], "error": "No targets configured"}

    # Create target list with names
    target_list = []
    for i, target in enumerate(targets):
        name = names[i] if i < len(names) and names[i] else target
        target_list.append({"target": target, "name": name})

    # Perform fresh pings
    ping_service = PingService()
    history_service = PingHistoryService(db)

    results = []
    for item in target_list:
        target = item["target"]
        name = item["name"]

        # Perform ping and record
        result = await history_service.perform_and_record_ping(
            target=target,
            target_name=name,
            widget_id=widget_id,
            count=ping_count,
            timeout=ping_timeout,
        )

        # Get history
        history = history_service.get_history(
            target=target,
            hours=history_hours,
            widget_id=widget_id,
        )

        # Get statistics
        stats = history_service.get_statistics(
            target=target,
            hours=history_hours,
            widget_id=widget_id,
        )

        results.append({
            "target": target,
            "name": name,
            "current": result.to_dict(),
            "history": history,
            "statistics": stats,
        })

    return {
        "targets": results,
        "config": {
            "history_hours": history_hours,
            "latency_warning": config.get("latency_warning", 100),
            "latency_critical": config.get("latency_critical", 500),
            "loss_warning": config.get("loss_warning", 5),
            "loss_critical": config.get("loss_critical", 20),
            "show_jitter": config.get("show_jitter", True),
            "show_packet_loss": config.get("show_packet_loss", True),
            "show_statistics": config.get("show_statistics", True),
            "graph_height": config.get("graph_height", 150),
        }
    }


@router.delete("/history/cleanup")
async def cleanup_history(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete old ping history (admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    history_service = PingHistoryService(db)
    deleted = history_service.cleanup_old_history(days=days)
    return {"deleted_count": deleted, "kept_days": days}
