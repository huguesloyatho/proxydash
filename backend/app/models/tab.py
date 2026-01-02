from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Tab(Base):
    __tablename__ = "tabs"

    id = Column(Integer, primary_key=True, index=True)

    # Basic info
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    icon = Column(String(50), nullable=True)  # Tabler icon name

    # Order for display
    position = Column(Integer, default=0)

    # Type: 'default' (auto dashboard), 'custom' (user-defined content)
    tab_type = Column(String(20), default='custom')

    # Content configuration for custom tabs
    # Can contain: widgets, bookmarks, embedded content, etc.
    content = Column(JSON, nullable=True)

    # Visibility
    is_visible = Column(Boolean, default=True)

    # Ownership and sharing
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null = system tab (default)
    is_public = Column(Boolean, default=False)  # If true, visible to all users

    # Relationship to owner
    owner = relationship("User", backref="tabs")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
