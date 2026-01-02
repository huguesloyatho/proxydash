"""
HTTP Fingerprinting Service.
Detects application type by analyzing HTTP response content (HTML title, meta tags, headers, etc.)
This is used when subdomain-based detection fails.

Supports 500+ self-hosted applications from awesome-selfhosted and selfh.st sources.
Includes online fallback to awesome-selfhosted database for unknown apps.
"""

import re
import logging
import asyncio
from typing import Optional, Tuple, Dict, Any, List
from dataclasses import dataclass

import httpx

from app.services.fingerprint_database import get_extended_fingerprints, EXTENDED_FINGERPRINTS

logger = logging.getLogger(__name__)

# Flag to enable/disable online fallback
ENABLE_ONLINE_FALLBACK = True

# Timeout for HTTP requests (seconds)
HTTP_TIMEOUT = 10

# Maximum response size to analyze (bytes)
MAX_RESPONSE_SIZE = 100_000  # 100KB


@dataclass
class FingerprintResult:
    """Result of HTTP fingerprinting."""
    app_type: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    confidence: float = 0.0  # 0-1 confidence score
    detection_method: Optional[str] = None  # How it was detected


# HTTP Fingerprint patterns
# Format: List of (pattern_type, pattern, app_type, icon, category, description, confidence)
# pattern_type: 'title', 'meta_generator', 'meta_application', 'body', 'header', 'favicon'
HTTP_FINGERPRINTS = [
    # === Admin/Dashboard Apps ===
    ("title", r"(?i)heimdall", "heimdall", "heimdall", "admin", "Dashboard d'applications Heimdall", 0.95),
    ("title", r"(?i)homarr", "homarr", "homarr", "admin", "Dashboard de services Homarr", 0.95),
    ("title", r"(?i)dashy", "dashy", "dashy", "admin", "Dashboard personnalisable Dashy", 0.95),
    ("title", r"(?i)homer", "homer", "homer", "admin", "Dashboard de services Homer", 0.95),
    ("title", r"(?i)organizr", "organizr", "organizr", "admin", "Dashboard unifié Organizr", 0.95),
    ("title", r"(?i)flame", "flame", "flame", "admin", "Dashboard Flame", 0.95),
    ("title", r"(?i)portainer", "portainer", "portainer", "admin", "Gestion de containers Docker", 0.95),
    ("body", r"(?i)portainer\.io", "portainer", "portainer", "admin", "Gestion de containers Docker", 0.85),

    # === Media Apps ===
    ("title", r"(?i)plex", "plex", "plex", "media", "Serveur multimédia Plex", 0.95),
    ("title", r"(?i)jellyfin", "jellyfin", "jellyfin", "media", "Serveur multimédia Jellyfin", 0.95),
    ("title", r"(?i)emby", "emby", "emby", "media", "Serveur multimédia Emby", 0.95),
    ("title", r"(?i)sonarr", "sonarr", "sonarr", "media", "Gestionnaire de séries TV", 0.95),
    ("title", r"(?i)radarr", "radarr", "radarr", "media", "Gestionnaire de films", 0.95),
    ("title", r"(?i)lidarr", "lidarr", "lidarr", "media", "Gestionnaire de musique", 0.95),
    ("title", r"(?i)prowlarr", "prowlarr", "prowlarr", "media", "Gestionnaire d'indexeurs", 0.95),
    ("title", r"(?i)bazarr", "bazarr", "bazarr", "media", "Gestionnaire de sous-titres", 0.95),
    ("title", r"(?i)overseerr", "overseerr", "overseerr", "media", "Gestionnaire de requêtes média", 0.95),
    ("title", r"(?i)navidrome", "navidrome", "navidrome", "media", "Serveur de streaming musical", 0.95),
    ("title", r"(?i)calibre", "calibre", "calibre-web", "media", "Bibliothèque d'ebooks", 0.95),
    ("title", r"(?i)komga", "komga", "komga", "media", "Serveur de comics/manga", 0.95),
    ("title", r"(?i)kavita", "kavita", "kavita", "media", "Serveur de lecture", 0.95),

    # === Productivity Apps ===
    ("title", r"(?i)nextcloud", "nextcloud", "nextcloud", "productivity", "Cloud personnel Nextcloud", 0.95),
    ("meta_generator", r"(?i)nextcloud", "nextcloud", "nextcloud", "productivity", "Cloud personnel Nextcloud", 0.90),
    ("title", r"(?i)owncloud", "owncloud", "owncloud", "productivity", "Cloud personnel OwnCloud", 0.95),
    ("title", r"(?i)outline", "outline", "outline", "productivity", "Base de connaissances Outline", 0.95),
    ("title", r"(?i)bookstack", "bookstack", "bookstack", "productivity", "Documentation BookStack", 0.95),
    ("title", r"(?i)wiki\.?js", "wikijs", "wikijs", "productivity", "Wiki collaboratif Wiki.js", 0.95),
    ("meta_generator", r"(?i)wiki\.?js", "wikijs", "wikijs", "productivity", "Wiki collaboratif Wiki.js", 0.90),
    ("title", r"(?i)dokuwiki", "dokuwiki", "dokuwiki", "productivity", "Wiki DokuWiki", 0.95),
    ("title", r"(?i)mediawiki", "mediawiki", "mediawiki", "productivity", "Wiki MediaWiki", 0.95),
    ("title", r"(?i)n8n", "n8n", "n8n", "productivity", "Automatisation de workflows", 0.95),
    ("title", r"(?i)excalidraw", "excalidraw", "excalidraw", "productivity", "Tableau blanc collaboratif", 0.95),
    ("title", r"(?i)stirling.*pdf", "stirling-pdf", "stirling-pdf", "productivity", "Outils PDF Stirling", 0.95),
    ("title", r"(?i)paperless", "paperless", "paperless-ngx", "productivity", "Gestion documentaire Paperless", 0.95),
    ("title", r"(?i)freshrss", "freshrss", "freshrss", "productivity", "Agrégateur RSS FreshRSS", 0.95),
    ("title", r"(?i)miniflux", "miniflux", "miniflux", "productivity", "Lecteur RSS Miniflux", 0.95),
    ("title", r"(?i)mealie", "mealie", "mealie", "productivity", "Gestionnaire de recettes", 0.95),

    # === Monitoring Apps ===
    ("title", r"(?i)grafana", "grafana", "grafana", "monitoring", "Visualisation Grafana", 0.95),
    ("title", r"(?i)prometheus", "prometheus", "prometheus", "monitoring", "Métriques Prometheus", 0.95),
    ("title", r"(?i)zabbix", "zabbix", "zabbix", "monitoring", "Supervision Zabbix", 0.95),
    ("title", r"(?i)uptime.?kuma", "uptime-kuma", "uptime-kuma", "monitoring", "Monitoring Uptime Kuma", 0.95),
    ("title", r"(?i)netdata", "netdata", "netdata", "monitoring", "Monitoring temps réel Netdata", 0.95),
    ("title", r"(?i)dozzle", "dozzle", "dozzle", "monitoring", "Logs Docker Dozzle", 0.95),
    ("title", r"(?i)metabase", "metabase", "metabase", "monitoring", "Business intelligence Metabase", 0.95),
    ("title", r"(?i)openobserve", "openobserve", "open-observe", "monitoring", "Observabilité OpenObserve", 0.95),

    # === Network Apps ===
    ("title", r"(?i)pi.?hole", "pihole", "pi-hole", "network", "Blocage DNS Pi-hole", 0.95),
    ("title", r"(?i)adguard", "adguard", "adguard-home", "network", "Blocage DNS AdGuard", 0.95),
    ("title", r"(?i)headscale", "headscale", "headscale", "network", "Coordination Headscale", 0.95),
    ("title", r"(?i)unifi", "unifi", "unifi", "network", "Contrôleur UniFi", 0.95),
    ("title", r"(?i)omada", "omada", "omada", "network", "Contrôleur Omada", 0.95),

    # === Security Apps ===
    ("title", r"(?i)authelia", "authelia", "authelia", "security", "Authentification Authelia", 0.95),
    ("title", r"(?i)authentik", "authentik", "authentik", "security", "Identity provider Authentik", 0.95),
    ("title", r"(?i)keycloak", "keycloak", "keycloak", "security", "Gestion d'identités Keycloak", 0.95),
    ("title", r"(?i)vaultwarden", "vaultwarden", "vaultwarden", "security", "Gestionnaire de mots de passe", 0.95),
    ("title", r"(?i)bitwarden", "vaultwarden", "vaultwarden", "security", "Gestionnaire de mots de passe", 0.95),
    ("title", r"(?i)wazuh", "wazuh", "wazuh", "security", "Détection d'intrusions Wazuh", 0.95),

    # === Development Apps ===
    ("title", r"(?i)gitea", "gitea", "gitea", "development", "Forge Git Gitea", 0.95),
    ("meta_generator", r"(?i)gitea", "gitea", "gitea", "development", "Forge Git Gitea", 0.90),
    ("title", r"(?i)gitlab", "gitlab", "gitlab", "development", "Plateforme DevOps GitLab", 0.95),
    ("title", r"(?i)forgejo", "forgejo", "forgejo", "development", "Forge Git Forgejo", 0.95),
    ("title", r"(?i)gogs", "gogs", "gogs", "development", "Forge Git Gogs", 0.95),
    ("title", r"(?i)jenkins", "jenkins", "jenkins", "development", "CI/CD Jenkins", 0.95),
    ("title", r"(?i)drone", "drone", "drone", "development", "CI/CD Drone", 0.95),
    ("title", r"(?i)code.?server", "code-server", "code", "development", "VS Code web", 0.95),
    ("title", r"(?i)jupyter", "jupyter", "jupyter", "development", "Notebooks Jupyter", 0.95),
    ("title", r"(?i)open.?webui", "openwebui", "open-webui", "development", "Interface LLM Open WebUI", 0.95),

    # === Storage Apps ===
    ("title", r"(?i)minio", "minio", "minio", "storage", "Stockage objet MinIO", 0.95),
    ("title", r"(?i)syncthing", "syncthing", "syncthing", "storage", "Synchronisation Syncthing", 0.95),
    ("title", r"(?i)filebrowser", "filebrowser", "filebrowser", "storage", "Explorateur de fichiers", 0.95),
    ("title", r"(?i)photoprism", "photoprism", "photoprism", "storage", "Galerie photos PhotoPrism", 0.95),
    ("title", r"(?i)immich", "immich", "immich", "storage", "Galerie photos Immich", 0.95),

    # === Home Automation ===
    ("title", r"(?i)home.?assistant", "home-assistant", "home-assistant", "home", "Domotique Home Assistant", 0.95),
    ("title", r"(?i)node.?red", "node-red", "node-red", "home", "Automatisation Node-RED", 0.95),
    ("title", r"(?i)esphome", "esphome", "esphome", "home", "Firmware IoT ESPHome", 0.95),

    # === Communication Apps ===
    ("title", r"(?i)element", "element", "element", "communication", "Messagerie Element", 0.95),
    ("title", r"(?i)matrix", "matrix", "matrix", "communication", "Messagerie Matrix", 0.95),
    ("title", r"(?i)rocket\.?chat", "rocketchat", "rocket-chat", "communication", "Chat Rocket.Chat", 0.95),
    ("title", r"(?i)mattermost", "mattermost", "mattermost", "communication", "Messagerie Mattermost", 0.95),
    ("title", r"(?i)jitsi", "jitsi", "jitsi-meet", "communication", "Visioconférence Jitsi", 0.95),
    ("title", r"(?i)ntfy", "ntfy", "ntfy", "communication", "Notifications push Ntfy", 0.95),
    ("title", r"(?i)roundcube", "roundcube", "roundcube", "communication", "Webmail Roundcube", 0.95),
    ("title", r"(?i)snappymail", "snappymail", "snappymail", "communication", "Webmail SnappyMail", 0.95),

    # === Database Admin ===
    ("title", r"(?i)phpmyadmin", "phpmyadmin", "phpmyadmin", "admin", "Administration MySQL", 0.95),
    ("title", r"(?i)pgadmin", "pgadmin", "pgadmin", "admin", "Administration PostgreSQL", 0.95),
    ("title", r"(?i)adminer", "adminer", "adminer", "admin", "Administration de BDD", 0.95),

    # === Proxy/Reverse Proxy ===
    ("title", r"(?i)nginx.*proxy.*manager", "nginx-proxy-manager", "nginx-proxy-manager", "admin", "Gestion de reverse proxy", 0.95),
    ("title", r"(?i)traefik", "traefik", "traefik", "admin", "Reverse proxy Traefik", 0.95),

    # === Game Servers ===
    ("title", r"(?i)pterodactyl", "pterodactyl", "pterodactyl", "admin", "Gestion de serveurs de jeux", 0.95),
    ("title", r"(?i)amp.*instance.*manager", "amp", "pterodactyl", "admin", "Gestion de serveurs de jeux AMP", 0.95),

    # === Body patterns (lower confidence as they may have false positives) ===
    ("body", r"(?i)<[^>]*heimdall[^>]*logo", "heimdall", "heimdall", "admin", "Dashboard d'applications Heimdall", 0.80),
    ("body", r"(?i)powered.*by.*jellyfin", "jellyfin", "jellyfin", "media", "Serveur multimédia Jellyfin", 0.75),
    ("body", r"(?i)powered.*by.*plex", "plex", "plex", "media", "Serveur multimédia Plex", 0.75),
    ("body", r"(?i)grafana.*labs", "grafana", "grafana", "monitoring", "Visualisation Grafana", 0.75),

    # === Header patterns ===
    ("header", r"(?i)X-Powered-By.*nextcloud", "nextcloud", "nextcloud", "productivity", "Cloud personnel Nextcloud", 0.90),
    ("header", r"(?i)X-Frame-Options.*gitea", "gitea", "gitea", "development", "Forge Git Gitea", 0.85),
]

