"""
Database Auto-Updater Service.
Monitors RSS feeds from selfh.st and awesome-selfhosted for new applications
and automatically updates the local fingerprint database.

Runs as a nightly cron job to keep the detection database up-to-date.
"""

import re
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
import xml.etree.ElementTree as ET
import json
import os

import httpx

logger = logging.getLogger(__name__)

# RSS Feed URLs
SELFHST_RSS_URL = "https://selfh.st/rss/"
# awesome-selfhosted-data is the actual data repo where new apps are added
AWESOME_SELFHOSTED_DATA_ATOM_URL = "https://github.com/awesome-selfhosted/awesome-selfhosted-data/commits/master.atom"

# Storage file for tracking updates
UPDATE_STATE_FILE = "/tmp/dashboard_auto_update_state.json"

# HTTP timeout
HTTP_TIMEOUT = 30


@dataclass
class NewAppEntry:
    """Represents a newly discovered application from RSS feeds."""
    name: str
    source: str  # 'selfhst' or 'awesome-selfhosted'
    discovered_at: datetime
    url: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    commit_url: Optional[str] = None


@dataclass
class UpdateResult:
    """Result of an update check."""
    source: str
    checked_at: datetime
    new_entries: List[NewAppEntry] = field(default_factory=list)
    error: Optional[str] = None
    entries_added_to_db: int = 0


@dataclass
class ExecutionLog:
    """Log entry for an update execution."""
    timestamp: datetime
    level: str  # 'info', 'warning', 'error', 'success'
    message: str
    source: Optional[str] = None  # 'selfhst', 'awesome-selfhosted', 'system'


class RSSFeedParser:
    """Parser for RSS and Atom feeds."""

    @staticmethod
    async def fetch_feed(url: str) -> Optional[str]:
        """Fetch RSS/Atom feed content."""
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.text
        except Exception as e:
            logger.error(f"Failed to fetch feed {url}: {e}")
            return None

    @staticmethod
    def parse_selfhst_rss(content: str) -> List[NewAppEntry]:
        """
        Parse selfh.st RSS feed for new app announcements.

        selfh.st mainly publishes weekly newsletters. We look for:
        - Posts about specific apps (title contains app name)
        - "My Favorite" posts listing new apps
        - App review/spotlight posts
        """
        entries = []
        try:
            root = ET.fromstring(content)

            # Handle RSS 2.0 format
            channel = root.find('channel')
            if channel is None:
                return entries

            for item in channel.findall('item'):
                title = item.find('title')
                link = item.find('link')
                description = item.find('description')

                if title is None:
                    continue

                title_text = title.text or ""
                desc_text = description.text if description is not None else ""

                # Skip weekly newsletters (they're aggregates, not specific app posts)
                if "Self-Host Weekly" in title_text:
                    continue

                # Look for app-related posts
                # Patterns that indicate a post about a specific app
                app_patterns = [
                    # Direct app mentions in title
                    r"(?i)^([A-Za-z0-9][A-Za-z0-9_-]+)[\s:]+",  # AppName: or AppName followed by space
                    r"(?i)introducing[:\s]+([A-Za-z0-9_-]+)",
                    r"(?i)spotlight[:\s]+([A-Za-z0-9_-]+)",
                    r"(?i)review[:\s]+([A-Za-z0-9_-]+)",
                    r"(?i)^([A-Za-z0-9_-]+)\s+v?\d+\.\d+",  # AppName v1.0
                ]

                for pattern in app_patterns:
                    match = re.search(pattern, title_text)
                    if match:
                        app_name = match.group(1)
                        # Skip common false positives
                        skip_words = [
                            'self', 'host', 'hosted', 'new', 'my', 'favorite', 'best',
                            'top', 'the', 'a', 'an', 'how', 'to', 'why', 'what', 'weekly',
                            'software', 'names', 'apps', 'you', 'are', 'probably'
                        ]
                        if app_name.lower() in skip_words or len(app_name) < 3:
                            continue

                        entries.append(NewAppEntry(
                            name=app_name,
                            source="selfhst",
                            discovered_at=datetime.utcnow(),
                            url=link.text if link is not None else None,
                            description=desc_text[:200] if desc_text else None,
                        ))
                        break

        except ET.ParseError as e:
            logger.error(f"Failed to parse selfh.st RSS: {e}")

        return entries

    @staticmethod
    def parse_awesome_selfhosted_atom(content: str) -> List[NewAppEntry]:
        """
        Parse awesome-selfhosted-data GitHub Atom feed for new additions.

        The feed contains commits like:
        - "Add AppName" or "Add AppName (#123)" - new apps
        - "feat: add AppName" - new apps
        - "[bot] update projects metadata" - skip
        - "Adjust Category for X" - skip
        - "remove X" - skip
        """
        entries = []
        try:
            # Define namespaces
            namespaces = {
                'atom': 'http://www.w3.org/2005/Atom'
            }

            root = ET.fromstring(content)

            for entry in root.findall('atom:entry', namespaces):
                title = entry.find('atom:title', namespaces)
                link = entry.find('atom:link', namespaces)

                if title is None:
                    continue

                title_text = (title.text or "").strip()

                # Skip bot commits and non-add commits
                skip_patterns = [
                    r'\[bot\]',
                    r'(?i)^remove\s',
                    r'(?i)^delete\s',
                    r'(?i)^update\s',
                    r'(?i)^fix\s',
                    r'(?i)^adjust\s',
                    r'(?i)^docs',
                    r'(?i)^chore',
                    r'(?i)^ci:',
                    r'(?i)metadata',
                ]

                should_skip = False
                for pattern in skip_patterns:
                    if re.search(pattern, title_text):
                        should_skip = True
                        break

                if should_skip:
                    continue

                # Look for commits that add new apps
                add_patterns = [
                    # "Add AppName" or "Add AppName (#123)"
                    r"(?i)^add[:\s]+([A-Za-z0-9][A-Za-z0-9_.-]+)",
                    # "feat: add AppName"
                    r"(?i)feat[:\s]+add[:\s]+([A-Za-z0-9][A-Za-z0-9_.-]+)",
                    # "new: AppName"
                    r"(?i)^new[:\s]+([A-Za-z0-9][A-Za-z0-9_.-]+)",
                ]

                for pattern in add_patterns:
                    match = re.search(pattern, title_text)
                    if match:
                        app_name = match.group(1).strip()

                        # Clean up app name (remove trailing special chars)
                        app_name = re.sub(r'[#\(\)\s]+$', '', app_name)

                        # Skip common false positives
                        skip_words = [
                            'link', 'links', 'section', 'category', 'readme',
                            'badge', 'icon', 'template', 'docs', 'to', 'the',
                            'a', 'project', 'projects', 'software'
                        ]
                        if app_name.lower() in skip_words or len(app_name) < 2:
                            continue

                        link_url = None
                        if link is not None:
                            link_url = link.get('href')

                        entries.append(NewAppEntry(
                            name=app_name,
                            source="awesome-selfhosted",
                            discovered_at=datetime.utcnow(),
                            commit_url=link_url,
                            description=f"Discovered from: {title_text[:80]}",
                        ))
                        break

        except ET.ParseError as e:
            logger.error(f"Failed to parse awesome-selfhosted Atom: {e}")

        return entries


