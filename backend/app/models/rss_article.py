"""
RSS Article model for storing feed articles and their read status.
Articles are kept for 6 months after being read (archived).
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Index
from app.core.database import Base


class RssArticle(Base):
    """
    Stores RSS articles with their read/unread status.
    - Unread articles are shown in the widget
    - Read articles are archived and kept for 6 months
    - widget_id links to the widget configuration (can be null for shared feeds)
    """
    __tablename__ = "rss_articles"

    id = Column(Integer, primary_key=True, index=True)

    # Widget association (nullable for shared feeds across tabs)
    widget_id = Column(Integer, nullable=True, index=True)

    # Article identification
    feed_url = Column(String(1024), nullable=False, index=True)
    article_guid = Column(String(512), nullable=False)  # Unique ID from feed
    article_url = Column(String(1024), nullable=True)   # Link to article

    # Article content
    title = Column(String(512), nullable=False)
    summary = Column(Text, nullable=True)
    author = Column(String(256), nullable=True)
    image_url = Column(String(1024), nullable=True)

    # Dates
    published_at = Column(DateTime, nullable=True)  # From feed
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Read status
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)  # When marked as read

    # Archive management
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    archived_at = Column(DateTime, nullable=True)

    # Composite index for efficient queries
    __table_args__ = (
        Index('ix_rss_articles_widget_feed', 'widget_id', 'feed_url'),
        Index('ix_rss_articles_guid_feed', 'feed_url', 'article_guid', unique=True),
        Index('ix_rss_articles_unread', 'widget_id', 'is_read', 'is_archived'),
    )

    def __repr__(self):
        return f"<RssArticle {self.id}: {self.title[:50]}...>"

    def mark_as_read(self):
        """Mark article as read and set read timestamp."""
        self.is_read = True
        self.read_at = datetime.utcnow()
        self.is_archived = True
        self.archived_at = datetime.utcnow()

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "widget_id": self.widget_id,
            "feed_url": self.feed_url,
            "article_guid": self.article_guid,
            "article_url": self.article_url,
            "title": self.title,
            "summary": self.summary,
            "author": self.author,
            "image_url": self.image_url,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "is_archived": self.is_archived,
        }
