"""
RSS API endpoints for managing RSS feeds and articles.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.widget import Widget
from app.models.rss_article import RssArticle
from app.services.rss_service import RssService

router = APIRouter(prefix="/rss", tags=["rss"])


class FeedTestRequest(BaseModel):
    feed_url: str


class FeedTestResponse(BaseModel):
    success: bool
    feed_title: Optional[str] = None
    entry_count: int = 0
    error: Optional[str] = None
    sample_entries: List[dict] = []


class ArticleResponse(BaseModel):
    id: int
    widget_id: Optional[int]
    feed_url: str
    article_guid: str
    article_url: Optional[str]
    title: str
    summary: Optional[str]
    author: Optional[str]
    image_url: Optional[str]
    published_at: Optional[str]
    fetched_at: str
    is_read: bool
    read_at: Optional[str]
    is_archived: bool

    class Config:
        from_attributes = True


class FetchResponse(BaseModel):
    success: bool
    feeds_processed: int
    feeds_failed: int
    new_articles: int
    existing_articles: int
    errors: List[dict] = []


class CountResponse(BaseModel):
    unread: int
    archived: int
    total: int


@router.post("/test-feed", response_model=FeedTestResponse)
async def test_feed(
    request: FeedTestRequest,
    current_user: User = Depends(get_current_user)
):
    """Test if an RSS feed URL is valid and return sample entries."""
    result = RssService.parse_feed(request.feed_url)

    if not result["success"]:
        return FeedTestResponse(
            success=False,
            error=result.get("error", "Failed to parse feed"),
            entry_count=0
        )

    # Return first 3 entries as samples
    sample_entries = []
    for entry in result["entries"][:3]:
        sample_entries.append({
            "title": entry["title"],
            "published": entry["published"].isoformat() if entry["published"] else None,
            "author": entry["author"],
            "has_image": entry["image_url"] is not None
        })

    return FeedTestResponse(
        success=True,
        feed_title=result.get("feed_title"),
        entry_count=len(result["entries"]),
        sample_entries=sample_entries
    )


@router.post("/widget/{widget_id}/fetch", response_model=FetchResponse)
async def fetch_widget_articles(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch new articles for a widget's RSS feeds."""
    # Get widget and its feed URLs
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    if widget.widget_type != "rss_feed":
        raise HTTPException(status_code=400, detail="Widget is not an RSS feed widget")

    config = widget.config or {}
    feed_urls = config.get("feed_urls", [])

    if not feed_urls:
        return FetchResponse(
            success=True,
            feeds_processed=0,
            feeds_failed=0,
            new_articles=0,
            existing_articles=0,
            errors=[{"error": "No feed URLs configured"}]
        )

    # Parse feed_urls if it's a string (newline or comma separated)
    if isinstance(feed_urls, str):
        feed_urls = [url.strip() for url in feed_urls.replace('\n', ',').split(',') if url.strip()]

    stats = RssService.fetch_and_store_articles(
        db=db,
        widget_id=widget_id,
        feed_urls=feed_urls,
        max_articles_per_feed=config.get("max_articles_per_feed", 20)
    )

    return FetchResponse(
        success=stats["feeds_failed"] < len(feed_urls),
        **stats
    )


@router.get("/widget/{widget_id}/articles", response_model=List[ArticleResponse])
async def get_widget_articles(
    widget_id: int,
    include_archived: bool = Query(False, description="Include archived articles"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get articles for a widget."""
    if include_archived:
        articles = RssService.get_archived_articles(db, widget_id, limit, offset)
    else:
        articles = RssService.get_unread_articles(db, widget_id, limit)

    return [
        ArticleResponse(
            id=a.id,
            widget_id=a.widget_id,
            feed_url=a.feed_url,
            article_guid=a.article_guid,
            article_url=a.article_url,
            title=a.title,
            summary=a.summary,
            author=a.author,
            image_url=a.image_url,
            published_at=a.published_at.isoformat() if a.published_at else None,
            fetched_at=a.fetched_at.isoformat() if a.fetched_at else None,
            is_read=a.is_read,
            read_at=a.read_at.isoformat() if a.read_at else None,
            is_archived=a.is_archived
        )
        for a in articles
    ]


@router.get("/widget/{widget_id}/count", response_model=CountResponse)
async def get_widget_article_count(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get article counts for a widget."""
    return RssService.get_article_count(db, widget_id)


@router.post("/articles/{article_id}/read")
async def mark_article_read(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark an article as read and archive it."""
    article = RssService.mark_as_read(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return {"success": True, "article_id": article_id}


@router.post("/widget/{widget_id}/mark-all-read")
async def mark_all_articles_read(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all unread articles for a widget as read."""
    count = RssService.mark_all_as_read(db, widget_id)
    return {"success": True, "marked_count": count}


@router.delete("/widget/{widget_id}/cleanup")
async def cleanup_old_articles(
    widget_id: int,
    months: int = Query(6, ge=1, le=24, description="Months to keep"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clean up archived articles older than specified months."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    count = RssService.cleanup_old_archives(db, months)
    return {"success": True, "deleted_count": count}


@router.get("/widget/{widget_id}/data")
async def get_widget_data(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get RSS widget data: fetch new articles and return unread ones.
    This is the main endpoint used by the frontend widget.
    """
    # Get widget config
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    if widget.widget_type != "rss_feed":
        raise HTTPException(status_code=400, detail="Widget is not an RSS feed widget")

    config = widget.config or {}
    feed_urls = config.get("feed_urls", [])

    # Parse feed_urls if string
    if isinstance(feed_urls, str):
        feed_urls = [url.strip() for url in feed_urls.replace('\n', ',').split(',') if url.strip()]

    # Fetch new articles if there are feeds configured
    fetch_stats = None
    if feed_urls:
        fetch_stats = RssService.fetch_and_store_articles(
            db=db,
            widget_id=widget_id,
            feed_urls=feed_urls,
            max_articles_per_feed=config.get("max_articles_per_feed", 20)
        )

    # Get unread articles
    max_display = config.get("max_display", 10)
    articles = RssService.get_unread_articles(db, widget_id, max_display)

    # Get counts
    counts = RssService.get_article_count(db, widget_id)

    return {
        "widget_id": widget_id,
        "widget_type": "rss_feed",
        "data": {
            "articles": [a.to_dict() for a in articles],
            "counts": counts,
            "fetch_stats": fetch_stats,
            "feed_urls": feed_urls
        }
    }
