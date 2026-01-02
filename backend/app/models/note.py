"""
Note model for the Notes/Memo widget.
Supports local notes stored in database and Nextcloud Notes integration.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Note(Base):
    """Local note stored in the database."""
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)

    # Link to widget (each widget can have multiple notes)
    widget_id = Column(Integer, ForeignKey("widgets.id", ondelete="CASCADE"), nullable=False, index=True)

    # Note content
    title = Column(String(500), nullable=False, default="")
    content = Column(Text, nullable=False, default="")

    # Note metadata
    color = Column(String(20), nullable=True)  # Color code for visual organization
    is_pinned = Column(Boolean, default=False)  # Pinned notes appear first
    is_archived = Column(Boolean, default=False)  # Archived notes are hidden by default

    # Position for ordering
    position = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NextcloudNotesConfig(Base):
    """Configuration for Nextcloud Notes integration per widget."""
    __tablename__ = "nextcloud_notes_configs"

    id = Column(Integer, primary_key=True, index=True)

    # Link to widget (one config per widget)
    widget_id = Column(Integer, ForeignKey("widgets.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Nextcloud connection settings
    nextcloud_url = Column(String(500), nullable=False)  # Base URL of Nextcloud instance
    username = Column(String(200), nullable=False)
    password = Column(String(500), nullable=False)  # Should be encrypted in production

    # Optional settings
    category = Column(String(200), nullable=True)  # Filter by category

    # Cache for last sync
    last_sync_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
