"""
Online Application Lookup Service.
Fallback service that fetches application information from awesome-selfhosted
when the local fingerprint database doesn't have the app.

This provides name, description, icon, and category information for 2000+ apps.
"""

import re
import logging
import asyncio
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib

import httpx

logger = logging.getLogger(__name__)

# Cache for online lookups (in-memory, persists for app lifetime)
_lookup_cache: Dict[str, Tuple[Any, datetime]] = {}
CACHE_TTL = timedelta(hours=24)  # Cache entries for 24 hours

# awesome-selfhosted raw URL
AWESOME_SELFHOSTED_URL = "https://raw.githubusercontent.com/awesome-selfhosted/awesome-selfhosted/master/README.md"

# Dashboard Icons base URL
DASHBOARD_ICONS_URL = "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg"

# HTTP timeout
HTTP_TIMEOUT = 30


@dataclass
class OnlineLookupResult:
    """Result from online app lookup."""
    app_name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    icon_url: Optional[str] = None
    category: Optional[str] = None
    source_url: Optional[str] = None
    github_url: Optional[str] = None
    license: Optional[str] = None
    source: str = "awesome-selfhosted"


# Category mapping from awesome-selfhosted to our categories
CATEGORY_MAP = {
    "analytics": "monitoring",
    "archiving and digital preservation": "storage",
    "automation": "productivity",
    "blogging platforms": "productivity",
    "booking and scheduling": "productivity",
    "bookmarks and link sharing": "productivity",
    "calendar & contacts": "productivity",
    "communication": "communication",
    "community-supported agriculture": "productivity",
    "conference management": "communication",
    "content management systems": "productivity",
    "database management": "admin",
    "dns": "network",
    "document management": "productivity",
    "e-books": "media",
    "e-commerce": "productivity",
    "federated identity & authentication": "security",
    "feed readers": "productivity",
    "file transfer & synchronization": "storage",
    "file transfer - distributed filesystems": "storage",
    "file transfer - object storage & file servers": "storage",
    "file transfer - peer-to-peer filesharing": "storage",
    "file transfer - single-click & drag-n-drop upload": "storage",
    "file transfer - web-based file managers": "storage",
    "games": "media",
    "games - administrative utilities & control panels": "admin",
    "genealogy": "productivity",
    "groupware": "productivity",
    "human resources management": "productivity",
    "internet of things": "home",
    "inventory management": "productivity",
    "knowledge management tools": "productivity",
    "learning and courses": "productivity",
    "manufacturing": "productivity",
    "maps and global positioning system": "productivity",
    "media streaming": "media",
    "media streaming - audio streaming": "media",
    "media streaming - multimedia streaming": "media",
    "media streaming - video streaming": "media",
    "miscellaneous": "other",
    "money, budgeting & management": "productivity",
    "monitoring": "monitoring",
    "note-taking & editors": "productivity",
    "office suites": "productivity",
    "password managers": "security",
    "pastebins": "productivity",
    "personal dashboards": "admin",
    "photo and video galleries": "media",
    "polls and events": "productivity",
    "proxy": "network",
    "recipe management": "productivity",
    "remote access": "admin",
    "resource planning": "productivity",
    "search engines": "productivity",
    "self-hosting solutions": "admin",
    "software development": "development",
    "software development - api management": "development",
    "software development - continuous integration & deployment": "development",
    "software development - fediverse": "communication",
    "software development - ide & tools": "development",
    "software development - localization": "development",
    "software development - low code": "development",
    "software development - project management": "development",
    "software development - testing": "development",
    "static site generators": "development",
    "status / uptime pages": "monitoring",
    "task management & to-do lists": "productivity",
    "ticketing": "productivity",
    "time tracking": "productivity",
    "url shorteners": "productivity",
    "video surveillance": "monitoring",
    "vpn": "network",
    "web servers": "admin",
    "wikis": "productivity",
}


def get_category_slug(category_name: str) -> str:
    """Map awesome-selfhosted category to our category slug."""
    category_lower = category_name.lower().strip()
    return CATEGORY_MAP.get(category_lower, "other")


def normalize_app_name(name: str) -> str:
    """Normalize app name for matching."""
    # Remove common suffixes/prefixes
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9]', '', name)
    return name


def get_icon_name(app_name: str) -> str:
    """
    Generate a likely icon name from the app name.
    Dashboard icons typically use lowercase-hyphenated names.
    """
    # Clean the name
    icon_name = app_name.lower().strip()
    # Replace spaces and underscores with hyphens
    icon_name = re.sub(r'[\s_]+', '-', icon_name)
    # Remove special characters except hyphens
    icon_name = re.sub(r'[^a-z0-9-]', '', icon_name)
    # Remove consecutive hyphens
    icon_name = re.sub(r'-+', '-', icon_name)
    # Remove leading/trailing hyphens
    icon_name = icon_name.strip('-')
    return icon_name


async def check_icon_exists(icon_name: str) -> bool:
    """Check if an icon exists in dashboard-icons."""
    url = f"{DASHBOARD_ICONS_URL}/{icon_name}.svg"
    try:
        async with httpx.AsyncClient(timeout=5, follow_redirects=True) as client:
            response = await client.head(url)
            return response.status_code == 200
    except Exception:
        return False


