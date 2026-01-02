from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # 2FA
    totp_secret = Column(String(32), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    recovery_codes = Column(Text, nullable=True)  # JSON array of hashed codes

    # Status
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)  # Requires admin approval

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    notification_channels = relationship("NotificationChannel", back_populates="user", cascade="all, delete-orphan")
    alert_rules = relationship("AlertRule", back_populates="user", cascade="all, delete-orphan")
