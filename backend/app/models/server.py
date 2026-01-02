"""
Server model for reusable SSH connections.
Widgets can reference a server instead of duplicating SSH credentials.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)

    # Server identification
    name = Column(String(100), nullable=False)  # e.g., "docker-one", "OVH-VPS"
    description = Column(String(500), nullable=True)  # Optional description
    icon = Column(String(100), nullable=True)  # Icon name (e.g., "IconServer")

    # Connection details
    host = Column(String(255), nullable=False)  # IP or hostname
    ssh_port = Column(Integer, default=22)
    ssh_user = Column(String(100), default="root")

    # Authentication (key or password)
    ssh_key = Column(Text, nullable=True)  # Private key content (PEM format)
    ssh_password = Column(String(255), nullable=True)  # Password (if no key)

    # Optional features
    has_docker = Column(Boolean, default=False)  # Server has Docker installed
    has_proxmox = Column(Boolean, default=False)  # Server is a Proxmox node

    # Status (updated on connection test)
    is_online = Column(Boolean, default=True)
    last_check = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