# Combine base patterns with extended database (500+ apps)
ALL_FINGERPRINTS = HTTP_FINGERPRINTS + EXTENDED_FINGERPRINTS


async def fingerprint_url(url: str, follow_redirects: bool = True) -> FingerprintResult:
    """
    Analyze a URL to detect the application type via HTTP fingerprinting.

    Args:
        url: The URL to analyze (e.g., "https://thor.masenam.com")
        follow_redirects: Whether to follow HTTP redirects

    Returns:
        FingerprintResult with detected app info or empty result if not detected
    """
    result = FingerprintResult()

    try:
        async with httpx.AsyncClient(
            timeout=HTTP_TIMEOUT,
            follow_redirects=follow_redirects,
            verify=False  # Allow self-signed certificates
        ) as client:
            response = await client.get(url)

            # Check response headers
            headers_str = str(response.headers)

            # Get response body (limited size)
            content = response.text[:MAX_RESPONSE_SIZE] if response.text else ""

            # Extract useful parts
            title = extract_title(content)
            meta_generator = extract_meta_generator(content)
            meta_application = extract_meta_application_name(content)

            # Try to match fingerprints (using combined database)
            best_match = None
            best_confidence = 0.0

            for pattern_type, pattern, app_type, icon, category, description, confidence in ALL_FINGERPRINTS:
                match = False
                search_text = ""

                if pattern_type == "title" and title:
                    search_text = title
                    match = re.search(pattern, title) is not None
                elif pattern_type == "meta_generator" and meta_generator:
                    search_text = meta_generator
                    match = re.search(pattern, meta_generator) is not None
                elif pattern_type == "meta_application" and meta_application:
                    search_text = meta_application
                    match = re.search(pattern, meta_application) is not None
                elif pattern_type == "body":
                    search_text = content
                    match = re.search(pattern, content) is not None
                elif pattern_type == "header":
                    search_text = headers_str
                    match = re.search(pattern, headers_str) is not None

                if match and confidence > best_confidence:
                    best_match = (app_type, icon, category, description, confidence, pattern_type)
                    best_confidence = confidence

            if best_match:
                result.app_type = best_match[0]
                result.icon = best_match[1]
                result.category = best_match[2]
                result.description = best_match[3]
                result.confidence = best_match[4]
                result.detection_method = f"http_{best_match[5]}"

                logger.info(
                    f"HTTP fingerprint detected: {url} -> {result.app_type} "
                    f"(confidence: {result.confidence}, method: {result.detection_method})"
                )
            else:
                # No match in local database - try online fallback
                if ENABLE_ONLINE_FALLBACK and title:
                    online_result = await _try_online_fallback(title, meta_generator, meta_application)
                    if online_result:
                        result = online_result
                        logger.info(
                            f"Online fallback detected: {url} -> {result.app_type} "
                            f"(confidence: {result.confidence}, method: {result.detection_method})"
                        )
                    else:
                        logger.debug(f"No HTTP fingerprint match for {url} (title: {title})")
                else:
                    logger.debug(f"No HTTP fingerprint match for {url} (title: {title})")

    except httpx.TimeoutException:
        logger.warning(f"HTTP fingerprint timeout for {url}")
    except httpx.RequestError as e:
        logger.warning(f"HTTP fingerprint request error for {url}: {e}")
    except Exception as e:
        logger.error(f"HTTP fingerprint error for {url}: {e}")

    return result


