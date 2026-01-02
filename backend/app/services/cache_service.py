"""
Redis cache service for widget data caching.
Provides a simple interface for caching widget data with configurable TTL.
"""

import json
import logging
from typing import Any, Dict, Optional
from datetime import datetime

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """
    Async Redis cache service for widget data.
    Falls back gracefully if Redis is unavailable.
    """

    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._connected: bool = False
        self._last_error: Optional[str] = None

    async def connect(self) -> bool:
        """
        Connect to Redis server.
        Returns True if connected successfully, False otherwise.
        """
        if not settings.REDIS_ENABLED:
            logger.info("Redis cache is disabled via REDIS_ENABLED setting")
            return False

        try:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            # Test connection
            await self._redis.ping()
            self._connected = True
            self._last_error = None
            logger.info(f"Connected to Redis at {settings.REDIS_URL}")
            return True
        except Exception as e:
            self._connected = False
            self._last_error = str(e)
            logger.warning(f"Failed to connect to Redis: {e}. Cache will be disabled.")
            return False

    async def disconnect(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._connected = False
            logger.info("Disconnected from Redis")

    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        return self._connected and self._redis is not None

    def _make_key(self, prefix: str, *parts: Any) -> str:
        """Generate a cache key from parts."""
        key_parts = [str(p) for p in parts if p is not None]
        return f"proxydash:{prefix}:{':'.join(key_parts)}"

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Get a value from cache.

        Args:
            key: Cache key

        Returns:
            Cached data or None if not found/expired
        """
        if not self.is_connected:
            return None

        try:
            data = await self._redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set a value in cache with optional TTL.

        Args:
            key: Cache key
            value: Data to cache (must be JSON serializable)
            ttl: Time to live in seconds (defaults to REDIS_CACHE_TTL)

        Returns:
            True if cached successfully
        """
        if not self.is_connected:
            return False

        try:
            ttl = ttl or settings.REDIS_CACHE_TTL
            # Add metadata
            cache_data = {
                "data": value,
                "cached_at": datetime.utcnow().isoformat(),
                "ttl": ttl,
            }
            await self._redis.setex(key, ttl, json.dumps(cache_data, default=str))
            return True
        except Exception as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        if not self.is_connected:
            return False

        try:
            await self._redis.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern.

        Args:
            pattern: Redis pattern (e.g., "proxydash:widget:*")

        Returns:
            Number of deleted keys
        """
        if not self.is_connected:
            return 0

        try:
            deleted = 0
            async for key in self._redis.scan_iter(match=pattern):
                await self._redis.delete(key)
                deleted += 1
            return deleted
        except Exception as e:
            logger.warning(f"Cache delete pattern error for {pattern}: {e}")
            return 0

    # Widget-specific cache methods

    async def get_widget_data(self, widget_id: int) -> Optional[Dict[str, Any]]:
        """Get cached widget data."""
        key = self._make_key("widget", widget_id, "data")
        cached = await self.get(key)
        if cached:
            return cached.get("data")
        return None

    async def set_widget_data(
        self,
        widget_id: int,
        data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache widget data."""
        key = self._make_key("widget", widget_id, "data")
        return await self.set(key, data, ttl)

    async def invalidate_widget(self, widget_id: int) -> bool:
        """Invalidate cache for a specific widget."""
        key = self._make_key("widget", widget_id, "data")
        return await self.delete(key)

    async def invalidate_widget_type(self, widget_type: str) -> int:
        """Invalidate cache for all widgets of a type."""
        pattern = self._make_key("widget", "*", "data")
        # Note: This is a simplified version. For type-based invalidation,
        # we'd need to store widget type info in the cache or use tags
        return await self.delete_pattern(pattern)

    # Ping history cache
    async def get_ping_history(
        self,
        target: str,
        widget_id: int,
        hours: int
    ) -> Optional[Dict[str, Any]]:
        """Get cached ping history."""
        key = self._make_key("ping", widget_id, target, f"h{hours}")
        cached = await self.get(key)
        if cached:
            return cached.get("data")
        return None

    async def set_ping_history(
        self,
        target: str,
        widget_id: int,
        hours: int,
        data: Dict[str, Any],
        ttl: int = 60  # Ping history can be cached longer
    ) -> bool:
        """Cache ping history data."""
        key = self._make_key("ping", widget_id, target, f"h{hours}")
        return await self.set(key, data, ttl)

    # Docker data cache
    async def get_docker_data(self, widget_id: int) -> Optional[Dict[str, Any]]:
        """Get cached Docker data."""
        key = self._make_key("docker", widget_id)
        cached = await self.get(key)
        if cached:
            return cached.get("data")
        return None

    async def set_docker_data(
        self,
        widget_id: int,
        data: Dict[str, Any],
        ttl: int = 15  # Docker stats refresh frequently
    ) -> bool:
        """Cache Docker container data."""
        key = self._make_key("docker", widget_id)
        return await self.set(key, data, ttl)

    # Vikunja tasks cache
    async def get_vikunja_tasks(
        self,
        widget_id: int,
        cache_key: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached Vikunja tasks."""
        key = self._make_key("vikunja", widget_id, cache_key or "tasks")
        cached = await self.get(key)
        if cached:
            return cached.get("data")
        return None

    async def set_vikunja_tasks(
        self,
        widget_id: int,
        data: Dict[str, Any],
        cache_key: Optional[str] = None,
        ttl: int = 30
    ) -> bool:
        """Cache Vikunja tasks data."""
        key = self._make_key("vikunja", widget_id, cache_key or "tasks")
        return await self.set(key, data, ttl)

    # CrowdSec data cache
    async def get_crowdsec_data(self, widget_id: int) -> Optional[Dict[str, Any]]:
        """Get cached CrowdSec data."""
        key = self._make_key("crowdsec", widget_id)
        cached = await self.get(key)
        if cached:
            return cached.get("data")
        return None

    async def set_crowdsec_data(
        self,
        widget_id: int,
        data: Dict[str, Any],
        ttl: int = 60  # Security data can be cached longer
    ) -> bool:
        """Cache CrowdSec security data."""
        key = self._make_key("crowdsec", widget_id)
        return await self.set(key, data, ttl)

    # Cache statistics
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.is_connected:
            return {
                "connected": False,
                "error": self._last_error,
            }

        try:
            info = await self._redis.info("memory")
            keys_count = await self._redis.dbsize()
            return {
                "connected": True,
                "keys_count": keys_count,
                "used_memory": info.get("used_memory_human", "N/A"),
                "used_memory_peak": info.get("used_memory_peak_human", "N/A"),
                "redis_version": info.get("redis_version", "N/A"),
            }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e),
            }


# Global cache instance
cache_service = CacheService()


# TTL presets for different widget types
WIDGET_TTL = {
    "clock": 0,  # Never cache - always current time
    "weather": 300,  # 5 minutes - weather doesn't change often
    "calendar": 120,  # 2 minutes
    "vikunja": 30,  # 30 seconds - tasks can change
    "vm_status": 15,  # 15 seconds - quick health checks
    "docker": 10,  # 10 seconds - container status changes
    "proxmox_node": 30,
    "proxmox_vm": 30,
    "proxmox_summary": 60,
    "crowdsec": 60,  # 1 minute - security data
    "uptime_ping": 5,  # 5 seconds - ping data is realtime
    "logs": 5,  # 5 seconds - logs are realtime
    "rss_feed": 300,  # 5 minutes - RSS feeds don't change often
    "notes": 30,  # 30 seconds
}


def get_widget_ttl(widget_type: str) -> int:
    """Get the appropriate TTL for a widget type."""
    return WIDGET_TTL.get(widget_type, settings.REDIS_CACHE_TTL)
