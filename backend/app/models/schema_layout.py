"""
Schema layout model for storing node positions in the infrastructure visualization.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class SchemaLayout(Base):
    """
    Stores the position of nodes in the infrastructure schema visualization.
    Supports different node types: npm, backend, app.
    """
    __tablename__ = "schema_layouts"

    id = Column(Integer, primary_key=True, index=True)

    # Node identification
    node_type = Column(String(20), nullable=False, index=True)  # 'npm', 'backend', 'app'
    node_id = Column(Integer, nullable=False, index=True)  # ID of the npm/backend/app

    # Position
    position_x = Column(Float, nullable=False, default=0)
    position_y = Column(Float, nullable=False, default=0)

    # User who saved this layout (optional, for multi-user support)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    class Config:
        # Unique constraint on node_type + node_id + user_id
        __table_args__ = (
            # Index for quick lookups
        )