def extract_title(html: str) -> Optional[str]:
    """Extract the <title> tag content from HTML."""
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    return match.group(1).strip() if match else None


def extract_meta_generator(html: str) -> Optional[str]:
    """Extract the meta generator tag content."""
    match = re.search(
        r'<meta[^>]*name=["\']generator["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE
    )
    if not match:
        match = re.search(
            r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']generator["\']',
            html,
            re.IGNORECASE
        )
    return match.group(1).strip() if match else None


def extract_meta_application_name(html: str) -> Optional[str]:
    """Extract the meta application-name tag content."""
    match = re.search(
        r'<meta[^>]*name=["\']application-name["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE
    )
    if not match:
        match = re.search(
            r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']application-name["\']',
            html,
            re.IGNORECASE
        )
    return match.group(1).strip() if match else None


async def fingerprint_multiple(urls: list[str], max_concurrent: int = 5) -> Dict[str, FingerprintResult]:
    """
    Fingerprint multiple URLs concurrently.

    Args:
        urls: List of URLs to fingerprint
        max_concurrent: Maximum concurrent requests

    Returns:
        Dict mapping URL -> FingerprintResult
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def limited_fingerprint(url: str) -> Tuple[str, FingerprintResult]:
        async with semaphore:
            result = await fingerprint_url(url)
            return url, result

    tasks = [limited_fingerprint(url) for url in urls]
    results = await asyncio.gather(*tasks)

    return {url: result for url, result in results}


def get_icon_url(icon_name: str) -> str:
    """Get the Dashboard Icons URL for an icon."""
    return f"https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/{icon_name}.svg"


async def _try_online_fallback(
    title: Optional[str],
    meta_generator: Optional[str],
    meta_application: Optional[str]
) -> Optional[FingerprintResult]:
    """
    Try to find application info from online databases when local fingerprints fail.

    This function queries the awesome-selfhosted database to find matching apps.

    Args:
        title: The HTML title extracted from the page
        meta_generator: The meta generator tag content
        meta_application: The meta application-name tag content

    Returns:
        FingerprintResult if a match is found online, None otherwise
    """
    try:
        from app.services.online_app_lookup import lookup_app_online

        # Try to extract app name from title, meta tags
        search_terms = []

        if title:
            # Clean the title - remove common suffixes like "- Dashboard", "| Admin"
            cleaned_title = re.sub(r'\s*[-|]\s*.*$', '', title).strip()
            # Also try the first word (often the app name)
            first_word = cleaned_title.split()[0] if cleaned_title.split() else None
            if cleaned_title:
                search_terms.append(cleaned_title)
            if first_word and first_word != cleaned_title:
                search_terms.append(first_word)

        if meta_application:
            search_terms.append(meta_application)

        if meta_generator:
            search_terms.append(meta_generator)

        # Try each search term
        for term in search_terms:
            if not term or len(term) < 2:
                continue

            result = await lookup_app_online(term, detected_from_html=True)

            if result:
                return FingerprintResult(
                    app_type=result.app_name.lower().replace(' ', '-'),
                    icon=result.icon,
                    category=result.category,
                    description=result.description,
                    confidence=0.75,  # Lower confidence for online matches
                    detection_method="online_fallback"
                )

        return None

    except ImportError:
        logger.debug("Online lookup module not available")
        return None
    except Exception as e:
        logger.debug(f"Online fallback failed: {e}")
        return None


async def get_online_database_stats() -> Dict[str, Any]:
    """
    Get statistics about the online app database.

    Returns:
        Dict with database statistics
    """
    try:
        from app.services.online_app_lookup import get_app_count, get_parser

        count = await get_app_count()
        parser = await get_parser()

        return {
            "available": True,
            "app_count": count,
            "last_fetch": parser._last_fetch.isoformat() if parser._last_fetch else None,
            "source": "awesome-selfhosted"
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e)
        }
