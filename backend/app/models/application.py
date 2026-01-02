from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)

    # NPM reference
    npm_instance_id = Column(Integer, ForeignKey("npm_instances.id"), nullable=True)
    npm_instance = relationship("NpmInstance")
    npm_proxy_id = Column(Integer, nullable=True, index=True)  # Unique per instance, not globally

    # Basic info
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    icon = Column(String(200), nullable=True)  # Dashboard Icons name or URL
    description = Column(Text, nullable=True)

    # Detection
    detected_type = Column(String(100), nullable=True)  # e.g., "nextcloud", "plex"

    # Category
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    category = relationship("Category")

    # Status
    is_visible = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # True if visible on public dashboard (no auth)
    is_manual = Column(Boolean, default=False)  # True if manually added (not from NPM)
    is_authelia_protected = Column(Boolean, default=False)  # True if protected by Authelia

    # Order for manual sorting
    display_order = Column(Integer, default=0)

    # Backend info (from NPM forward settings)
    forward_host = Column(String(255), nullable=True)  # Target host/IP
    forward_port = Column(Integer, nullable=True)  # Target port
    forward_scheme = Column(String(10), nullable=True)  # http or https

    # Override flags (user has customized these fields)
    name_override = Column(Boolean, default=False)
    icon_override = Column(Boolean, default=False)
    description_override = Column(Boolean, default=False)
    category_override = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
