"""
Infrastructure API routes for schema visualization.
Provides data about backends, applications, and their relationships.
"""

import socket
import logging
from typing import List, Dict, Any
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models import Application, NpmInstance, Backend, User, SchemaLayout
from app.schemas.infrastructure import (
    BackendResponse, BackendUpdate, BackendWithApps,
    ApplicationInSchema, NpmInstanceInSchema, InfrastructureSchema,
    SaveLayoutRequest, SaveLayoutResponse
)
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/infrastructure", tags=["Infrastructure"])


def resolve_hostname(hostname: str) -> str | None:
    """Try to resolve a hostname to an IP address."""
    try:
        return socket.gethostbyname(hostname)
    except socket.gaierror:
        return None


def extract_backends_from_applications(db: Session) -> Dict[str, Dict[str, Any]]:
    """
    Extract unique backends from applications' forward_host.
    Returns a dict mapping hostname -> backend info.
    """
    backends: Dict[str, Dict[str, Any]] = {}

    # Get all applications with forward_host
    apps = db.query(Application).filter(
        Application.forward_host != None,
        Application.forward_host != ""
    ).all()

    for app in apps:
        host = app.forward_host.strip()
        if not host:
            continue

        if host not in backends:
            # Try to resolve IP
            ip = None
            if not host.replace(".", "").isdigit():  # Not already an IP
                ip = resolve_hostname(host)
            else:
                ip = host

            backends[host] = {
                "hostname": host,
                "ip_address": ip,
                "applications": [],
                "ports": set(),
                "npm_instances": set(),
            }

        backends[host]["applications"].append(app)
        if app.forward_port:
            backends[host]["ports"].add(app.forward_port)
        if app.npm_instance_id:
            backends[host]["npm_instances"].add(app.npm_instance_id)

    return backends


def sync_backends_to_db(db: Session, detected_backends: Dict[str, Dict[str, Any]]) -> List[Backend]:
    """
    Sync detected backends to the database.
    Creates new ones, updates existing, and returns the list.
    """
    result = []

    for hostname, info in detected_backends.items():
        # Check if backend exists
        backend = db.query(Backend).filter(Backend.hostname == hostname).first()

        if not backend:
            # Create new backend
            backend = Backend(
                hostname=hostname,
                ip_address=info["ip_address"],
                display_name=hostname,
                is_online=True,  # We'll check status separately
            )
            db.add(backend)
            logger.info(f"Created backend: {hostname}")

        else:
            # Update IP if changed
            if info["ip_address"] and backend.ip_address != info["ip_address"]:
                backend.ip_address = info["ip_address"]

        result.append(backend)

    db.commit()
    return result


def get_saved_positions(db: Session, user_id: int) -> Dict[str, Dict[int, tuple]]:
    """
    Get all saved positions from the database.
    Returns a dict like: {'npm': {1: (x, y)}, 'backend': {2: (x, y)}, 'app': {3: (x, y)}}
    """
    layouts = db.query(SchemaLayout).filter(
        (SchemaLayout.user_id == user_id) | (SchemaLayout.user_id == None)
    ).all()

    positions: Dict[str, Dict[int, tuple]] = {'npm': {}, 'backend': {}, 'app': {}}
    for layout in layouts:
        positions[layout.node_type][layout.node_id] = (layout.position_x, layout.position_y)

    return positions


