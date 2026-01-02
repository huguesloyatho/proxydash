from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class NpmInstance(Base):
    __tablename__ = "npm_instances"

    id = Column(Integer, primary_key=True, index=True)

    # Instance identification
    name = Column(String(100), nullable=False)  # e.g., "Home", "OVH"

    # Connection mode: "database" or "api"
    connection_mode = Column(String(20), default="database")

    # Database connection (for connection_mode = "database")
    db_host = Column(String(255), nullable=True)
    db_port = Column(Integer, default=5432)
    db_name = Column(String(100), nullable=True)
    db_user = Column(String(100), nullable=True)
    db_password = Column(String(255), nullable=True)

    # API connection (for connection_mode = "api")
    api_url = Column(String(500), nullable=True)  # e.g., "https://npm.example.com"
    api_email = Column(String(255), nullable=True)
    api_password = Column(String(255), nullable=True)

    # Priority (lower = higher priority, apps from higher priority NPM are preferred)
    priority = Column(Integer, default=100)

    # Status
    is_active = Column(Boolean, default=True)
    is_online = Column(Boolean, default=True)  # Updated during sync
    is_degraded = Column(Boolean, default=False)  # True if using API mode (less info available)
    last_error = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