class AwesomeSelfhostedParser:
    """Parser for the awesome-selfhosted README.md file."""

    def __init__(self):
        self._apps: Dict[str, OnlineLookupResult] = {}
        self._apps_by_normalized: Dict[str, OnlineLookupResult] = {}
        self._last_fetch: Optional[datetime] = None
        self._content: Optional[str] = None

    async def fetch_and_parse(self, force_refresh: bool = False) -> bool:
        """Fetch and parse the awesome-selfhosted README."""
        # Check if we need to refresh
        if not force_refresh and self._last_fetch:
            if datetime.utcnow() - self._last_fetch < CACHE_TTL:
                return True

        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                response = await client.get(AWESOME_SELFHOSTED_URL)
                response.raise_for_status()
                self._content = response.text
                self._last_fetch = datetime.utcnow()

                # Parse the content
                await self._parse_content()

                logger.info(f"Fetched and parsed {len(self._apps)} apps from awesome-selfhosted")
                return True

        except Exception as e:
            logger.error(f"Failed to fetch awesome-selfhosted: {e}")
            return False

    async def _parse_content(self):
        """Parse the README content to extract apps."""
        if not self._content:
            return

        self._apps = {}
        self._apps_by_normalized = {}

        current_category = "other"

        # Split into lines
        lines = self._content.split('\n')

        for line in lines:
            # Check for category headers (## Category Name)
            category_match = re.match(r'^##\s+(.+?)(?:\s*<a|\s*$)', line)
            if category_match:
                current_category = category_match.group(1).strip()
                continue

            # Check for app entries
            # Format: - [App Name](url) - Description. ([Demo](url), [Source Code](url)) `License` `Tech`
            app_match = re.match(
                r'^-\s+\[([^\]]+)\]\(([^)]+)\)\s+-\s+(.+?)(?:\s+\((?:\[Demo\]|Source Code|\[Source).*?\))?\s*(?:`([^`]+)`)?',
                line
            )

            if app_match:
                app_name = app_match.group(1).strip()
                source_url = app_match.group(2).strip()
                description = app_match.group(3).strip()
                license_info = app_match.group(4) if app_match.group(4) else None

                # Clean description (remove trailing parentheses content)
                description = re.sub(r'\s*\([^)]*$', '', description)
                description = re.sub(r'\s*`[^`]*`\s*$', '', description)
                description = description.rstrip('.')

                # Get GitHub URL if present
                github_match = re.search(r'\[Source Code\]\((https://github\.com/[^)]+)\)', line)
                github_url = github_match.group(1) if github_match else None

                # Generate icon name
                icon_name = get_icon_name(app_name)

                # Create result
                result = OnlineLookupResult(
                    app_name=app_name,
                    description=description[:200] if description else None,
                    icon=icon_name,
                    icon_url=f"{DASHBOARD_ICONS_URL}/{icon_name}.svg",
                    category=get_category_slug(current_category),
                    source_url=source_url,
                    github_url=github_url,
                    license=license_info,
                    source="awesome-selfhosted"
                )

                # Store by original name and normalized name
                self._apps[app_name.lower()] = result
                normalized = normalize_app_name(app_name)
                self._apps_by_normalized[normalized] = result

    def lookup(self, app_name: str) -> Optional[OnlineLookupResult]:
        """Look up an app by name."""
        # Try exact match first
        result = self._apps.get(app_name.lower())
        if result:
            return result

        # Try normalized match
        normalized = normalize_app_name(app_name)
        result = self._apps_by_normalized.get(normalized)
        if result:
            return result

        # Try partial match
        for key, value in self._apps_by_normalized.items():
            if normalized in key or key in normalized:
                return value

        return None

    def search(self, query: str, limit: int = 10) -> List[OnlineLookupResult]:
        """Search for apps matching a query."""
        query_normalized = normalize_app_name(query)
        results = []

        for key, value in self._apps_by_normalized.items():
            if query_normalized in key:
                results.append(value)
                if len(results) >= limit:
                    break

        return results


# Global parser instance
_parser: Optional[AwesomeSelfhostedParser] = None


async def get_parser() -> AwesomeSelfhostedParser:
    """Get or create the global parser instance."""
    global _parser
    if _parser is None:
        _parser = AwesomeSelfhostedParser()
    return _parser


async def lookup_app_online(
    app_name: str,
    detected_from_html: bool = False
) -> Optional[OnlineLookupResult]:
    """
    Look up an application in online databases.

    Args:
        app_name: The application name to look up (e.g., "heimdall", "nextcloud")
        detected_from_html: If True, the name was detected from HTML content

    Returns:
        OnlineLookupResult if found, None otherwise
    """
    # Check cache first
    cache_key = f"app:{normalize_app_name(app_name)}"
    if cache_key in _lookup_cache:
        cached_result, cached_time = _lookup_cache[cache_key]
        if datetime.utcnow() - cached_time < CACHE_TTL:
            return cached_result

    # Get parser and ensure it's initialized
    parser = await get_parser()
    if not parser._apps:
        await parser.fetch_and_parse()

    # Look up the app
    result = parser.lookup(app_name)

    # Cache the result (even if None, to avoid repeated lookups)
    _lookup_cache[cache_key] = (result, datetime.utcnow())

    return result


async def search_apps_online(query: str, limit: int = 10) -> List[OnlineLookupResult]:
    """
    Search for applications in online databases.

    Args:
        query: Search query
        limit: Maximum number of results

    Returns:
        List of matching applications
    """
    parser = await get_parser()
    if not parser._apps:
        await parser.fetch_and_parse()

    return parser.search(query, limit)


async def get_app_count() -> int:
    """Get the number of apps in the online database."""
    parser = await get_parser()
    if not parser._apps:
        await parser.fetch_and_parse()
    return len(parser._apps)


async def refresh_online_database() -> bool:
    """Force refresh the online database."""
    parser = await get_parser()
    return await parser.fetch_and_parse(force_refresh=True)