@router.get("/schema", response_model=InfrastructureSchema)
async def get_infrastructure_schema(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the complete infrastructure schema for visualization.
    Shows NPM instances, backends, and applications relationships.
    """
    # Get saved positions
    saved_positions = get_saved_positions(db, current_user.id)

    # Get all active NPM instances
    npm_instances = db.query(NpmInstance).filter(
        NpmInstance.is_active == True
    ).order_by(NpmInstance.priority).all()

    npm_list = []
    for inst in npm_instances:
        pos = saved_positions['npm'].get(inst.id)
        npm_list.append(NpmInstanceInSchema(
            id=inst.id,
            name=inst.name,
            is_active=inst.is_active,
            connection_mode=inst.connection_mode,
            position_x=pos[0] if pos else None,
            position_y=pos[1] if pos else None
        ))

    # Extract backends from applications
    detected_backends = extract_backends_from_applications(db)

    # Sync to database
    sync_backends_to_db(db, detected_backends)

    # Build response with applications grouped by backend
    backends_response: List[BackendWithApps] = []
    links: Dict[int, List[str]] = defaultdict(list)

    for hostname, info in detected_backends.items():
        # Get backend from DB for metadata
        backend = db.query(Backend).filter(Backend.hostname == hostname).first()

        # Build apps list with saved positions
        apps_list = []
        for app in info["applications"]:
            app_pos = saved_positions['app'].get(app.id)
            apps_list.append(ApplicationInSchema(
                id=app.id,
                name=app.name,
                url=app.url,
                icon=app.icon,
                is_visible=app.is_visible,
                forward_host=app.forward_host,
                forward_port=app.forward_port,
                position_x=app_pos[0] if app_pos else None,
                position_y=app_pos[1] if app_pos else None
            ))

        # Get backend position from saved positions or from database
        backend_pos = saved_positions['backend'].get(backend.id if backend else 0)

        backend_resp = BackendWithApps(
            id=backend.id if backend else 0,
            hostname=hostname,
            display_name=backend.display_name if backend else hostname,
            ip_address=info["ip_address"],
            icon=backend.icon if backend else None,
            color=backend.color if backend else None,
            description=backend.description if backend else None,
            position_x=backend_pos[0] if backend_pos else (backend.position_x if backend else None),
            position_y=backend_pos[1] if backend_pos else (backend.position_y if backend else None),
            is_online=backend.is_online if backend else True,
            last_check=backend.last_check if backend else None,
            extra_info=backend.extra_info if backend else None,
            created_at=backend.created_at if backend else datetime.utcnow(),
            updated_at=backend.updated_at if backend else None,
            applications=apps_list,
            ports=sorted(list(info["ports"]))
        )
        backends_response.append(backend_resp)

        # Build links: NPM instance -> backend hostname
        for npm_id in info["npm_instances"]:
            if hostname not in links[npm_id]:
                links[npm_id].append(hostname)

    # Calculate stats
    total_apps = db.query(func.count(Application.id)).filter(
        Application.forward_host != None
    ).scalar()

    stats = {
        "npm_instances_count": len(npm_instances),
        "backends_count": len(backends_response),
        "applications_count": total_apps,
        "unique_ports": len(set(
            port
            for info in detected_backends.values()
            for port in info["ports"]
        )),
    }

    return InfrastructureSchema(
        npm_instances=npm_list,
        backends=backends_response,
        links=dict(links),
        stats=stats,
        last_updated=datetime.utcnow()
    )


@router.get("/backends", response_model=List[BackendResponse])
async def list_backends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all detected backends."""
    backends = db.query(Backend).order_by(Backend.hostname).all()
    return backends


@router.patch("/backends/{backend_id}", response_model=BackendResponse)
async def update_backend(
    backend_id: int,
    data: BackendUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update backend metadata (display name, icon, color, position, etc.).
    Only admins can update backends.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Droits administrateur requis"
        )

    backend = db.query(Backend).filter(Backend.id == backend_id).first()
    if not backend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backend non trouvé"
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(backend, field, value)

    db.commit()
    db.refresh(backend)
    return backend


@router.post("/refresh")
async def refresh_infrastructure(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Force a refresh of the infrastructure data.
    This triggers an NPM sync and updates backend detection.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Droits administrateur requis"
        )

    from app.services.npm_sync import sync_all_npm_instances

    # Run sync
    stats = await sync_all_npm_instances(db, use_ollama=False)

    # Re-extract backends
    detected_backends = extract_backends_from_applications(db)
    sync_backends_to_db(db, detected_backends)

    return {
        "message": "Infrastructure rafraîchie",
        "sync_stats": stats,
        "backends_detected": len(detected_backends)
    }


@router.post("/layout", response_model=SaveLayoutResponse)
async def save_layout(
    data: SaveLayoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save the positions of all nodes in the schema.
    This allows users to customize their infrastructure layout.
    """
    saved_count = 0

    for pos in data.positions:
        # Find existing layout or create new
        layout = db.query(SchemaLayout).filter(
            SchemaLayout.node_type == pos.node_type,
            SchemaLayout.node_id == pos.node_id,
            (SchemaLayout.user_id == current_user.id) | (SchemaLayout.user_id == None)
        ).first()

        if layout:
            # Update existing
            layout.position_x = pos.position_x
            layout.position_y = pos.position_y
            layout.user_id = current_user.id
        else:
            # Create new
            layout = SchemaLayout(
                node_type=pos.node_type,
                node_id=pos.node_id,
                position_x=pos.position_x,
                position_y=pos.position_y,
                user_id=current_user.id
            )
            db.add(layout)

        saved_count += 1

    db.commit()

    return SaveLayoutResponse(
        saved_count=saved_count,
        message=f"{saved_count} position(s) sauvegardée(s)"
    )


@router.delete("/layout")
async def reset_layout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reset all saved positions for the current user.
    """
    deleted = db.query(SchemaLayout).filter(
        SchemaLayout.user_id == current_user.id
    ).delete()

    db.commit()

    return {
        "message": f"{deleted} position(s) supprimée(s)",
        "deleted_count": deleted
    }
