from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class TabSubscription(Base):
    """
    Tracks which users have subscribed to shared tabs.
    Users must explicitly subscribe to see shared tabs from other users.
    """
    __tablename__ = "tab_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tab_id = Column(Integer, ForeignKey("tabs.id", ondelete="CASCADE"), nullable=False)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="tab_subscriptions")
    tab = relationship("Tab", backref="subscriptions")

    # Ensure a user can only subscribe to a tab once
    __table_args__ = (
        UniqueConstraint('user_id', 'tab_id', name='unique_user_tab_subscription'),
    )
