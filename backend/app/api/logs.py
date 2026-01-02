"""
API endpoints for Docker container logs widget.
Supports server_id for centralized connection management.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.widget import Widget
from app.services.logs_service import LogsService, fetch_logs_data
from app.services.server_connection import merge_server_config

router = APIRouter(prefix="/logs", tags=["logs"])


class ContainersRequest(BaseModel):
    """Request model for listing containers."""
    host: str = ""
    ssh_port: int = 22
    ssh_user: str = "root"
    ssh_key: str = ""
    ssh_password: str = ""
    server_id: Optional[int] = None


def _get_logs_service(db: Session, config: dict) -> LogsService:
    """Create LogsService from config, supporting server_id."""
    merged = merge_server_config(db, config)
    return LogsService(
        host=merged.get("host", ""),
        ssh_port=merged.get("ssh_port", 22),
        ssh_user=merged.get("ssh_user", "root"),
        ssh_key=merged.get("ssh_key", ""),
        ssh_password=merged.get("ssh_password", ""),
    )


@router.get("/widget/{widget_id}/data")
async def get_logs_widget_data(
    widget_id: int,
    container: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get logs for a widget by its ID.
    Supports server_id for centralized credentials.
    The container parameter allows dynamic container selection from the frontend.
    """
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget non trouvé")

    if widget.widget_type != "logs":
        raise HTTPException(status_code=400, detail="Ce widget n'est pas un widget de logs")

    config = dict(widget.config or {})
    # Merge server credentials if server_id is provided
    config = merge_server_config(db, config)

    # Override container name if provided in query parameter
    if container:
        config["container_name"] = container

    result = await fetch_logs_data(config)
    return result


@router.post("/widget/{widget_id}/refresh")
async def refresh_logs(
    widget_id: int,
    max_lines: Optional[int] = None,
    filter_pattern: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Refresh logs for a widget with optional override parameters.
    Useful for changing filter or line count on-the-fly.
    """
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget non trouvé")

    if widget.widget_type != "logs":
        raise HTTPException(status_code=400, detail="Ce widget n'est pas un widget de logs")

    config = dict(widget.config or {})
    # Merge server credentials if server_id is provided
    config = merge_server_config(db, config)

    # Override with request parameters if provided
    if max_lines is not None:
        config["max_lines"] = max_lines
    if filter_pattern is not None:
        config["filter_pattern"] = filter_pattern

    result = await fetch_logs_data(config)
    return result


@router.post("/containers")
async def list_available_containers(
    request: ContainersRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List available containers on a host.
    Used for container selection in widget configuration.
    Supports server_id for centralized credentials.
    """
    # Build config from request
    config = {
        "host": request.host,
        "ssh_port": request.ssh_port,
        "ssh_user": request.ssh_user,
        "ssh_key": request.ssh_key,
        "ssh_password": request.ssh_password,
        "server_id": request.server_id,
    }

    # Merge server credentials if server_id is provided
    merged = merge_server_config(db, config)
    host = merged.get("host", "")

    if not host:
        raise HTTPException(status_code=400, detail="Hôte requis (ou server_id)")

    service = LogsService(
        host=host,
        ssh_port=merged.get("ssh_port", 22),
        ssh_user=merged.get("ssh_user", "root"),
        ssh_key=merged.get("ssh_key", ""),
        ssh_password=merged.get("ssh_password", ""),
    )

    try:
        containers = await service.list_containers()
        return {
            "success": True,
            "containers": containers,
            "host": host,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "containers": [],
        }
    finally:
        await service.close()


@router.get("/widget/{widget_id}/containers")
async def get_widget_containers(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List available containers for a widget's configured host.
    Used for container selection dropdown.
    Supports server_id for centralized credentials.
    """
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget non trouvé")

    config = widget.config or {}
    # Merge server credentials if server_id is provided
    merged = merge_server_config(db, config)
    host = merged.get("host", "")

    if not host:
        return {"success": False, "error": "Hôte non configuré", "containers": []}

    service = LogsService(
        host=host,
        ssh_port=merged.get("ssh_port", 22),
        ssh_user=merged.get("ssh_user", "root"),
        ssh_key=merged.get("ssh_key", ""),
        ssh_password=merged.get("ssh_password", ""),
    )

    try:
        containers = await service.list_containers()
        return {
            "success": True,
            "containers": containers,
            "host": host,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "containers": [],
        }
    finally:
        await service.close()