class DatabaseUpdater:
    """
    Main service for auto-updating the fingerprint database.

    Features:
    - Monitors RSS feeds for new applications
    - Adds new patterns to the local fingerprint database
    - Tracks update history to avoid duplicates
    - Can be run as a scheduled task (cron)
    """

    def __init__(self):
        self.parser = RSSFeedParser()
        self._state = self._load_state()
        self._current_logs: List[ExecutionLog] = []

    def _log(self, level: str, message: str, source: Optional[str] = None):
        """Add a log entry to the current execution."""
        log_entry = ExecutionLog(
            timestamp=datetime.utcnow(),
            level=level,
            message=message,
            source=source
        )
        self._current_logs.append(log_entry)

        # Also log to Python logger
        log_func = getattr(logger, level if level != 'success' else 'info')
        log_func(f"[{source or 'system'}] {message}")

    def _load_state(self) -> Dict[str, Any]:
        """Load the update state from disk."""
        try:
            if os.path.exists(UPDATE_STATE_FILE):
                with open(UPDATE_STATE_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load update state: {e}")

        return {
            "last_selfhst_check": None,
            "last_awesome_check": None,
            "known_apps": [],
            "update_history": [],
            "last_execution_logs": [],
            "last_execution_result": None
        }

    def _save_state(self):
        """Save the update state to disk."""
        try:
            with open(UPDATE_STATE_FILE, 'w') as f:
                json.dump(self._state, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Could not save update state: {e}")

    async def check_selfhst_feed(self) -> UpdateResult:
        """Check selfh.st RSS feed for new apps."""
        result = UpdateResult(
            source="selfhst",
            checked_at=datetime.utcnow()
        )

        content = await self.parser.fetch_feed(SELFHST_RSS_URL)
        if not content:
            result.error = "Failed to fetch feed"
            return result

        entries = self.parser.parse_selfhst_rss(content)

        # Filter out already known apps
        known = set(self._state.get("known_apps", []))
        new_entries = [e for e in entries if e.name.lower() not in known]

        result.new_entries = new_entries

        # Update state
        self._state["last_selfhst_check"] = datetime.utcnow().isoformat()
        for entry in new_entries:
            if entry.name.lower() not in known:
                self._state["known_apps"].append(entry.name.lower())

        self._save_state()

        return result

    async def check_awesome_selfhosted_feed(self) -> UpdateResult:
        """Check awesome-selfhosted Atom feed for new apps."""
        result = UpdateResult(
            source="awesome-selfhosted",
            checked_at=datetime.utcnow()
        )

        content = await self.parser.fetch_feed(AWESOME_SELFHOSTED_DATA_ATOM_URL)
        if not content:
            result.error = "Failed to fetch feed"
            return result

        entries = self.parser.parse_awesome_selfhosted_atom(content)

        # Filter out already known apps
        known = set(self._state.get("known_apps", []))
        new_entries = [e for e in entries if e.name.lower() not in known]

        result.new_entries = new_entries

        # Update state
        self._state["last_awesome_check"] = datetime.utcnow().isoformat()
        for entry in new_entries:
            if entry.name.lower() not in known:
                self._state["known_apps"].append(entry.name.lower())

        self._save_state()

        return result

    def generate_fingerprint_pattern(self, app: NewAppEntry) -> Tuple[str, str, str, str, str, str, float]:
        """
        Generate a fingerprint pattern for a new app.

        Returns:
            Tuple of (pattern_type, regex, app_type, icon, category, description, confidence)
        """
        # Clean app name
        app_name_clean = app.name.lower().replace(' ', '-').replace('_', '-')

        # Generate icon name (try common patterns)
        icon_name = app_name_clean

        # Default category based on source or keywords
        category = "other"
        if app.category:
            category = app.category

        # Generate description
        description = app.description or f"Application {app.name}"
        if len(description) > 100:
            description = description[:97] + "..."

        # Create regex pattern (case-insensitive match on title)
        pattern = f"(?i){re.escape(app.name)}"

        return (
            "title",
            pattern,
            app_name_clean,
            icon_name,
            category,
            description,
            0.85  # Slightly lower confidence for auto-discovered apps
        )

    async def add_patterns_to_database(self, apps: List[NewAppEntry]) -> int:
        """
        Add new fingerprint patterns to the database file.

        This appends new patterns to fingerprint_database.py

        Returns:
            Number of patterns added
        """
        if not apps:
            return 0

        # Path to the fingerprint database
        db_path = os.path.join(
            os.path.dirname(__file__),
            "fingerprint_database.py"
        )

        try:
            # Read current content
            with open(db_path, 'r') as f:
                content = f.read()

            # Find the insertion point (before the closing bracket)
            # Look for patterns like "]\n\n\ndef" or just "]\n\ndef"
            insertion_markers = [
                "]\n\n\ndef get_extended_fingerprints",
                "]\n\ndef get_extended_fingerprints",
            ]

            insertion_marker = None
            for marker in insertion_markers:
                if marker in content:
                    insertion_marker = marker
                    break

            if insertion_marker is None:
                logger.error("Could not find insertion point in fingerprint_database.py")
                return 0

            # Generate new patterns
            new_patterns = []
            for app in apps:
                pattern = self.generate_fingerprint_pattern(app)
                pattern_str = (
                    f'    ("title", r"(?i){re.escape(app.name)}", '
                    f'"{pattern[2]}", "{pattern[3]}", "{pattern[4]}", '
                    f'"{pattern[5]}", {pattern[6]}),'
                )
                new_patterns.append(pattern_str)

            if not new_patterns:
                return 0

            # Create the new section
            today = datetime.utcnow().strftime("%Y-%m-%d")
            new_section = f"""

    # ============================================================
    # AUTO-DISCOVERED APPS ({today})
    # Added automatically from RSS feeds
    # ============================================================
{chr(10).join(new_patterns)}
"""

            # Insert before the closing bracket
            new_content = content.replace(
                insertion_marker,
                new_section + insertion_marker
            )

            # Write back
            with open(db_path, 'w') as f:
                f.write(new_content)

            logger.info(f"Added {len(new_patterns)} new patterns to fingerprint database")

            # Record in history
            self._state["update_history"].append({
                "date": today,
                "apps_added": [app.name for app in apps],
                "count": len(apps)
            })
            # Keep only last 30 days of history
            self._state["update_history"] = self._state["update_history"][-30:]
            self._save_state()

            return len(new_patterns)

        except Exception as e:
            logger.error(f"Failed to update fingerprint database: {e}")
            return 0

    async def run_update(self, add_to_database: bool = True) -> Dict[str, Any]:
        """
        Run a full update check on all feeds.

        Args:
            add_to_database: Whether to automatically add new apps to the database

        Returns:
            Summary of the update operation
        """
        # Clear previous logs and start fresh
        self._current_logs = []

        self._log("info", "Démarrage de la vérification des mises à jour...", "system")

        results = {
            "started_at": datetime.utcnow().isoformat(),
            "feeds_checked": [],
            "total_new_apps": 0,
            "apps_added_to_database": 0,
            "errors": [],
            "mode": "dry_run" if not add_to_database else "update"
        }

        # Check selfh.st feed
        self._log("info", "Vérification du flux RSS selfh.st...", "selfhst")
        selfhst_result = await self.check_selfhst_feed()
        results["feeds_checked"].append({
            "source": "selfhst",
            "new_apps": len(selfhst_result.new_entries),
            "apps": [e.name for e in selfhst_result.new_entries],
            "error": selfhst_result.error
        })
        if selfhst_result.error:
            self._log("error", f"Erreur: {selfhst_result.error}", "selfhst")
            results["errors"].append(f"selfhst: {selfhst_result.error}")
        elif selfhst_result.new_entries:
            self._log("success", f"{len(selfhst_result.new_entries)} nouvelle(s) app(s) trouvée(s): {', '.join(e.name for e in selfhst_result.new_entries)}", "selfhst")
        else:
            self._log("info", "Aucune nouvelle application détectée", "selfhst")

        # Check awesome-selfhosted feed
        self._log("info", "Vérification du flux Atom awesome-selfhosted...", "awesome-selfhosted")
        awesome_result = await self.check_awesome_selfhosted_feed()
        results["feeds_checked"].append({
            "source": "awesome-selfhosted",
            "new_apps": len(awesome_result.new_entries),
            "apps": [e.name for e in awesome_result.new_entries],
            "error": awesome_result.error
        })
        if awesome_result.error:
            self._log("error", f"Erreur: {awesome_result.error}", "awesome-selfhosted")
            results["errors"].append(f"awesome-selfhosted: {awesome_result.error}")
        elif awesome_result.new_entries:
            self._log("success", f"{len(awesome_result.new_entries)} nouvelle(s) app(s) trouvée(s): {', '.join(e.name for e in awesome_result.new_entries)}", "awesome-selfhosted")
        else:
            self._log("info", "Aucune nouvelle application détectée", "awesome-selfhosted")

        # Combine all new apps
        all_new_apps = selfhst_result.new_entries + awesome_result.new_entries
        results["total_new_apps"] = len(all_new_apps)

        # Add to database if requested
        if add_to_database and all_new_apps:
            self._log("info", f"Ajout de {len(all_new_apps)} pattern(s) à la base de données...", "system")
            added = await self.add_patterns_to_database(all_new_apps)
            results["apps_added_to_database"] = added
            if added > 0:
                self._log("success", f"{added} pattern(s) ajouté(s) à fingerprint_database.py", "system")
            else:
                self._log("warning", "Aucun pattern ajouté (erreur ou doublons)", "system")
        elif not add_to_database:
            self._log("info", "Mode dry-run: aucune modification effectuée", "system")
        else:
            self._log("info", "Aucune nouvelle application à ajouter", "system")

        results["completed_at"] = datetime.utcnow().isoformat()

        # Calculate duration
        started = datetime.fromisoformat(results["started_at"])
        completed = datetime.fromisoformat(results["completed_at"])
        duration_ms = int((completed - started).total_seconds() * 1000)
        results["duration_ms"] = duration_ms

        if results["errors"]:
            self._log("warning", f"Terminé avec {len(results['errors'])} erreur(s) en {duration_ms}ms", "system")
        else:
            self._log("success", f"Mise à jour terminée avec succès en {duration_ms}ms", "system")

        # Save logs to state
        self._state["last_execution_logs"] = [
            {
                "timestamp": log.timestamp.isoformat(),
                "level": log.level,
                "message": log.message,
                "source": log.source
            }
            for log in self._current_logs
        ]
        self._state["last_execution_result"] = results
        self._save_state()

        return results

    def get_update_status(self) -> Dict[str, Any]:
        """Get the current update status and history."""
        return {
            "last_selfhst_check": self._state.get("last_selfhst_check"),
            "last_awesome_check": self._state.get("last_awesome_check"),
            "known_apps_count": len(self._state.get("known_apps", [])),
            "recent_history": self._state.get("update_history", [])[-10:],
            "last_execution_logs": self._state.get("last_execution_logs", []),
            "last_execution_result": self._state.get("last_execution_result"),
        }


# Global updater instance
_updater: Optional[DatabaseUpdater] = None


def get_updater() -> DatabaseUpdater:
    """Get or create the global updater instance."""
    global _updater
    if _updater is None:
        _updater = DatabaseUpdater()
    return _updater


async def run_nightly_update() -> Dict[str, Any]:
    """
    Entry point for the nightly cron job.

    This function should be called by the scheduler to perform
    the nightly database update.
    """
    updater = get_updater()
    return await updater.run_update(add_to_database=True)


async def check_for_updates_only() -> Dict[str, Any]:
    """
    Check for updates without modifying the database.

    Useful for preview/dry-run mode.
    """
    updater = get_updater()
    return await updater.run_update(add_to_database=False)
