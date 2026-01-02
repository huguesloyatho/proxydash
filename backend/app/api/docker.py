"""
Docker API endpoints for container management.
Provides list, start, stop, restart operations via SSH.
Supports server_id for centralized connection management.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, Widget
from app.services.docker_service import DockerService, fetch_docker_data
from app.services.server_connection import merge_server_config

router = APIRouter(prefix="/docker", tags=["docker"])


class ContainerActionRequest(BaseModel):
    """Request model for container actions."""
    container_name: str


class ContainerLogsRequest(BaseModel):
    """Request model for container logs."""
    container_name: str
    lines: int = 50


@router.get("/widget/{widget_id}/data")
async def get_docker_widget_data(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get Docker containers data for a widget.
    Returns list of containers with status and optionally stats.
    Supports server_id for centralized SSH credentials.
    """
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.widget_type == "docker",
    ).first()

    if not widget:
        raise HTTPException(status_code=404, detail="Docker widget not found")

    config = widget.config or {}
    # Merge server credentials if server_id is provided
    config = merge_server_config(db, config)
    return await fetch_docker_data(config)


def _get_docker_service(db: Session, widget: Widget) -> DockerService:
    """Create DockerService from widget config, supporting server_id."""
    config = merge_server_config(db, widget.config or {})
    return DockerService(
        host=config.get("host", ""),
        ssh_port=config.get("ssh_port", 22),
        ssh_user=config.get("ssh_user", "root"),
        ssh_key=config.get("ssh_key", ""),
        ssh_password=config.get("ssh_password", ""),
    )


@router.post("/widget/{widget_id}/start")
async def start_container(
    widget_id: int,
    request: ContainerActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a Docker container."""
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.widget_type == "docker",
    ).first()

    if not widget:
        raise HTTPException(status_code=404, detail="Docker widget not found")

    service = _get_docker_service(db, widget)

    try:
        result = await service.start_container(request.container_name)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to start container"))
        return result
    finally:
        await service.close()


@router.post("/widget/{widget_id}/stop")
async def stop_container(
    widget_id: int,
    request: ContainerActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop a Docker container."""
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.widget_type == "docker",
    ).first()

    if not widget:
        raise HTTPException(status_code=404, detail="Docker widget not found")

    service = _get_docker_service(db, widget)

    try:
        result = await service.stop_container(request.container_name)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to stop container"))
        return result
    finally:
        await service.close()


@router.post("/widget/{widget_id}/restart")
async def restart_container(
    widget_id: int,
    request: ContainerActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restart a Docker container."""
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.widget_type == "docker",
    ).first()

    if not widget:
        raise HTTPException(status_code=404, detail="Docker widget not found")

    service = _get_docker_service(db, widget)

    try:
        result = await service.restart_container(request.container_name)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to restart container"))
        return result
    finally:
        await service.close()


@router.post("/widget/{widget_id}/logs")
async def get_container_logs(
    widget_id: int,
    request: ContainerLogsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get logs from a Docker container."""
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.widget_type == "docker",
    ).first()

    if not widget:
        raise HTTPException(status_code=404, detail="Docker widget not found")

    service = _get_docker_service(db, widget)

    try:
        result = await service.get_container_logs(request.container_name, request.lines)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to get logs"))
        return result
    finally:
        await service.close()
