"""
RSS Service for fetching and parsing RSS/Atom feeds.
"""

import feedparser
import httpx
import ssl
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from time import mktime
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.rss_article import RssArticle

logger = logging.getLogger(__name__)

# Create SSL context that doesn't verify certificates (for dev/self-signed)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE


class RssService:
    """Service for managing RSS feeds and articles."""

    @staticmethod
    def parse_feed(feed_url: str, timeout: int = 10) -> Dict[str, Any]:
        """
        Parse an RSS/Atom feed and return structured data.

        Args:
            feed_url: URL of the RSS feed
            timeout: Request timeout in seconds

        Returns:
            Dict with feed info and entries
        """
        try:
            # Use httpx to fetch the feed content (handles SSL better)
            try:
                with httpx.Client(verify=False, timeout=timeout, follow_redirects=True) as client:
                    response = client.get(feed_url, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; DashboardRSS/1.0)'
                    })
                    response.raise_for_status()
                    feed_content = response.text
            except Exception as fetch_error:
                logger.warning(f"HTTP fetch error for {feed_url}: {fetch_error}")
                return {
                    "success": False,
                    "error": f"Fetch error: {str(fetch_error)}",
                    "entries": []
                }

            # Parse the fetched content
            feed = feedparser.parse(feed_content)

            if feed.bozo and not feed.entries:
                logger.warning(f"Feed parsing error for {feed_url}: {feed.bozo_exception}")
                return {
                    "success": False,
                    "error": str(feed.bozo_exception) if feed.bozo_exception else "Feed parsing error",
                    "entries": []
                }

            entries = []
            for entry in feed.entries:
                # Parse publication date
                published = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published = datetime.fromtimestamp(mktime(entry.published_parsed))
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    published = datetime.fromtimestamp(mktime(entry.updated_parsed))

                # Get image URL from various possible sources
                image_url = None
                if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
                    image_url = entry.media_thumbnail[0].get('url')
                elif hasattr(entry, 'media_content') and entry.media_content:
                    for media in entry.media_content:
                        if media.get('medium') == 'image' or media.get('type', '').startswith('image/'):
                            image_url = media.get('url')
                            break
                elif hasattr(entry, 'enclosures') and entry.enclosures:
                    for enc in entry.enclosures:
                        if enc.get('type', '').startswith('image/'):
                            image_url = enc.get('href') or enc.get('url')
                            break

                # Get GUID (unique identifier)
                guid = entry.get('id') or entry.get('guid') or entry.get('link') or entry.get('title')

                # Get summary/description
                summary = None
                if hasattr(entry, 'summary'):
                    summary = entry.summary
                elif hasattr(entry, 'description'):
                    summary = entry.description

                # Clean up summary (remove HTML if too long)
                if summary and len(summary) > 500:
                    # Basic HTML stripping
                    import re
                    summary = re.sub(r'<[^>]+>', '', summary)
                    summary = summary[:500] + "..."

                entries.append({
                    "guid": guid,
                    "title": entry.get('title', 'Sans titre'),
                    "link": entry.get('link'),
                    "summary": summary,
                    "author": entry.get('author'),
                    "published": published,
                    "image_url": image_url,
                })

            return {
                "success": True,
                "feed_title": feed.feed.get('title', 'Unknown Feed'),
                "feed_link": feed.feed.get('link'),
                "entries": entries
            }

        except Exception as e:
            logger.error(f"Error fetching feed {feed_url}: {e}")
            return {
                "success": False,
                "error": str(e),
                "entries": []
            }

    @staticmethod
    def fetch_and_store_articles(
        db: Session,
        widget_id: int,
        feed_urls: List[str],
        max_articles_per_feed: int = 20
    ) -> Dict[str, Any]:
        """
        Fetch articles from multiple feeds and store new ones in database.

        Args:
            db: Database session
            widget_id: Widget ID to associate articles with
            feed_urls: List of feed URLs to fetch
            max_articles_per_feed: Maximum articles to process per feed

        Returns:
            Dict with stats about fetched/stored articles
        """
        stats = {
            "feeds_processed": 0,
            "feeds_failed": 0,
            "new_articles": 0,
            "existing_articles": 0,
            "errors": []
        }

        for feed_url in feed_urls:
            feed_url = feed_url.strip()
            if not feed_url:
                continue

            result = RssService.parse_feed(feed_url)

            if not result["success"]:
                stats["feeds_failed"] += 1
                stats["errors"].append({
                    "feed_url": feed_url,
                    "error": result.get("error", "Unknown error")
                })
                continue

            stats["feeds_processed"] += 1

            for entry in result["entries"][:max_articles_per_feed]:
                # Check if article already exists
                existing = db.query(RssArticle).filter(
                    and_(
                        RssArticle.feed_url == feed_url,
                        RssArticle.article_guid == entry["guid"]
                    )
                ).first()

                if existing:
                    stats["existing_articles"] += 1
                    continue

                # Create new article
                article = RssArticle(
                    widget_id=widget_id,
                    feed_url=feed_url,
                    article_guid=entry["guid"],
                    article_url=entry["link"],
                    title=entry["title"],
                    summary=entry["summary"],
                    author=entry["author"],
                    image_url=entry["image_url"],
                    published_at=entry["published"],
                    fetched_at=datetime.utcnow(),
                    is_read=False,
                    is_archived=False
                )
                db.add(article)
                stats["new_articles"] += 1

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error storing articles: {e}")
            stats["errors"].append({"error": f"Database error: {str(e)}"})

        return stats

    @staticmethod
    def get_unread_articles(
        db: Session,
        widget_id: int,
        limit: int = 50
    ) -> List[RssArticle]:
        """Get unread, non-archived articles for a widget."""
        return db.query(RssArticle).filter(
            and_(
                RssArticle.widget_id == widget_id,
                RssArticle.is_read == False,
                RssArticle.is_archived == False
            )
        ).order_by(RssArticle.published_at.desc().nullslast()).limit(limit).all()

    @staticmethod
    def get_archived_articles(
        db: Session,
        widget_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> List[RssArticle]:
        """Get archived articles for a widget."""
        return db.query(RssArticle).filter(
            and_(
                RssArticle.widget_id == widget_id,
                RssArticle.is_archived == True
            )
        ).order_by(RssArticle.read_at.desc().nullslast()).offset(offset).limit(limit).all()

    @staticmethod
    def mark_as_read(db: Session, article_id: int) -> Optional[RssArticle]:
        """Mark an article as read and archive it."""
        article = db.query(RssArticle).filter(RssArticle.id == article_id).first()
        if article:
            article.mark_as_read()
            db.commit()
            db.refresh(article)
        return article

    @staticmethod
    def mark_all_as_read(db: Session, widget_id: int) -> int:
        """Mark all unread articles for a widget as read."""
        now = datetime.utcnow()
        count = db.query(RssArticle).filter(
            and_(
                RssArticle.widget_id == widget_id,
                RssArticle.is_read == False
            )
        ).update({
            "is_read": True,
            "read_at": now,
            "is_archived": True,
            "archived_at": now
        })
        db.commit()
        return count

    @staticmethod
    def cleanup_old_archives(db: Session, months: int = 6) -> int:
        """
        Delete archived articles older than specified months.

        Args:
            db: Database session
            months: Number of months to keep archived articles

        Returns:
            Number of deleted articles
        """
        cutoff_date = datetime.utcnow() - timedelta(days=months * 30)
        count = db.query(RssArticle).filter(
            and_(
                RssArticle.is_archived == True,
                RssArticle.archived_at < cutoff_date
            )
        ).delete()
        db.commit()
        logger.info(f"Cleaned up {count} old archived articles")
        return count

    @staticmethod
    def get_article_count(db: Session, widget_id: int) -> Dict[str, int]:
        """Get article counts for a widget."""
        unread = db.query(RssArticle).filter(
            and_(
                RssArticle.widget_id == widget_id,
                RssArticle.is_read == False,
                RssArticle.is_archived == False
            )
        ).count()

        archived = db.query(RssArticle).filter(
            and_(
                RssArticle.widget_id == widget_id,
                RssArticle.is_archived == True
            )
        ).count()

        return {
            "unread": unread,
            "archived": archived,
            "total": unread + archived
        }
