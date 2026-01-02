"""
Schemas for infrastructure visualization.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class NodePosition(BaseModel):
    """Position of a node in the schema."""
    node_type: str  # 'npm', 'backend', 'app'
    node_id: int
    position_x: float
    position_y: float


class SaveLayoutRequest(BaseModel):
    """Request to save layout positions."""
    positions: List[NodePosition]


class SaveLayoutResponse(BaseModel):
    """Response after saving layout."""
    saved_count: int
    message: str


class BackendBase(BaseModel):
    """Base backend schema."""
    hostname: str
    display_name: Optional[str] = None
    ip_address: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class BackendCreate(BackendBase):
    """Schema for creating a backend."""
    pass


class BackendUpdate(BaseModel):
    """Schema for updating a backend."""
    display_name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class BackendResponse(BackendBase):
    """Backend response with full info."""
    id: int
    is_online: bool
    last_check: Optional[datetime]
    extra_info: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApplicationInSchema(BaseModel):
    """Minimal application info for schema display."""
    id: int
    name: str
    url: str
    icon: Optional[str] = None
    is_visible: bool
    forward_host: Optional[str] = None
    forward_port: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class BackendWithApps(BackendResponse):
    """Backend with associated applications."""
    applications: List[ApplicationInSchema] = []
    ports: List[int] = []  # Unique ports used on this backend


class NpmInstanceInSchema(BaseModel):
    """NPM instance info for schema display."""
    id: int
    name: str
    is_active: bool
    connection_mode: str
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class InfrastructureSchema(BaseModel):
    """
    Complete infrastructure schema for visualization.
    Shows NPM instances -> Backends -> Applications relationships.
    """
    npm_instances: List[NpmInstanceInSchema]
    backends: List[BackendWithApps]
    # Direct links: npm_instance_id -> list of backend hostnames
    links: Dict[int, List[str]]
    # Statistics
    stats: Dict[str, Any]
    last_updated: datetime
