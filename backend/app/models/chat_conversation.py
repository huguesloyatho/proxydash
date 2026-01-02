from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChatConversation(Base):
    """Chat conversation storage."""
    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="Nouvelle conversation")
    model = Column(String(100), nullable=True)  # Model used for this conversation
    messages = Column(JSON, nullable=False, default=list)  # List of {role, content, timestamp}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationship
    user = relationship("User", backref="chat_conversations")
