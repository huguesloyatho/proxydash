"""
ProxyDash - Automatic Dashboard for Nginx Proxy Manager
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models import Category, DEFAULT_CATEGORIES
from app.api import api_router
from app.services.npm_sync import sync_all_npm_instances
from app.services.rss_service import RssService
from app.services.cache_service import cache_service
from app.services.websocket_service import ws_manager
from app.services.database_updater import run_nightly_update
from app.services.alert_service import run_alert_check

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Scheduler for periodic sync
scheduler = AsyncIOScheduler()


async def scheduled_sync():
    """Background task for periodic NPM synchronization."""
    logger.info("Starting scheduled NPM sync...")
    try:
        db = SessionLocal()
        try:
            stats = await sync_all_npm_instances(db, use_ollama=True)
            logger.info(f"Scheduled sync completed: {stats}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Scheduled sync failed: {e}")


async def cleanup_rss_archives():
    """Background task for cleaning up old RSS archived articles (older than 6 months)."""
    logger.info("Starting RSS archives cleanup...")
    try:
        db = SessionLocal()
        try:
            deleted_count = RssService.cleanup_old_archives(db, months=6)
            logger.info(f"RSS cleanup completed: {deleted_count} old articles deleted")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"RSS cleanup failed: {e}")


async def nightly_database_update():
    """
    Background task for updating the fingerprint database from RSS feeds.
    Runs at 4:00 AM to check selfh.st and awesome-selfhosted for new apps.
    """
    logger.info("Starting nightly fingerprint database update...")
    try:
        result = await run_nightly_update()
        logger.info(
            f"Nightly update completed: {result.get('total_new_apps', 0)} new apps found, "
            f"{result.get('apps_added_to_database', 0)} added to database"
        )
    except Exception as e:
        logger.error(f"Nightly database update failed: {e}")


def init_categories(db):
    """Initialize default categories if they don't exist."""
    for cat_data in DEFAULT_CATEGORIES:
        existing = db.query(Category).filter(Category.slug == cat_data["slug"]).first()
        if not existing:
            category = Category(**cat_data)
            db.add(category)
            logger.info(f"Created category: {cat_data['name']}")
    db.commit()


def run_migrations(db):
    """Run manual migrations for existing databases."""
    from sqlalchemy import text, inspect

    inspector = inspect(engine)

    # Migration: Add owner_id and is_public to tabs table
    if 'tabs' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('tabs')]

        if 'owner_id' not in columns:
            logger.info("Migration: Adding owner_id column to tabs table")
            db.execute(text("ALTER TABLE tabs ADD COLUMN owner_id INTEGER REFERENCES users(id)"))
            db.commit()

        if 'is_public' not in columns:
            logger.info("Migration: Adding is_public column to tabs table")
            db.execute(text("ALTER TABLE tabs ADD COLUMN is_public BOOLEAN DEFAULT FALSE"))
            db.commit()

    # Migration: Add forward_* columns to applications table
    if 'applications' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('applications')]

        if 'forward_host' not in columns:
            logger.info("Migration: Adding forward_host column to applications table")
            db.execute(text("ALTER TABLE applications ADD COLUMN forward_host VARCHAR(255)"))
            db.commit()

        if 'forward_port' not in columns:
            logger.info("Migration: Adding forward_port column to applications table")
            db.execute(text("ALTER TABLE applications ADD COLUMN forward_port INTEGER"))
            db.commit()

        if 'forward_scheme' not in columns:
            logger.info("Migration: Adding forward_scheme column to applications table")
            db.execute(text("ALTER TABLE applications ADD COLUMN forward_scheme VARCHAR(10)"))
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting ProxyDash...")

    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    # Run manual migrations for existing tables
    db = SessionLocal()
    try:
        run_migrations(db)
    except Exception as e:
        logger.warning(f"Migration warning: {e}")
    finally:
        db.close()

    # Initialize default categories
    db = SessionLocal()
    try:
        init_categories(db)
    finally:
        db.close()

    # Initialize Redis cache
    redis_connected = await cache_service.connect()
    if redis_connected:
        logger.info("Redis cache connected")
    else:
        logger.warning("Redis cache not available - running without cache")

    # Start WebSocket manager
    await ws_manager.start()
    logger.info("WebSocket manager started")

    # Start scheduler
    scheduler.add_job(
        scheduled_sync,
        "interval",
        minutes=settings.SYNC_INTERVAL_MINUTES,
        id="npm_sync",
        replace_existing=True
    )

    # Add daily RSS archives cleanup job (runs at 3:00 AM)
    scheduler.add_job(
        cleanup_rss_archives,
        "cron",
        hour=3,
        minute=0,
        id="rss_cleanup",
        replace_existing=True
    )

    # Add nightly fingerprint database update job (runs at 4:00 AM)
    scheduler.add_job(
        nightly_database_update,
        "cron",
        hour=4,
        minute=0,
        id="fingerprint_db_update",
        replace_existing=True
    )

    # Add alert check job (every 2 minutes)
    scheduler.add_job(
        run_alert_check,
        "interval",
        minutes=2,
        id="alert_check",
        replace_existing=True
    )

    scheduler.start()
    logger.info(
        f"Scheduler started (sync every {settings.SYNC_INTERVAL_MINUTES} minutes, "
        f"alerts every 2 minutes, RSS cleanup daily at 3AM, fingerprint DB update at 4AM)"
    )

    # Run initial sync
    await scheduled_sync()

    yield

    # Shutdown
    logger.info("Shutting down ProxyDash...")

    # Stop WebSocket manager
    await ws_manager.stop()
    logger.info("WebSocket manager stopped")

    # Disconnect Redis
    await cache_service.disconnect()
    logger.info("Redis cache disconnected")

    scheduler.shutdown()
    logger.info("ProxyDash stopped")


# Create FastAPI app
app = FastAPI(
    title="ProxyDash",
    description="Automatic Dashboard for Nginx Proxy Manager",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    cache_stats = await cache_service.get_stats()
    ws_stats = ws_manager.get_stats()

    return {
        "status": "healthy",
        "service": "ProxyDash",
        "cache": {
            "connected": cache_stats.get("connected", False),
            "keys_count": cache_stats.get("keys_count", 0),
        },
        "websocket": {
            "enabled": ws_stats.get("enabled", False),
            "connected_clients": ws_stats.get("connected_clients", 0),
        },
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "ProxyDash",
        "description": "Automatic Dashboard for Nginx Proxy Manager",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/stats")
async def get_stats():
    """Get service statistics (cache, websocket)."""
    cache_stats = await cache_service.get_stats()
    ws_stats = ws_manager.get_stats()

    return {
        "cache": cache_stats,
        "websocket": ws_stats,
    }
