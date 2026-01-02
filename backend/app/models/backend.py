"""
Backend model for storing detected backend servers from reverse proxy configurations.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func

from app.core.database import Base


class Backend(Base):
    """
    Represents a backend server detected from NPM reverse proxy configurations.
    Groups applications by their target IP/hostname.
    """
    __tablename__ = "backends"

    id = Column(Integer, primary_key=True, index=True)

    # Backend identification
    hostname = Column(String(255), nullable=False, index=True)  # IP or hostname
    display_name = Column(String(100), nullable=True)  # User-friendly name

    # Network info
    ip_address = Column(String(45), nullable=True)  # Resolved IP (IPv4 or IPv6)

    # Metadata
    icon = Column(String(50), nullable=True)  # Icon for display
    color = Column(String(20), nullable=True)  # Color for schema visualization
    description = Column(Text, nullable=True)

    # Status
    is_online = Column(Boolean, default=False)
    last_check = Column(DateTime(timezone=True), nullable=True)

    # Position for schema layout (user can drag to reposition)
    position_x = Column(Integer, nullable=True)
    position_y = Column(Integer, nullable=True)

    # Additional info from detection
    extra_info = Column(JSON, nullable=True)  # Ports used, services detected, etc.

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
