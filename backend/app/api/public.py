"""
Public API routes - No authentication required.
Provides read-only access to public data for integrations.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from pydantic import BaseModel

from app.core.database import get_db
from app.models import Application, Category, Server, Backend, NpmInstance, Widget

router = APIRouter(prefix="/public", tags=["Public API"])


# ============== Response Models ==============

class PublicApplicationResponse(BaseModel):
    """Public application data."""
    id: int
    name: str
    url: str
    icon: Optional[str] = None
    description: Optional[str] = None
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    detected_type: Optional[str] = None
    forward_host: Optional[str] = None
    forward_port: Optional[int] = None

    class Config:
        from_attributes = True


class PublicCategoryResponse(BaseModel):
    """Public category data."""
    id: int
    slug: str
    name: str
    icon: Optional[str] = None
    order: int
    app_count: int = 0

    class Config:
        from_attributes = True


class InfraNodeResponse(BaseModel):
    """Infrastructure node for mapping."""
    id: str
    type: str  # npm, backend, server
    name: str
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_online: Optional[bool] = None
    position: Optional[Dict[str, float]] = None
    metadata: Dict[str, Any] = {}


class InfraLinkResponse(BaseModel):
    """Infrastructure link between nodes."""
    source: str
    target: str
    type: str  # proxy, ssh, docker
    metadata: Dict[str, Any] = {}


class InfraMapResponse(BaseModel):
    """Complete infrastructure map data."""
    nodes: List[InfraNodeResponse]
    links: List[InfraLinkResponse]
    stats: Dict[str, int]


# ============== Schemas Import ==============

from app.schemas import ApplicationWithCategory, CategoryResponse


@router.get("/applications", response_model=List[ApplicationWithCategory])
async def list_public_applications(
    category: Optional[str] = Query(None, description="Filter by category slug"),
    db: Session = Depends(get_db)
):
    """List all public applications (no auth required).

    An application is public if:
    - It is marked as is_public=True, OR
    - Its category is marked as is_public=True
    """
    query = db.query(Application).options(joinedload(Application.category))

    # Join with Category to check category's is_public status
    query = query.outerjoin(Category, Application.category_id == Category.id)

    # Show visible apps that are either public themselves OR belong to a public category
    query = query.filter(
        Application.is_visible == True,
        or_(
            Application.is_public == True,
            Category.is_public == True
        )
    )

    if category:
        query = query.filter(Category.slug == category)

    applications = query.order_by(Application.display_order, Application.name).all()
    return applications


@router.get("/categories", response_model=List[CategoryResponse])
async def list_public_categories(
    db: Session = Depends(get_db)
):
    """List all public categories (no auth required)."""
    categories = db.query(Category).filter(
        Category.is_public == True
    ).order_by(Category.order, Category.name).all()
    return categories


@router.get("/dashboard")
async def get_public_dashboard(
    db: Session = Depends(get_db)
):
    """Get complete public dashboard data (categories with their applications).

    An application is public if:
    - It is marked as is_public=True, OR
    - Its category is marked as is_public=True
    """
    # Get public applications with their categories
    # Join with Category to check category's is_public status
    applications = db.query(Application).options(
        joinedload(Application.category)
    ).outerjoin(
        Category, Application.category_id == Category.id
    ).filter(
        Application.is_visible == True,
        or_(
            Application.is_public == True,
            Category.is_public == True
        )
    ).order_by(Application.display_order, Application.name).all()

    # Group applications by their actual category (from the app's relationship)
    # This way apps show under their real category, not just "public" categories
    categories_dict = {}
    uncategorized_apps = []

    for app in applications:
        if app.category:
            cat_id = app.category.id
            if cat_id not in categories_dict:
                categories_dict[cat_id] = {
                    "category": {
                        "id": app.category.id,
                        "slug": app.category.slug,
                        "name": app.category.name,
                        "icon": app.category.icon,
                        "order": app.category.order,
                        "is_public": app.category.is_public
                    },
                    "applications": []
                }
            categories_dict[cat_id]["applications"].append(app)
        else:
            uncategorized_apps.append(app)

    # Sort categories by order
    result = sorted(categories_dict.values(), key=lambda x: (x["category"]["order"] or 0, x["category"]["name"]))

    # Add uncategorized apps at the end
    if uncategorized_apps:
        result.append({
            "category": {
                "id": None,
                "slug": "uncategorized",
                "name": "Autres",
                "icon": "mdi:apps",
                "order": 999,
                "is_public": True
            },
            "applications": uncategorized_apps
        })

    return {
        "categories": result,
        "total_applications": len(applications)
    }


# ============== Infrastructure Map API ==============

@router.get("/infrastructure/map", response_model=InfraMapResponse)
async def get_infrastructure_map(
    include_offline: bool = Query(True, description="Include offline nodes"),
    db: Session = Depends(get_db)
):
    """Get infrastructure map data for visualization (no auth required).

    Returns nodes (NPM instances, backends, servers) and links between them.
    Designed for use with external visualization tools like Infra Mapper.
    """
    nodes: List[InfraNodeResponse] = []
    links: List[InfraLinkResponse] = []

    # Get all NPM instances
    npm_query = db.query(NpmInstance)
    if not include_offline:
        npm_query = npm_query.filter(NpmInstance.is_online == True)
    npm_instances = npm_query.filter(NpmInstance.is_active == True).all()

    for npm in npm_instances:
        nodes.append(InfraNodeResponse(
            id=f"npm-{npm.id}",
            type="npm",
            name=npm.name,
            hostname=npm.db_host or npm.api_url,
            ip_address=None,
            icon="IconBrandNpm",
            color="#D83A34",
            is_online=npm.is_online,
            position=None,
            metadata={
                "connection_mode": npm.connection_mode,
                "is_degraded": npm.is_degraded,
                "last_synced": npm.last_synced_at.isoformat() if npm.last_synced_at else None,
                "priority": npm.priority
            }
        ))

    # Get all servers
    server_query = db.query(Server)
    if not include_offline:
        server_query = server_query.filter(Server.is_online == True)
    servers = server_query.all()

    for server in servers:
        nodes.append(InfraNodeResponse(
            id=f"server-{server.id}",
            type="server",
            name=server.name,
            hostname=server.host,
            ip_address=None,
            icon=server.icon or "IconServer",
            color="#4CAF50",
            is_online=server.is_online,
            position=None,
            metadata={
                "description": server.description,
                "ssh_port": server.ssh_port,
                "ssh_user": server.ssh_user,
                "has_docker": server.has_docker,
                "has_proxmox": server.has_proxmox,
                "last_check": server.last_check.isoformat() if server.last_check else None,
                "last_error": server.last_error
            }
        ))

    # Get all backends
    backend_query = db.query(Backend)
    if not include_offline:
        backend_query = backend_query.filter(Backend.is_online == True)
    backends = backend_query.all()

    for backend in backends:
        nodes.append(InfraNodeResponse(
            id=f"backend-{backend.id}",
            type="backend",
            name=backend.display_name or backend.hostname,
            hostname=backend.hostname,
            ip_address=backend.ip_address,
            icon=backend.icon or "IconDeviceDesktop",
            color=backend.color or "#2196F3",
            is_online=backend.is_online,
            position={
                "x": float(backend.position_x) if backend.position_x else None,
                "y": float(backend.position_y) if backend.position_y else None
            } if backend.position_x or backend.position_y else None,
            metadata={
                "description": backend.description,
                "extra_info": backend.extra_info,
                "last_check": backend.last_check.isoformat() if backend.last_check else None
            }
        ))

    # Get applications to build links between NPM and backends
    applications = db.query(Application).filter(
        Application.is_visible == True,
        Application.npm_instance_id.isnot(None),
        Application.forward_host.isnot(None)
    ).all()

    # Build links: NPM -> Backend (based on forward_host matching)
    backend_hosts = {b.hostname.lower(): b.id for b in backends}
    backend_ips = {b.ip_address: b.id for b in backends if b.ip_address}

    for app in applications:
        npm_node_id = f"npm-{app.npm_instance_id}"
        forward_host = app.forward_host.lower() if app.forward_host else None

        # Find matching backend
        backend_id = None
        if forward_host:
            if forward_host in backend_hosts:
                backend_id = backend_hosts[forward_host]
            elif forward_host in backend_ips:
                backend_id = backend_ips[forward_host]

        if backend_id:
            backend_node_id = f"backend-{backend_id}"
            # Avoid duplicate links
            link_key = (npm_node_id, backend_node_id)
            existing_links = {(l.source, l.target) for l in links}
            if link_key not in existing_links:
                links.append(InfraLinkResponse(
                    source=npm_node_id,
                    target=backend_node_id,
                    type="proxy",
                    metadata={
                        "app_count": len([a for a in applications
                                         if a.npm_instance_id == app.npm_instance_id
                                         and a.forward_host and a.forward_host.lower() == forward_host])
                    }
                ))

    # Calculate stats
    stats = {
        "total_nodes": len(nodes),
        "npm_instances": len([n for n in nodes if n.type == "npm"]),
        "servers": len([n for n in nodes if n.type == "server"]),
        "backends": len([n for n in nodes if n.type == "backend"]),
        "total_links": len(links),
        "online_nodes": len([n for n in nodes if n.is_online]),
        "offline_nodes": len([n for n in nodes if not n.is_online])
    }

    return InfraMapResponse(
        nodes=nodes,
        links=links,
        stats=stats
    )


@router.get("/infrastructure/nodes")
async def list_infrastructure_nodes(
    node_type: Optional[str] = Query(None, description="Filter by node type: npm, server, backend"),
    online_only: bool = Query(False, description="Only return online nodes"),
    db: Session = Depends(get_db)
):
    """List infrastructure nodes with optional filtering."""
    nodes = []

    # NPM instances
    if node_type is None or node_type == "npm":
        npm_query = db.query(NpmInstance).filter(NpmInstance.is_active == True)
        if online_only:
            npm_query = npm_query.filter(NpmInstance.is_online == True)
        for npm in npm_query.all():
            nodes.append({
                "id": f"npm-{npm.id}",
                "type": "npm",
                "name": npm.name,
                "is_online": npm.is_online,
                "hostname": npm.db_host or npm.api_url
            })

    # Servers
    if node_type is None or node_type == "server":
        server_query = db.query(Server)
        if online_only:
            server_query = server_query.filter(Server.is_online == True)
        for server in server_query.all():
            nodes.append({
                "id": f"server-{server.id}",
                "type": "server",
                "name": server.name,
                "is_online": server.is_online,
                "hostname": server.host
            })

    # Backends
    if node_type is None or node_type == "backend":
        backend_query = db.query(Backend)
        if online_only:
            backend_query = backend_query.filter(Backend.is_online == True)
        for backend in backend_query.all():
            nodes.append({
                "id": f"backend-{backend.id}",
                "type": "backend",
                "name": backend.display_name or backend.hostname,
                "is_online": backend.is_online,
                "hostname": backend.hostname,
                "ip_address": backend.ip_address
            })

    return {
        "nodes": nodes,
        "total": len(nodes)
    }


@router.get("/infrastructure/stats")
async def get_infrastructure_stats(
    db: Session = Depends(get_db)
):
    """Get infrastructure statistics."""
    # Count by type and status
    npm_total = db.query(func.count(NpmInstance.id)).filter(NpmInstance.is_active == True).scalar()
    npm_online = db.query(func.count(NpmInstance.id)).filter(
        NpmInstance.is_active == True, NpmInstance.is_online == True
    ).scalar()

    server_total = db.query(func.count(Server.id)).scalar()
    server_online = db.query(func.count(Server.id)).filter(Server.is_online == True).scalar()

    backend_total = db.query(func.count(Backend.id)).scalar()
    backend_online = db.query(func.count(Backend.id)).filter(Backend.is_online == True).scalar()

    app_total = db.query(func.count(Application.id)).scalar()
    app_visible = db.query(func.count(Application.id)).filter(Application.is_visible == True).scalar()
    app_public = db.query(func.count(Application.id)).filter(Application.is_public == True).scalar()

    return {
        "npm_instances": {
            "total": npm_total,
            "online": npm_online,
            "offline": npm_total - npm_online
        },
        "servers": {
            "total": server_total,
            "online": server_online,
            "offline": server_total - server_online
        },
        "backends": {
            "total": backend_total,
            "online": backend_online,
            "offline": backend_total - backend_online
        },
        "applications": {
            "total": app_total,
            "visible": app_visible,
            "public": app_public
        },
        "summary": {
            "total_nodes": npm_total + server_total + backend_total,
            "online_nodes": npm_online + server_online + backend_online,
            "health_percentage": round(
                ((npm_online + server_online + backend_online) / max(npm_total + server_total + backend_total, 1)) * 100,
                1
            )
        }
    }
