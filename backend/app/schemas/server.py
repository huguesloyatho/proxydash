"""
Pydantic schemas for Server CRUD operations.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ServerBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    host: str
    ssh_port: int = 22
    ssh_user: str = "root"
    has_docker: bool = False
    has_proxmox: bool = False


class ServerCreate(ServerBase):
    ssh_key: Optional[str] = None
    ssh_password: Optional[str] = None


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    host: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_user: Optional[str] = None
    ssh_key: Optional[str] = None
    ssh_password: Optional[str] = None
    has_docker: Optional[bool] = None
    has_proxmox: Optional[bool] = None


class ServerResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    host: str
    ssh_port: int
    ssh_user: str
    has_docker: bool
    has_proxmox: bool
    is_online: bool
    last_check: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ServerTestResult(BaseModel):
    success: bool
    message: str
    has_docker: Optional[bool] = None
    docker_version: Optional[str] = None
    containers_count: Optional[int] = None
