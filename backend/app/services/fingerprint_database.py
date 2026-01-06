"""
Extended HTTP Fingerprint Database.
Contains 500+ self-hosted application patterns from awesome-selfhosted and selfh.st.
"""

from typing import List, Tuple

# Format: (pattern_type, regex_pattern, app_type, icon_name, category_slug, description, confidence)
# pattern_type: 'title', 'meta_generator', 'meta_application', 'body', 'header', 'favicon'

# Category mapping to our categories
CATEGORY_MAP = {
    # Map awesome-selfhosted categories to our slugs
    "analytics": "monitoring",
    "archiving": "storage",
    "automation": "productivity",
    "blogging": "productivity",
    "booking": "productivity",
    "bookmarks": "productivity",
    "calendar": "productivity",
    "communication": "communication",
    "cms": "productivity",
    "crm": "productivity",
    "database": "admin",
    "dns": "network",
    "document": "productivity",
    "ebook": "media",
    "ecommerce": "productivity",
    "feed": "productivity",
    "file": "storage",
    "games": "media",
    "genealogy": "productivity",
    "ai": "development",
    "groupware": "productivity",
    "health": "productivity",
    "hrm": "productivity",
    "iot": "home",
    "inventory": "productivity",
    "knowledge": "productivity",
    "learning": "productivity",
    "manufacturing": "productivity",
    "maps": "productivity",
    "media": "media",
    "misc": "other",
    "money": "productivity",
    "notes": "productivity",
    "office": "productivity",
    "password": "security",
    "pastebin": "productivity",
    "dashboard": "admin",
    "photo": "media",
    "polls": "productivity",
    "proxy": "network",
    "recipe": "productivity",
    "remote": "admin",
    "erp": "productivity",
    "search": "productivity",
    "selfhosting": "admin",
    "development": "development",
    "status": "monitoring",
    "tasks": "productivity",
    "ticketing": "productivity",
    "time": "productivity",
    "url": "productivity",
    "video": "monitoring",
    "web": "admin",
    "wiki": "productivity",
    "security": "security",
    "network": "network",
    "admin": "admin",
    "monitoring": "monitoring",
    "home": "home",
    "storage": "storage",
    "productivity": "productivity",
    "other": "other",
}


def get_category(cat: str) -> str:
    """Map category to our category slugs."""
    return CATEGORY_MAP.get(cat, "other")


# Extended fingerprint patterns
# Organized by category for maintainability

EXTENDED_FINGERPRINTS: List[Tuple[str, str, str, str, str, str, float]] = [
    # ============================================================
    # ANALYTICS & MONITORING
    # ============================================================
    ("title", r"(?i)aptabase", "aptabase", "aptabase", "monitoring", "Analytics open source Aptabase", 0.95),
    ("title", r"(?i)awstats", "awstats", "awstats", "monitoring", "Statistiques web AWStats", 0.95),
    ("title", r"(?i)countly", "countly", "countly", "monitoring", "Analytics mobile Countly", 0.95),
    ("title", r"(?i)goacccess", "goaccess", "goaccess", "monitoring", "Analyseur de logs GoAccess", 0.95),
    ("title", r"(?i)goatcounter", "goatcounter", "goatcounter", "monitoring", "Analytics GoatCounter", 0.95),
    ("title", r"(?i)matomo", "matomo", "matomo", "monitoring", "Analytics web Matomo", 0.95),
    ("title", r"(?i)metabase", "metabase", "metabase", "monitoring", "Business intelligence Metabase", 0.95),
    ("title", r"(?i)plausible", "plausible", "plausible", "monitoring", "Analytics Plausible", 0.95),
    ("title", r"(?i)posthog", "posthog", "posthog", "monitoring", "Product analytics PostHog", 0.95),
    ("title", r"(?i)redash", "redash", "redash", "monitoring", "Visualisation données Redash", 0.95),
    ("title", r"(?i)shynet", "shynet", "shynet", "monitoring", "Analytics Shynet", 0.95),
    ("title", r"(?i)superset", "superset", "superset", "monitoring", "BI Apache Superset", 0.95),
    ("title", r"(?i)umami", "umami", "umami", "monitoring", "Analytics Umami", 0.95),
    ("title", r"(?i)grafana", "grafana", "grafana", "monitoring", "Visualisation Grafana", 0.95),
    ("title", r"(?i)prometheus", "prometheus", "prometheus", "monitoring", "Métriques Prometheus", 0.95),
    ("title", r"(?i)zabbix", "zabbix", "zabbix", "monitoring", "Supervision Zabbix", 0.95),
    ("title", r"(?i)uptime.?kuma", "uptime-kuma", "uptime-kuma", "monitoring", "Monitoring Uptime Kuma", 0.95),
    ("title", r"(?i)netdata", "netdata", "netdata", "monitoring", "Monitoring temps réel Netdata", 0.95),
    ("title", r"(?i)glances", "glances", "glances", "monitoring", "Monitoring système Glances", 0.95),
    ("title", r"(?i)dozzle", "dozzle", "dozzle", "monitoring", "Logs Docker Dozzle", 0.95),
    ("title", r"(?i)openobserve", "openobserve", "open-observe", "monitoring", "Observabilité OpenObserve", 0.95),
    ("title", r"(?i)gatus", "gatus", "gatus", "monitoring", "Health dashboard Gatus", 0.95),
    ("title", r"(?i)statping", "statping", "statping-ng", "monitoring", "Status page Statping", 0.95),
    ("title", r"(?i)kener", "kener", "kener", "monitoring", "Status page Kener", 0.95),

    # ============================================================
    # ARCHIVING & DIGITAL PRESERVATION
    # ============================================================
    ("title", r"(?i)archivebox", "archivebox", "archivebox", "storage", "Archivage web ArchiveBox", 0.95),
    ("title", r"(?i)wallabag", "wallabag", "wallabag", "productivity", "Read-it-later Wallabag", 0.95),
    ("title", r"(?i)wayback", "wayback", "wayback", "storage", "Archive web Wayback", 0.95),

    # ============================================================
    # AUTOMATION
    # ============================================================
    ("title", r"(?i)activepieces", "activepieces", "activepieces", "productivity", "Automatisation Activepieces", 0.95),
    ("title", r"(?i)apache\s*airflow|airflow", "airflow", "airflow", "productivity", "Orchestration Airflow", 0.95),
    ("title", r"(?i)automatisch", "automatisch", "automatisch", "productivity", "Automatisation Automatisch", 0.95),
    ("title", r"(?i)changedetection", "changedetection", "changedetection-io", "productivity", "Détection de changements", 0.95),
    ("title", r"(?i)cronicle", "cronicle", "cronicle", "productivity", "Planificateur Cronicle", 0.95),
    ("title", r"(?i)healthchecks", "healthchecks", "healthchecks", "monitoring", "Cron monitoring Healthchecks", 0.95),
    ("title", r"(?i)huginn", "huginn", "huginn", "productivity", "Automatisation Huginn", 0.95),
    ("title", r"(?i)kestra", "kestra", "kestra", "productivity", "Orchestration Kestra", 0.95),
    ("title", r"(?i)n8n", "n8n", "n8n", "productivity", "Automatisation de workflows n8n", 0.95),
    ("title", r"(?i)olivetin", "olivetin", "olivetin", "admin", "Boutons shell OliveTin", 0.95),
    ("title", r"(?i)pyload", "pyload", "pyload", "media", "Gestionnaire téléchargements pyLoad", 0.95),
    ("title", r"(?i)stackstorm", "stackstorm", "stackstorm", "productivity", "Automatisation StackStorm", 0.95),

    # ============================================================
    # BLOGGING PLATFORMS
    # ============================================================
    ("title", r"(?i)ghost", "ghost", "ghost", "productivity", "Plateforme de blog Ghost", 0.95),
    ("meta_generator", r"(?i)ghost", "ghost", "ghost", "productivity", "Plateforme de blog Ghost", 0.90),
    ("title", r"(?i)writefreely", "writefreely", "writefreely", "productivity", "Blog minimaliste WriteFreely", 0.95),
    ("title", r"(?i)wordpress", "wordpress", "wordpress", "productivity", "CMS WordPress", 0.95),
    ("meta_generator", r"(?i)wordpress", "wordpress", "wordpress", "productivity", "CMS WordPress", 0.90),

    # ============================================================
    # BOOKMARKS & LINK SHARING
    # ============================================================
    ("title", r"(?i)linkace", "linkace", "linkace", "productivity", "Gestionnaire de liens LinkAce", 0.95),
    ("title", r"(?i)linkding", "linkding", "linkding", "productivity", "Gestionnaire de bookmarks Linkding", 0.95),
    ("title", r"(?i)linkwarden", "linkwarden", "linkwarden", "productivity", "Gestionnaire de liens LinkWarden", 0.95),
    ("title", r"(?i)shaarli", "shaarli", "shaarli", "productivity", "Bookmarks Shaarli", 0.95),
    ("title", r"(?i)shiori", "shiori", "shiori", "productivity", "Gestionnaire de bookmarks Shiori", 0.95),
    ("title", r"(?i)hoarder", "hoarder", "hoarder", "productivity", "Gestionnaire de bookmarks IA Hoarder", 0.95),

    # ============================================================
    # CALENDAR & CONTACTS
    # ============================================================
    ("title", r"(?i)baikal|baïkal", "baikal", "baikal", "productivity", "Serveur CalDAV/CardDAV Baïkal", 0.95),
    ("title", r"(?i)radicale", "radicale", "radicale", "productivity", "Serveur CalDAV/CardDAV Radicale", 0.95),

    # ============================================================
    # COMMUNICATION - CHAT & MESSAGING
    # ============================================================
    ("title", r"(?i)element", "element", "element", "communication", "Messagerie Element", 0.95),
    ("title", r"(?i)matrix", "matrix", "matrix", "communication", "Messagerie Matrix", 0.95),
    ("title", r"(?i)mattermost", "mattermost", "mattermost", "communication", "Messagerie Mattermost", 0.95),
    ("title", r"(?i)rocket\.?chat", "rocketchat", "rocket-chat", "communication", "Messagerie Rocket.Chat", 0.95),
    ("title", r"(?i)zulip", "zulip", "zulip", "communication", "Chat Zulip", 0.95),
    ("title", r"(?i)mumble", "mumble", "mumble", "communication", "Chat vocal Mumble", 0.95),
    ("title", r"(?i)revolt", "revolt", "revolt", "communication", "Chat Revolt", 0.95),
    ("title", r"(?i)gotify", "gotify", "gotify", "communication", "Notifications push Gotify", 0.95),
    ("title", r"(?i)ntfy", "ntfy", "ntfy", "communication", "Notifications push Ntfy", 0.95),
    ("title", r"(?i)apprise", "apprise", "apprise", "communication", "Notifications multi-plateforme", 0.95),

    # ============================================================
    # COMMUNICATION - EMAIL
    # ============================================================
    ("title", r"(?i)roundcube", "roundcube", "roundcube", "communication", "Webmail Roundcube", 0.95),
    ("title", r"(?i)snappymail", "snappymail", "snappymail", "communication", "Webmail SnappyMail", 0.95),
    ("title", r"(?i)mailcow", "mailcow", "mailcow", "communication", "Serveur mail Mailcow", 0.95),
    ("title", r"(?i)mailu", "mailu", "mailu", "communication", "Serveur mail Mailu", 0.95),
    ("title", r"(?i)listmonk", "listmonk", "listmonk", "communication", "Newsletter Listmonk", 0.95),
    ("title", r"(?i)mautic", "mautic", "mautic", "communication", "Marketing automation Mautic", 0.95),

    # ============================================================
    # COMMUNICATION - VIDEO CONFERENCING
    # ============================================================
    ("title", r"(?i)bigbluebutton", "bigbluebutton", "bigbluebutton", "communication", "Visioconférence BigBlueButton", 0.95),
    ("title", r"(?i)jitsi", "jitsi", "jitsi-meet", "communication", "Visioconférence Jitsi", 0.95),
    ("title", r"(?i)owncast", "owncast", "owncast", "media", "Streaming Owncast", 0.95),

    # ============================================================
    # COMMUNICATION - IRC
    # ============================================================
    ("title", r"(?i)the\s*lounge", "thelounge", "thelounge", "communication", "Client IRC The Lounge", 0.95),
    ("title", r"(?i)convos", "convos", "convos", "communication", "Client IRC Convos", 0.95),

    # ============================================================
    # CONTENT MANAGEMENT SYSTEMS (CMS)
    # ============================================================
    ("title", r"(?i)drupal", "drupal", "drupal", "productivity", "CMS Drupal", 0.95),
    ("meta_generator", r"(?i)drupal", "drupal", "drupal", "productivity", "CMS Drupal", 0.90),
    ("title", r"(?i)joomla", "joomla", "joomla", "productivity", "CMS Joomla", 0.95),
    ("meta_generator", r"(?i)joomla", "joomla", "joomla", "productivity", "CMS Joomla", 0.90),
    ("title", r"(?i)strapi", "strapi", "strapi", "development", "Headless CMS Strapi", 0.95),
    ("title", r"(?i)directus", "directus", "directus", "development", "Headless CMS Directus", 0.95),
    ("title", r"(?i)cockpit", "cockpit-cms", "cockpit", "productivity", "CMS Cockpit", 0.90),
    ("title", r"(?i)payload", "payload", "payload", "development", "Headless CMS Payload", 0.95),
    ("title", r"(?i)wagtail", "wagtail", "wagtail", "productivity", "CMS Wagtail", 0.95),

    # ============================================================
    # DATABASE MANAGEMENT
    # ============================================================
    ("title", r"(?i)adminer", "adminer", "adminer", "admin", "Administration de BDD Adminer", 0.95),
    ("title", r"(?i)phpmyadmin", "phpmyadmin", "phpmyadmin", "admin", "Administration MySQL phpMyAdmin", 0.95),
    ("title", r"(?i)pgadmin", "pgadmin", "pgadmin", "admin", "Administration PostgreSQL pgAdmin", 0.95),
    ("title", r"(?i)cloudbeaver", "cloudbeaver", "cloudbeaver", "admin", "Administration BDD CloudBeaver", 0.95),
    ("title", r"(?i)nocodb", "nocodb", "nocodb", "productivity", "Base de données NocoDB", 0.95),
    ("title", r"(?i)baserow", "baserow", "baserow", "productivity", "Base de données Baserow", 0.95),

    # ============================================================
    # DNS
    # ============================================================
    ("title", r"(?i)adguard", "adguard", "adguard-home", "network", "Blocage DNS AdGuard", 0.95),
    ("title", r"(?i)pi.?hole", "pihole", "pi-hole", "network", "Blocage DNS Pi-hole", 0.95),
    ("title", r"(?i)technitium", "technitium", "technitium-dns", "network", "Serveur DNS Technitium", 0.95),
    ("title", r"(?i)blocky", "blocky", "blocky", "network", "Blocage DNS Blocky", 0.95),

    # ============================================================
    # DOCUMENT MANAGEMENT
    # ============================================================
    ("title", r"(?i)paperless", "paperless", "paperless-ngx", "productivity", "Gestion documentaire Paperless", 0.95),
    ("title", r"(?i)docspell", "docspell", "docspell", "productivity", "Gestion documentaire Docspell", 0.95),
    ("title", r"(?i)stirling.*pdf", "stirling-pdf", "stirling-pdf", "productivity", "Outils PDF Stirling", 0.95),
    ("title", r"(?i)gotenberg", "gotenberg", "gotenberg", "productivity", "API de conversion Gotenberg", 0.95),
    ("title", r"(?i)opensign", "opensign", "opensign", "productivity", "Signature électronique OpenSign", 0.95),
    ("title", r"(?i)docuseal", "docuseal", "docuseal", "productivity", "Signature électronique DocuSeal", 0.95),

    # ============================================================
    # E-BOOKS
    # ============================================================
    ("title", r"(?i)calibre", "calibre", "calibre-web", "media", "Bibliothèque d'ebooks Calibre", 0.95),
    ("title", r"(?i)kavita", "kavita", "kavita", "media", "Serveur de lecture Kavita", 0.95),
    ("title", r"(?i)komga", "komga", "komga", "media", "Serveur de comics/manga Komga", 0.95),
    ("title", r"(?i)audiobookshelf", "audiobookshelf", "audiobookshelf", "media", "Livres audio Audiobookshelf", 0.95),
    ("title", r"(?i)stump", "stump", "stump", "media", "Serveur de comics Stump", 0.95),

    # ============================================================
    # FEED READERS
    # ============================================================
    ("title", r"(?i)freshrss", "freshrss", "freshrss", "productivity", "Agrégateur RSS FreshRSS", 0.95),
    ("title", r"(?i)miniflux", "miniflux", "miniflux", "productivity", "Lecteur RSS Miniflux", 0.95),
    ("title", r"(?i)tiny\s*tiny\s*rss", "ttrss", "tiny-tiny-rss", "productivity", "Lecteur RSS Tiny Tiny RSS", 0.95),
    ("title", r"(?i)newsblur", "newsblur", "newsblur", "productivity", "Lecteur RSS NewsBlur", 0.95),
    ("title", r"(?i)selfoss", "selfoss", "selfoss", "productivity", "Agrégateur RSS Selfoss", 0.95),
    ("title", r"(?i)rsshub", "rsshub", "rsshub", "productivity", "Générateur RSS RSSHub", 0.95),

    # ============================================================
    # FILE TRANSFER & SYNCHRONIZATION
    # ============================================================
    ("title", r"(?i)nextcloud", "nextcloud", "nextcloud", "productivity", "Cloud personnel Nextcloud", 0.95),
    ("meta_generator", r"(?i)nextcloud", "nextcloud", "nextcloud", "productivity", "Cloud personnel Nextcloud", 0.90),
    ("title", r"(?i)owncloud", "owncloud", "owncloud", "productivity", "Cloud personnel OwnCloud", 0.95),
    ("title", r"(?i)seafile", "seafile", "seafile", "storage", "Synchronisation Seafile", 0.95),
    ("title", r"(?i)syncthing", "syncthing", "syncthing", "storage", "Synchronisation Syncthing", 0.95),
    ("title", r"(?i)filebrowser", "filebrowser", "filebrowser", "storage", "Explorateur de fichiers FileBrowser", 0.95),
    ("title", r"(?i)filestash", "filestash", "filestash", "storage", "Explorateur de fichiers Filestash", 0.95),
    ("title", r"(?i)pydio", "pydio", "pydio", "storage", "Partage de fichiers Pydio", 0.95),

    # ============================================================
    # FILE TRANSFER - OBJECT STORAGE
    # ============================================================
    ("title", r"(?i)minio", "minio", "minio", "storage", "Stockage objet MinIO", 0.95),
    ("title", r"(?i)seaweedfs", "seaweedfs", "seaweedfs", "storage", "Stockage distribué SeaweedFS", 0.95),

    # ============================================================
    # FILE TRANSFER - PEER-TO-PEER
    # ============================================================
    ("title", r"(?i)transmission", "transmission", "transmission", "media", "Client BitTorrent Transmission", 0.95),
    ("title", r"(?i)qbittorrent", "qbittorrent", "qbittorrent", "media", "Client BitTorrent qBittorrent", 0.95),
    ("title", r"(?i)deluge", "deluge", "deluge", "media", "Client BitTorrent Deluge", 0.95),

    # ============================================================
    # FILE TRANSFER - SINGLE-CLICK UPLOAD
    # ============================================================
    ("title", r"(?i)send", "send", "send", "storage", "Partage de fichiers Send", 0.95),
    ("title", r"(?i)jirafeau", "jirafeau", "jirafeau", "storage", "Partage de fichiers Jirafeau", 0.95),
    ("title", r"(?i)pairdrop", "pairdrop", "pairdrop", "storage", "Transfert local PairDrop", 0.95),
    ("title", r"(?i)picoshare", "picoshare", "picoshare", "storage", "Partage de fichiers PicoShare", 0.95),
    ("title", r"(?i)projectsend", "projectsend", "projectsend", "storage", "Partage de fichiers ProjectSend", 0.95),
    ("title", r"(?i)zipline", "zipline", "zipline", "storage", "Partage de fichiers Zipline", 0.95),

    # ============================================================
    # GAMES - MANAGEMENT
    # ============================================================
    ("title", r"(?i)pterodactyl", "pterodactyl", "pterodactyl", "admin", "Gestion de serveurs de jeux Pterodactyl", 0.95),
    ("title", r"(?i)pelican\s*panel", "pelican", "pterodactyl", "admin", "Gestion de serveurs de jeux Pelican", 0.95),
    ("title", r"(?i)crafty", "crafty", "crafty-controller", "admin", "Gestion Minecraft Crafty", 0.95),
    ("title", r"(?i)pufferpanel", "pufferpanel", "pufferpanel", "admin", "Gestion de serveurs de jeux PufferPanel", 0.95),
    ("title", r"(?i)romm", "romm", "romm", "media", "Gestion de ROMs RomM", 0.95),
    ("title", r"(?i)gaseous", "gaseous", "gaseous", "media", "Gestion de ROMs Gaseous", 0.95),

    # ============================================================
    # GENERATIVE AI
    # ============================================================
    ("title", r"(?i)ollama", "ollama", "ollama", "development", "LLM local Ollama", 0.95),
    ("title", r"(?i)open.?webui", "openwebui", "open-webui", "development", "Interface LLM Open WebUI", 0.95),
    ("title", r"(?i)anything.?llm", "anythingllm", "anythingllm", "development", "Interface LLM AnythingLLM", 0.95),
    ("title", r"(?i)perplexica", "perplexica", "perplexica", "development", "Moteur de recherche IA Perplexica", 0.95),
    ("title", r"(?i)khoj", "khoj", "khoj", "development", "Assistant IA Khoj", 0.95),

    # ============================================================
    # GROUPWARE
    # ============================================================
    ("title", r"(?i)cozy\s*cloud", "cozy", "cozy-cloud", "productivity", "Cloud personnel Cozy", 0.95),
    ("title", r"(?i)zimbra", "zimbra", "zimbra", "productivity", "Groupware Zimbra", 0.95),
    ("title", r"(?i)sogo", "sogo", "sogo", "productivity", "Groupware SOGo", 0.95),
    ("title", r"(?i)egroupware", "egroupware", "egroupware", "productivity", "Groupware EGroupware", 0.95),

    # ============================================================
    # HEALTH & FITNESS
    # ============================================================
    ("title", r"(?i)fittrackee", "fittrackee", "fittrackee", "productivity", "Suivi fitness FitTrackee", 0.95),
    ("title", r"(?i)wger", "wger", "wger", "productivity", "Fitness manager Wger", 0.95),

    # ============================================================
    # HOME AUTOMATION (IoT)
    # ============================================================
    ("title", r"(?i)home.?assistant", "home-assistant", "home-assistant", "home", "Domotique Home Assistant", 0.95),
    ("title", r"(?i)openhab", "openhab", "openhab", "home", "Domotique openHAB", 0.95),
    ("title", r"(?i)domoticz", "domoticz", "domoticz", "home", "Domotique Domoticz", 0.95),
    ("title", r"(?i)node.?red", "node-red", "node-red", "home", "Automatisation Node-RED", 0.95),
    ("title", r"(?i)gladys", "gladys", "gladys", "home", "Assistant domotique Gladys", 0.95),
    ("title", r"(?i)iobroker", "iobroker", "iobroker", "home", "Domotique ioBroker", 0.95),
    ("title", r"(?i)esphome", "esphome", "esphome", "home", "Firmware IoT ESPHome", 0.95),
    ("title", r"(?i)zigbee2mqtt", "zigbee2mqtt", "zigbee2mqtt", "home", "Passerelle Zigbee Zigbee2MQTT", 0.95),
    ("title", r"(?i)evcc", "evcc", "evcc", "home", "Gestion de recharge EVCC", 0.95),

    # ============================================================
    # INVENTORY MANAGEMENT
    # ============================================================
    ("title", r"(?i)grocy", "grocy", "grocy", "productivity", "Gestion de stock Grocy", 0.95),
    ("title", r"(?i)homebox", "homebox", "homebox", "productivity", "Inventaire maison HomeBox", 0.95),
    ("title", r"(?i)inventree", "inventree", "inventree", "productivity", "Gestion d'inventaire InvenTree", 0.95),
    ("title", r"(?i)part.?db", "partdb", "part-db", "productivity", "Gestion de composants Part-DB", 0.95),
    ("title", r"(?i)shelf", "shelf", "shelf", "productivity", "Gestion d'actifs Shelf", 0.95),
    ("title", r"(?i)spoolman", "spoolman", "spoolman", "productivity", "Gestion de filaments Spoolman", 0.95),

    # ============================================================
    # KNOWLEDGE MANAGEMENT
    # ============================================================
    ("title", r"(?i)affine", "affine", "affine", "productivity", "Espace de travail AFFiNE", 0.95),
    ("title", r"(?i)siyuan", "siyuan", "siyuan", "productivity", "Notes SiYuan", 0.95),
    ("title", r"(?i)obsidian", "obsidian", "obsidian", "productivity", "Notes Obsidian", 0.95),
    ("title", r"(?i)logseq", "logseq", "logseq", "productivity", "Notes Logseq", 0.95),

    # ============================================================
    # LEARNING & COURSES
    # ============================================================
    ("title", r"(?i)moodle", "moodle", "moodle", "productivity", "Plateforme e-learning Moodle", 0.95),
    ("title", r"(?i)canvas\s*lms", "canvas", "canvas-lms", "productivity", "LMS Canvas", 0.95),
    ("title", r"(?i)chamilo", "chamilo", "chamilo", "productivity", "LMS Chamilo", 0.95),

    # ============================================================
    # MANUFACTURING & 3D PRINTING
    # ============================================================
    ("title", r"(?i)octoprint", "octoprint", "octoprint", "productivity", "Contrôle imprimante 3D OctoPrint", 0.95),
    ("title", r"(?i)fluidd", "fluidd", "fluidd", "productivity", "Interface Klipper Fluidd", 0.95),
    ("title", r"(?i)mainsail", "mainsail", "mainsail", "productivity", "Interface Klipper Mainsail", 0.95),
    ("title", r"(?i)manyfold", "manyfold", "manyfold", "productivity", "Gestion de modèles 3D Manyfold", 0.95),

    # ============================================================
    # MAPS & GPS
    # ============================================================
    ("title", r"(?i)adventurelog", "adventurelog", "adventurelog", "productivity", "Journal de voyage AdventureLog", 0.95),
    ("title", r"(?i)dawarich", "dawarich", "dawarich", "productivity", "Suivi de position Dawarich", 0.95),
    ("title", r"(?i)traccar", "traccar", "traccar", "productivity", "Suivi GPS Traccar", 0.95),
    ("title", r"(?i)owntracks", "owntracks", "owntracks", "productivity", "Suivi de position OwnTracks", 0.95),
    ("title", r"(?i)wanderer", "wanderer", "wanderer", "productivity", "Suivi de randonnées Wanderer", 0.95),

    # ============================================================
    # MEDIA MANAGEMENT
    # ============================================================
    ("title", r"(?i)sonarr", "sonarr", "sonarr", "media", "Gestionnaire de séries TV Sonarr", 0.95),
    ("title", r"(?i)radarr", "radarr", "radarr", "media", "Gestionnaire de films Radarr", 0.95),
    ("title", r"(?i)lidarr", "lidarr", "lidarr", "media", "Gestionnaire de musique Lidarr", 0.95),
    ("title", r"(?i)bazarr", "bazarr", "bazarr", "media", "Gestionnaire de sous-titres Bazarr", 0.95),
    ("title", r"(?i)prowlarr", "prowlarr", "prowlarr", "media", "Gestionnaire d'indexeurs Prowlarr", 0.95),
    ("title", r"(?i)overseerr", "overseerr", "overseerr", "media", "Gestionnaire de requêtes Overseerr", 0.95),
    ("title", r"(?i)jellyseerr", "jellyseerr", "jellyseerr", "media", "Gestionnaire de requêtes Jellyseerr", 0.95),
    ("title", r"(?i)ombi", "ombi", "ombi", "media", "Gestionnaire de requêtes Ombi", 0.95),
    ("title", r"(?i)tautulli", "tautulli", "tautulli", "media", "Statistiques Plex Tautulli", 0.95),
    ("title", r"(?i)metube", "metube", "metube", "media", "Téléchargeur YouTube MeTube", 0.95),
    ("title", r"(?i)tube\s*archivist", "tubearchivist", "tube-archivist", "media", "Archiveur YouTube Tube Archivist", 0.95),

    # ============================================================
    # MEDIA STREAMING - AUDIO
    # ============================================================
    ("title", r"(?i)navidrome", "navidrome", "navidrome", "media", "Serveur musical Navidrome", 0.95),
    ("title", r"(?i)ampache", "ampache", "ampache", "media", "Serveur musical Ampache", 0.95),
    ("title", r"(?i)funkwhale", "funkwhale", "funkwhale", "media", "Plateforme musicale Funkwhale", 0.95),
    ("title", r"(?i)koel", "koel", "koel", "media", "Streaming musical Koel", 0.95),
    ("title", r"(?i)gonic", "gonic", "gonic", "media", "Serveur Subsonic Gonic", 0.95),
    ("title", r"(?i)azuracast", "azuracast", "azuracast", "media", "Radio web AzuraCast", 0.95),
    ("title", r"(?i)libretime", "libretime", "libretime", "media", "Automatisation radio LibreTime", 0.95),
    ("title", r"(?i)pinepods", "pinepods", "pinepods", "media", "Podcasts Pinepods", 0.95),

    # ============================================================
    # MEDIA STREAMING - VIDEO
    # ============================================================
    ("title", r"(?i)plex", "plex", "plex", "media", "Serveur multimédia Plex", 0.95),
    ("title", r"(?i)jellyfin", "jellyfin", "jellyfin", "media", "Serveur multimédia Jellyfin", 0.95),
    ("title", r"(?i)emby", "emby", "emby", "media", "Serveur multimédia Emby", 0.95),
    ("title", r"(?i)peertube", "peertube", "peertube", "media", "Plateforme vidéo PeerTube", 0.95),
    ("title", r"(?i)invidious", "invidious", "invidious", "media", "Frontend YouTube Invidious", 0.95),
    ("title", r"(?i)stash", "stash", "stash", "media", "Organisateur de médias Stash", 0.95),
    ("title", r"(?i)kyoo", "kyoo", "kyoo", "media", "Serveur multimédia Kyoo", 0.95),

    # ============================================================
    # MISCELLANEOUS
    # ============================================================
    ("title", r"(?i)2fauth", "2fauth", "2fauth", "security", "Gestionnaire 2FA 2FAuth", 0.95),
    ("title", r"(?i)cyberchef", "cyberchef", "cyberchef", "development", "Outils crypto CyberChef", 0.95),
    ("title", r"(?i)it.?tools", "it-tools", "it-tools", "network", "Outils IT IT-Tools", 0.95),
    ("title", r"(?i)habitica", "habitica", "habitica", "productivity", "Gamification d'habitudes Habitica", 0.95),
    ("title", r"(?i)libretranslate", "libretranslate", "libretranslate", "productivity", "Traduction LibreTranslate", 0.95),
    ("title", r"(?i)languagetool", "languagetool", "languagetool", "productivity", "Correcteur LanguageTool", 0.95),
    ("title", r"(?i)reactive\s*resume", "reactive-resume", "reactive-resume", "productivity", "Créateur de CV Reactive Resume", 0.95),
    ("title", r"(?i)teslamate", "teslamate", "teslamate", "productivity", "Logger Tesla TeslaMate", 0.95),
    ("title", r"(?i)lubelogger", "lubelogger", "lubelogger", "productivity", "Suivi véhicule LubeLogger", 0.95),
    ("title", r"(?i)penpot", "penpot", "penpot", "productivity", "Design Penpot", 0.95),

    # ============================================================
    # MONEY & BUDGETING
    # ============================================================
    ("title", r"(?i)actual", "actual", "actual", "productivity", "Budget Actual", 0.95),
    ("title", r"(?i)firefly\s*iii", "firefly", "firefly-iii", "productivity", "Gestion financière Firefly III", 0.95),
    ("title", r"(?i)ghostfolio", "ghostfolio", "ghostfolio", "productivity", "Suivi de portefeuille Ghostfolio", 0.95),
    ("title", r"(?i)ihatemoney", "ihatemoney", "ihatemoney", "productivity", "Partage de dépenses IHateMoney", 0.95),
    ("title", r"(?i)maybe", "maybe", "maybe", "productivity", "Finances personnelles Maybe", 0.95),
    ("title", r"(?i)btcpay", "btcpay", "btcpay-server", "productivity", "Paiement Bitcoin BTCPay", 0.95),
    ("title", r"(?i)invoice\s*ninja", "invoiceninja", "invoice-ninja", "productivity", "Facturation Invoice Ninja", 0.95),
    ("title", r"(?i)invoiceplane", "invoiceplane", "invoiceplane", "productivity", "Facturation InvoicePlane", 0.95),
    ("title", r"(?i)wallos", "wallos", "wallos", "productivity", "Gestion d'abonnements Wallos", 0.95),

    # ============================================================
    # NOTE-TAKING & EDITORS
    # ============================================================
    ("title", r"(?i)joplin", "joplin", "joplin", "productivity", "Notes Joplin", 0.95),
    ("title", r"(?i)standard\s*notes", "standardnotes", "standard-notes", "productivity", "Notes chiffrées Standard Notes", 0.95),
    ("title", r"(?i)trilium", "trilium", "trilium", "productivity", "Notes hiérarchiques Trilium", 0.95),
    ("title", r"(?i)hedgedoc", "hedgedoc", "hedgedoc", "productivity", "Notes collaboratives HedgeDoc", 0.95),
    ("title", r"(?i)etherpad", "etherpad", "etherpad", "productivity", "Éditeur collaboratif Etherpad", 0.95),
    ("title", r"(?i)memos", "memos", "memos", "productivity", "Notes rapides Memos", 0.95),
    ("title", r"(?i)flatnotes", "flatnotes", "flatnotes", "productivity", "Notes plates Flatnotes", 0.95),
    ("title", r"(?i)silverbullet", "silverbullet", "silverbullet", "productivity", "Notes SilverBullet", 0.95),
    ("title", r"(?i)overleaf", "overleaf", "overleaf", "productivity", "Éditeur LaTeX Overleaf", 0.95),

    # ============================================================
    # OFFICE SUITES
    # ============================================================
    ("title", r"(?i)collabora", "collabora", "collabora-online", "productivity", "Suite bureautique Collabora", 0.95),
    ("title", r"(?i)onlyoffice", "onlyoffice", "onlyoffice", "productivity", "Suite bureautique OnlyOffice", 0.95),
    ("title", r"(?i)cryptpad", "cryptpad", "cryptpad", "productivity", "Suite chiffrée CryptPad", 0.95),
    ("title", r"(?i)grist", "grist", "grist", "productivity", "Tableur moderne Grist", 0.95),

    # ============================================================
    # PASSWORD MANAGERS
    # ============================================================
    ("title", r"(?i)vaultwarden", "vaultwarden", "vaultwarden", "security", "Gestionnaire de mots de passe Vaultwarden", 0.95),
    ("title", r"(?i)bitwarden", "bitwarden", "bitwarden", "security", "Gestionnaire de mots de passe Bitwarden", 0.95),
    ("title", r"(?i)passbolt", "passbolt", "passbolt", "security", "Gestionnaire de mots de passe Passbolt", 0.95),
    ("title", r"(?i)psono", "psono", "psono", "security", "Gestionnaire de mots de passe Psono", 0.95),

    # ============================================================
    # PASTEBINS
    # ============================================================
    ("title", r"(?i)privatebin", "privatebin", "privatebin", "productivity", "Pastebin chiffré PrivateBin", 0.95),
    ("title", r"(?i)hemmelig", "hemmelig", "hemmelig", "productivity", "Partage de secrets Hemmelig", 0.95),
    ("title", r"(?i)opengist", "opengist", "opengist", "development", "Partage de code OpenGist", 0.95),
    ("title", r"(?i)pastefy", "pastefy", "pastefy", "productivity", "Pastebin Pastefy", 0.95),
    ("title", r"(?i)yopass", "yopass", "yopass", "security", "Partage de secrets Yopass", 0.95),

    # ============================================================
    # PERSONAL DASHBOARDS
    # ============================================================
    ("title", r"(?i)heimdall", "heimdall", "heimdall", "admin", "Dashboard d'applications Heimdall", 0.95),
    ("title", r"(?i)homarr", "homarr", "homarr", "admin", "Dashboard de services Homarr", 0.95),
    ("title", r"(?i)dashy", "dashy", "dashy", "admin", "Dashboard personnalisable Dashy", 0.95),
    ("title", r"(?i)homer", "homer", "homer", "admin", "Dashboard de services Homer", 0.95),
    ("title", r"(?i)organizr", "organizr", "organizr", "admin", "Dashboard unifié Organizr", 0.95),
    ("title", r"(?i)flame", "flame", "flame", "admin", "Dashboard Flame", 0.95),
    ("title", r"(?i)glance", "glance", "glance", "admin", "Dashboard minimaliste Glance", 0.95),
    ("title", r"(?i)fenrus", "fenrus", "fenrus", "admin", "Dashboard Fenrus", 0.95),
    ("title", r"(?i)homepage", "homepage", "homepage", "admin", "Dashboard Homepage", 0.95),
    ("title", r"(?i)linkstack", "linkstack", "linkstack", "admin", "Page de liens LinkStack", 0.95),
    ("title", r"(?i)littlelink", "littlelink", "littlelink", "admin", "Page de liens LittleLink", 0.95),
    ("title", r"(?i)mafl", "mafl", "mafl", "admin", "Dashboard Mafl", 0.95),
    ("title", r"(?i)starbase", "starbase", "starbase-80", "admin", "Dashboard Starbase 80", 0.95),

    # ============================================================
    # PHOTO GALLERIES
    # ============================================================
    ("title", r"(?i)immich", "immich", "immich", "media", "Galerie photos Immich", 0.95),
    ("title", r"(?i)photoprism", "photoprism", "photoprism", "media", "Galerie photos PhotoPrism", 0.95),
    ("title", r"(?i)librephotos", "librephotos", "librephotos", "media", "Galerie photos LibrePhotos", 0.95),
    ("title", r"(?i)lychee", "lychee", "lychee", "media", "Galerie photos Lychee", 0.95),
    ("title", r"(?i)piwigo", "piwigo", "piwigo", "media", "Galerie photos Piwigo", 0.95),
    ("title", r"(?i)pigallery", "pigallery", "pigallery2", "media", "Galerie photos PiGallery 2", 0.95),
    ("title", r"(?i)photoview", "photoview", "photoview", "media", "Galerie photos Photoview", 0.95),
    ("title", r"(?i)ente", "ente", "ente", "media", "Galerie photos chiffrée Ente", 0.95),
    ("title", r"(?i)damselfly", "damselfly", "damselfly", "media", "Gestion de photos Damselfly", 0.95),

    # ============================================================
    # POLLS & EVENTS
    # ============================================================
    ("title", r"(?i)framadate", "framadate", "framadate", "productivity", "Sondages Framadate", 0.95),
    ("title", r"(?i)rallly", "rallly", "rallly", "productivity", "Planification Rallly", 0.95),
    ("title", r"(?i)limesurvey", "limesurvey", "limesurvey", "productivity", "Sondages LimeSurvey", 0.95),
    ("title", r"(?i)mobilizon", "mobilizon", "mobilizon", "productivity", "Événements Mobilizon", 0.95),
    ("title", r"(?i)fider", "fider", "fider", "productivity", "Feedback Fider", 0.95),
    ("title", r"(?i)formbricks", "formbricks", "formbricks", "productivity", "Sondages Formbricks", 0.95),
    ("title", r"(?i)heyform", "heyform", "heyform", "productivity", "Formulaires HeyForm", 0.95),

    # ============================================================
    # PROXY & REVERSE PROXY
    # ============================================================
    ("title", r"(?i)nginx\s*proxy\s*manager", "npm", "nginx-proxy-manager", "admin", "Gestion de reverse proxy NPM", 0.95),
    ("title", r"(?i)traefik", "traefik", "traefik", "admin", "Reverse proxy Traefik", 0.95),
    ("title", r"(?i)caddy", "caddy", "caddy", "admin", "Serveur web Caddy", 0.95),
    ("title", r"(?i)zoraxy", "zoraxy", "zoraxy", "admin", "Reverse proxy Zoraxy", 0.95),

    # ============================================================
    # RECIPE MANAGEMENT
    # ============================================================
    ("title", r"(?i)mealie", "mealie", "mealie", "productivity", "Gestionnaire de recettes Mealie", 0.95),
    ("title", r"(?i)tandoor|recipes", "tandoor", "tandoor", "productivity", "Gestionnaire de recettes Tandoor", 0.95),
    ("title", r"(?i)kitchenowl", "kitchenowl", "kitchenowl", "productivity", "Liste de courses KitchenOwl", 0.95),
    ("title", r"(?i)recipesage", "recipesage", "recipesage", "productivity", "Gestionnaire de recettes RecipeSage", 0.95),
    ("title", r"(?i)bar\s*assistant", "bar-assistant", "bar-assistant", "productivity", "Gestion de bar Bar Assistant", 0.95),

    # ============================================================
    # REMOTE ACCESS
    # ============================================================
    ("title", r"(?i)guacamole", "guacamole", "guacamole", "admin", "Bureau distant Guacamole", 0.95),
    ("title", r"(?i)meshcentral", "meshcentral", "meshcentral", "admin", "Gestion à distance MeshCentral", 0.95),
    ("title", r"(?i)remotely", "remotely", "remotely", "admin", "Support à distance Remotely", 0.95),
    ("title", r"(?i)rustdesk", "rustdesk", "rustdesk", "admin", "Bureau distant RustDesk", 0.95),
    ("title", r"(?i)sshwifty", "sshwifty", "sshwifty", "admin", "Client SSH web Sshwifty", 0.95),

    # ============================================================
    # RESOURCE PLANNING (ERP)
    # ============================================================
    ("title", r"(?i)odoo", "odoo", "odoo", "productivity", "ERP Odoo", 0.95),
    ("title", r"(?i)erpnext", "erpnext", "erpnext", "productivity", "ERP ERPNext", 0.95),
    ("title", r"(?i)dolibarr", "dolibarr", "dolibarr", "productivity", "ERP/CRM Dolibarr", 0.95),

    # ============================================================
    # SEARCH ENGINES
    # ============================================================
    ("title", r"(?i)searxng", "searxng", "searxng", "productivity", "Métamoteur SearXNG", 0.95),
    ("title", r"(?i)whoogle", "whoogle", "whoogle", "productivity", "Google sans tracking Whoogle", 0.95),
    ("title", r"(?i)meilisearch", "meilisearch", "meilisearch", "development", "Moteur de recherche Meilisearch", 0.95),

    # ============================================================
    # SECURITY
    # ============================================================
    ("title", r"(?i)authelia", "authelia", "authelia", "security", "Authentification SSO Authelia", 0.95),
    ("title", r"(?i)authentik", "authentik", "authentik", "security", "Identity provider Authentik", 0.95),
    ("title", r"(?i)keycloak", "keycloak", "keycloak", "security", "Gestion d'identités Keycloak", 0.95),
    ("title", r"(?i)wazuh", "wazuh", "wazuh", "security", "SIEM Wazuh", 0.95),
    ("title", r"(?i)crowdsec", "crowdsec", "crowdsec", "security", "Protection collaborative CrowdSec", 0.95),
    ("title", r"(?i)firezone", "firezone", "firezone", "network", "VPN WireGuard Firezone", 0.95),

    # ============================================================
    # SELF-HOSTING SOLUTIONS
    # ============================================================
    ("title", r"(?i)casaos", "casaos", "casaos", "admin", "OS self-hosted CasaOS", 0.95),
    ("title", r"(?i)yunohost", "yunohost", "yunohost", "admin", "Serveur personnel YunoHost", 0.95),
    ("title", r"(?i)umbrel", "umbrel", "umbrel", "admin", "OS self-hosted Umbrel", 0.95),
    ("title", r"(?i)runtipi|tipi", "tipi", "runtipi", "admin", "Gestionnaire d'apps Tipi", 0.95),
    ("title", r"(?i)cloudron", "cloudron", "cloudron", "admin", "Plateforme d'apps Cloudron", 0.95),
    ("title", r"(?i)cosmos", "cosmos", "cosmos", "admin", "Gestionnaire de serveur Cosmos", 0.95),

    # ============================================================
    # SOFTWARE DEVELOPMENT - IDE & TOOLS
    # ============================================================
    ("title", r"(?i)code.?server", "code-server", "code", "development", "VS Code web Code-Server", 0.95),
    ("title", r"(?i)coder", "coder", "coder", "development", "Environnement de dev Coder", 0.95),
    ("title", r"(?i)jupyter", "jupyter", "jupyter", "development", "Notebooks Jupyter", 0.95),
    ("title", r"(?i)rstudio", "rstudio", "rstudio", "development", "IDE R RStudio", 0.95),

    # ============================================================
    # SOFTWARE DEVELOPMENT - PROJECT MANAGEMENT
    # ============================================================
    ("title", r"(?i)gitea", "gitea", "gitea", "development", "Forge Git Gitea", 0.95),
    ("meta_generator", r"(?i)gitea", "gitea", "gitea", "development", "Forge Git Gitea", 0.90),
    ("title", r"(?i)gitlab", "gitlab", "gitlab", "development", "Plateforme DevOps GitLab", 0.95),
    ("title", r"(?i)forgejo", "forgejo", "forgejo", "development", "Forge Git Forgejo", 0.95),
    ("title", r"(?i)gogs", "gogs", "gogs", "development", "Forge Git Gogs", 0.95),
    ("title", r"(?i)onedev", "onedev", "onedev", "development", "DevOps OneDev", 0.95),
    ("title", r"(?i)sourcehut", "sourcehut", "sourcehut", "development", "Forge Git SourceHut", 0.95),
    ("title", r"(?i)jenkins", "jenkins", "jenkins", "development", "CI/CD Jenkins", 0.95),
    ("title", r"(?i)drone", "drone", "drone", "development", "CI/CD Drone", 0.95),
    ("title", r"(?i)woodpecker", "woodpecker", "woodpecker-ci", "development", "CI/CD Woodpecker", 0.95),
    ("title", r"(?i)redmine", "redmine", "redmine", "development", "Gestion de projet Redmine", 0.95),
    ("title", r"(?i)openproject", "openproject", "openproject", "development", "Gestion de projet OpenProject", 0.95),
    ("title", r"(?i)taiga", "taiga", "taiga", "development", "Gestion agile Taiga", 0.95),
    ("title", r"(?i)plane", "plane", "plane", "development", "Gestion de projet Plane", 0.95),
    ("title", r"(?i)huly", "huly", "huly", "development", "Gestion de projet Huly", 0.95),
    ("title", r"(?i)leantime", "leantime", "leantime", "development", "Gestion de projet Leantime", 0.95),

    # ============================================================
    # STATUS / UPTIME PAGES
    # ============================================================
    ("title", r"(?i)uptime.?kuma", "uptime-kuma", "uptime-kuma", "monitoring", "Monitoring Uptime Kuma", 0.95),
    ("title", r"(?i)gatus", "gatus", "gatus", "monitoring", "Health dashboard Gatus", 0.95),
    ("title", r"(?i)statping", "statping", "statping-ng", "monitoring", "Status page Statping", 0.95),
    ("title", r"(?i)cstate", "cstate", "cstate", "monitoring", "Status page cState", 0.95),

    # ============================================================
    # TASK MANAGEMENT & TO-DO LISTS
    # ============================================================
    ("title", r"(?i)vikunja", "vikunja", "vikunja", "productivity", "Gestion de tâches Vikunja", 0.95),
    ("title", r"(?i)wekan", "wekan", "wekan", "productivity", "Kanban Wekan", 0.95),
    ("title", r"(?i)kanboard", "kanboard", "kanboard", "productivity", "Kanban Kanboard", 0.95),
    ("title", r"(?i)focalboard", "focalboard", "focalboard", "productivity", "Kanban Focalboard", 0.95),
    ("title", r"(?i)planka", "planka", "planka", "productivity", "Kanban Planka", 0.95),
    ("title", r"(?i)appflowy", "appflowy", "appflowy", "productivity", "Notes et tâches AppFlowy", 0.95),
    ("title", r"(?i)tasks\.md", "tasksmd", "tasks-md", "productivity", "Gestion de tâches Tasks.md", 0.95),

    # ============================================================
    # TICKETING
    # ============================================================
    ("title", r"(?i)zammad", "zammad", "zammad", "productivity", "Helpdesk Zammad", 0.95),
    ("title", r"(?i)freescout", "freescout", "freescout", "productivity", "Helpdesk FreeScout", 0.95),
    ("title", r"(?i)uvdesk", "uvdesk", "uvdesk", "productivity", "Helpdesk UVdesk", 0.95),
    ("title", r"(?i)glitchtip", "glitchtip", "glitchtip", "development", "Tracking d'erreurs GlitchTip", 0.95),
    ("title", r"(?i)bugzilla", "bugzilla", "bugzilla", "development", "Bug tracker Bugzilla", 0.95),
    ("title", r"(?i)mantis", "mantis", "mantisbt", "development", "Bug tracker MantisBT", 0.95),

    # ============================================================
    # TIME TRACKING
    # ============================================================
    ("title", r"(?i)kimai", "kimai", "kimai", "productivity", "Suivi du temps Kimai", 0.95),
    ("title", r"(?i)activitywatch", "activitywatch", "activitywatch", "productivity", "Suivi d'activité ActivityWatch", 0.95),
    ("title", r"(?i)traggo", "traggo", "traggo", "productivity", "Suivi du temps Traggo", 0.95),
    ("title", r"(?i)wakapi", "wakapi", "wakapi", "development", "Suivi de codage Wakapi", 0.95),
    ("title", r"(?i)solidtime", "solidtime", "solidtime", "productivity", "Suivi du temps Solidtime", 0.95),

    # ============================================================
    # URL SHORTENERS
    # ============================================================
    ("title", r"(?i)yourls", "yourls", "yourls", "productivity", "Raccourcisseur d'URL YOURLS", 0.95),
    ("title", r"(?i)shlink", "shlink", "shlink", "productivity", "Raccourcisseur d'URL Shlink", 0.95),
    ("title", r"(?i)kutt", "kutt", "kutt", "productivity", "Raccourcisseur d'URL Kutt", 0.95),

    # ============================================================
    # VIDEO SURVEILLANCE
    # ============================================================
    ("title", r"(?i)frigate", "frigate", "frigate", "monitoring", "NVR avec IA Frigate", 0.95),
    ("title", r"(?i)zoneminder", "zoneminder", "zoneminder", "monitoring", "Vidéosurveillance ZoneMinder", 0.95),
    ("title", r"(?i)shinobi", "shinobi", "shinobi", "monitoring", "NVR Shinobi", 0.95),
    ("title", r"(?i)viseron", "viseron", "viseron", "monitoring", "NVR avec IA Viseron", 0.95),

    # ============================================================
    # WEB SERVERS & PROXY
    # ============================================================
    ("title", r"(?i)portainer", "portainer", "portainer", "admin", "Gestion Docker Portainer", 0.95),
    ("title", r"(?i)yacht", "yacht", "yacht", "admin", "Gestion Docker Yacht", 0.95),
    ("title", r"(?i)dockge", "dockge", "dockge", "admin", "Gestion Docker Dockge", 0.95),

    # ============================================================
    # WIKIS
    # ============================================================
    ("title", r"(?i)wiki\.?js", "wikijs", "wikijs", "productivity", "Wiki Wiki.js", 0.95),
    ("meta_generator", r"(?i)wiki\.?js", "wikijs", "wikijs", "productivity", "Wiki Wiki.js", 0.90),
    ("title", r"(?i)bookstack", "bookstack", "bookstack", "productivity", "Documentation BookStack", 0.95),
    ("title", r"(?i)outline", "outline", "outline", "productivity", "Wiki Outline", 0.95),
    ("title", r"(?i)dokuwiki", "dokuwiki", "dokuwiki", "productivity", "Wiki DokuWiki", 0.95),
    ("title", r"(?i)mediawiki", "mediawiki", "mediawiki", "productivity", "Wiki MediaWiki", 0.95),
    ("title", r"(?i)xwiki", "xwiki", "xwiki", "productivity", "Wiki XWiki", 0.95),
    ("title", r"(?i)docmost", "docmost", "docmost", "productivity", "Documentation Docmost", 0.95),
    ("title", r"(?i)gollum", "gollum", "gollum", "productivity", "Wiki Git Gollum", 0.95),

    # ============================================================
    # CRM
    # ============================================================
    ("title", r"(?i)espocrm", "espocrm", "espocrm", "productivity", "CRM EspoCRM", 0.95),
    ("title", r"(?i)suitecrm", "suitecrm", "suitecrm", "productivity", "CRM SuiteCRM", 0.95),
    ("title", r"(?i)monica", "monica", "monica", "productivity", "CRM personnel Monica", 0.95),
    ("title", r"(?i)twenty", "twenty", "twenty", "productivity", "CRM Twenty", 0.95),

    # ============================================================
    # NETWORK & VPN
    # ============================================================
    ("title", r"(?i)headscale", "headscale", "headscale", "network", "Coordination Tailscale Headscale", 0.95),
    ("title", r"(?i)wireguard", "wireguard", "wireguard", "network", "VPN WireGuard", 0.95),
    ("title", r"(?i)netbird", "netbird", "netbird", "network", "VPN mesh NetBird", 0.95),
    ("title", r"(?i)netmaker", "netmaker", "netmaker", "network", "Réseau mesh Netmaker", 0.95),
    ("title", r"(?i)tailscale", "tailscale", "tailscale", "network", "VPN mesh Tailscale", 0.95),
    ("title", r"(?i)zerotier", "zerotier", "zerotier", "network", "VPN mesh ZeroTier", 0.95),
    ("title", r"(?i)unifi", "unifi", "unifi", "network", "Contrôleur UniFi", 0.95),
    ("title", r"(?i)omada", "omada", "omada", "network", "Contrôleur Omada", 0.95),

    # ============================================================
    # ADDITIONAL APPS FROM SELFH.ST
    # ============================================================
    ("title", r"(?i)appsmith", "appsmith", "appsmith", "development", "Low-code Appsmith", 0.95),
    ("title", r"(?i)appwrite", "appwrite", "appwrite", "development", "Backend as a Service Appwrite", 0.95),
    ("title", r"(?i)budibase", "budibase", "budibase", "development", "Low-code Budibase", 0.95),
    ("title", r"(?i)tooljet", "tooljet", "tooljet", "development", "Low-code ToolJet", 0.95),
    ("title", r"(?i)n8n", "n8n", "n8n", "productivity", "Automatisation n8n", 0.95),
    ("title", r"(?i)windmill", "windmill", "windmill", "development", "Scripts et workflows Windmill", 0.95),
    ("title", r"(?i)pocketbase", "pocketbase", "pocketbase", "development", "Backend PocketBase", 0.95),
    ("title", r"(?i)supabase", "supabase", "supabase", "development", "Backend Supabase", 0.95),
    ("title", r"(?i)nhost", "nhost", "nhost", "development", "Backend Nhost", 0.95),

    # ============================================================
    # SELFH.ST 2025 NEW APPS
    # ============================================================
    # These are new apps featured on selfh.st in 2025
    ("title", r"(?i)arcane", "arcane", "arcane", "admin", "Gestionnaire d'applications Arcane", 0.95),
    ("title", r"(?i)bentopdf", "bentopdf", "stirling-pdf", "productivity", "Outils PDF BentoPDF", 0.95),
    ("title", r"(?i)booklore", "booklore", "calibre-web", "media", "Gestion de livres BookLore", 0.95),
    ("title", r"(?i)docker.?compose.?maker", "docker-compose-maker", "docker", "admin", "Générateur Docker Compose", 0.95),
    ("title", r"(?i)ironcalc", "ironcalc", "libreoffice", "productivity", "Tableur en ligne IronCalc", 0.95),
    ("title", r"(?i)loggifly", "loggifly", "dozzle", "monitoring", "Visualisation de logs LoggiFly", 0.95),
    ("title", r"(?i)bichon", "bichon", "homarr", "admin", "Dashboard Bichon", 0.95),
    ("title", r"(?i)eonvelope", "eonvelope", "firefly-iii", "productivity", "Budget par enveloppes Eonvelope", 0.95),
    ("title", r"(?i)mail.?archiver", "mail-archiver", "mailpile", "productivity", "Archivage d'emails Mail Archiver", 0.95),
    ("title", r"(?i)openarchiver", "openarchiver", "archivebox", "storage", "Archivage OpenArchiver", 0.95),
    ("title", r"(?i)gmail.?cleaner", "gmail-cleaner", "gmail", "productivity", "Nettoyeur Gmail", 0.95),
    ("title", r"(?i)cinephage", "cinephage", "jellyfin", "media", "Gestionnaire de films Cinephage", 0.95),
    ("title", r"(?i)mediamanager", "mediamanager", "jellyfin", "media", "Gestionnaire de médias MediaManager", 0.95),
    ("title", r"(?i)mydia", "mydia", "jellyfin", "media", "Gestionnaire de médias Mydia", 0.95),
    ("title", r"(?i)notediscovery", "notediscovery", "obsidian", "productivity", "Découverte de notes NoteDiscovery", 0.95),
    ("title", r"(?i)pangolin", "pangolin", "traefik", "network", "Reverse proxy Pangolin", 0.95),
    ("title", r"(?i)papra", "papra", "paperless-ngx", "productivity", "Gestion documentaire Papra", 0.95),
    ("title", r"(?i)patchmon", "patchmon", "uptime-kuma", "monitoring", "Monitoring de patches PatchMon", 0.95),
    ("title", r"(?i)postgresus", "postgresus", "pgadmin", "admin", "Gestion PostgreSQL Postgresus", 0.95),
    ("title", r"(?i)poznote", "poznote", "obsidian", "productivity", "Notes Poznote", 0.95),
    ("title", r"(?i)rybbit", "rybbit", "plausible", "monitoring", "Analytics Rybbit", 0.95),
    ("title", r"(?i)sync.?in", "sync-in", "syncthing", "storage", "Synchronisation Sync-in", 0.95),
    ("title", r"(?i)tinyauth", "tinyauth", "authelia", "security", "Authentification Tinyauth", 0.95),
    ("title", r"(?i)upvote.?rss", "upvote-rss", "freshrss", "productivity", "Agrégateur RSS Upvote RSS", 0.95),
    ("title", r"(?i)warracker", "warracker", "homepage", "productivity", "Suivi de garanties Warracker", 0.95),
    ("title", r"(?i)zerobyte", "zerobyte", "filebrowser", "storage", "Partage de fichiers Zerobyte", 0.95),

    # ============================================================
    # ADDITIONAL POPULAR APPS FROM AWESOME-SELFHOSTED
    # ============================================================
    ("title", r"(?i)reveal\.?js", "revealjs", "revealjs", "productivity", "Présentations Reveal.js", 0.95),
    ("title", r"(?i)alltube", "alltube", "alltube", "media", "Téléchargeur YouTube AllTube", 0.95),
    ("title", r"(?i)discourse", "discourse", "discourse", "communication", "Forum Discourse", 0.95),
    ("meta_generator", r"(?i)discourse", "discourse", "discourse", "communication", "Forum Discourse", 0.90),
    ("title", r"(?i)mastodon", "mastodon", "mastodon", "communication", "Réseau social Mastodon", 0.95),
    ("meta_generator", r"(?i)mastodon", "mastodon", "mastodon", "communication", "Réseau social Mastodon", 0.90),
    ("title", r"(?i)hexo", "hexo", "hexo", "productivity", "Blog statique Hexo", 0.95),
    ("meta_generator", r"(?i)hexo", "hexo", "hexo", "productivity", "Blog statique Hexo", 0.90),
    ("title", r"(?i)streama", "streama", "streama", "media", "Serveur de streaming Streama", 0.95),
    ("title", r"(?i)akaunting", "akaunting", "akaunting", "productivity", "Comptabilité Akaunting", 0.95),
    ("title", r"(?i)tiddlywiki", "tiddlywiki", "tiddlywiki", "productivity", "Wiki personnel TiddlyWiki", 0.95),

    # ============================================================
    # MORE APPS FROM SELFH.ST WEEKLY
    # ============================================================
    ("title", r"(?i)coolify", "coolify", "coolify", "admin", "PaaS self-hosted Coolify", 0.95),
    ("title", r"(?i)dokploy", "dokploy", "dokploy", "admin", "PaaS self-hosted Dokploy", 0.95),
    ("title", r"(?i)caprover", "caprover", "caprover", "admin", "PaaS self-hosted CapRover", 0.95),
    ("title", r"(?i)sablier", "sablier", "sablier", "admin", "Scale to zero Sablier", 0.95),
    ("title", r"(?i)listmonk", "listmonk", "listmonk", "communication", "Newsletter Listmonk", 0.95),
    ("title", r"(?i)mailtrain", "mailtrain", "mailtrain", "communication", "Newsletter Mailtrain", 0.95),
    ("title", r"(?i)postal", "postal", "postal", "communication", "Serveur mail Postal", 0.95),
    ("title", r"(?i)mailcow", "mailcow", "mailcow", "communication", "Suite mail Mailcow", 0.95),
    ("title", r"(?i)modoboa", "modoboa", "modoboa", "communication", "Suite mail Modoboa", 0.95),
    ("title", r"(?i)mailu", "mailu", "mailu", "communication", "Suite mail Mailu", 0.95),
    ("title", r"(?i)stalwart", "stalwart", "stalwart", "communication", "Serveur mail Stalwart", 0.95),
    ("title", r"(?i)audiobookshelf", "audiobookshelf", "audiobookshelf", "media", "Audiobooks Audiobookshelf", 0.95),
    ("title", r"(?i)doplarr", "doplarr", "doplarr", "media", "Requêtes Plex/Sonarr Doplarr", 0.95),
    ("title", r"(?i)jellyseerr", "jellyseerr", "jellyseerr", "media", "Requêtes Jellyfin Jellyseerr", 0.95),
    ("title", r"(?i)petio", "petio", "petio", "media", "Requêtes média Petio", 0.95),
    ("title", r"(?i)ombi", "ombi", "ombi", "media", "Requêtes média Ombi", 0.95),
    ("title", r"(?i)plex.?meta.?manager|pmm|kometa", "kometa", "kometa", "media", "Métadonnées Plex Kometa", 0.95),
    ("title", r"(?i)unmanic", "unmanic", "unmanic", "media", "Transcodage Unmanic", 0.95),
    ("title", r"(?i)tdarr", "tdarr", "tdarr", "media", "Transcodage Tdarr", 0.95),
    ("title", r"(?i)fileflows", "fileflows", "fileflows", "media", "Automatisation fichiers FileFlows", 0.95),
    ("title", r"(?i)recyclarr", "recyclarr", "recyclarr", "media", "Sync Radarr/Sonarr Recyclarr", 0.95),
    ("title", r"(?i)maintainerr", "maintainerr", "maintainerr", "media", "Maintenance Plex Maintainerr", 0.95),
    ("title", r"(?i)decluttarr", "decluttarr", "decluttarr", "media", "Nettoyage Radarr Decluttarr", 0.95),
    ("title", r"(?i)notifiarr", "notifiarr", "notifiarr", "media", "Notifications *arr Notifiarr", 0.95),
    ("title", r"(?i)autobrr", "autobrr", "autobrr", "media", "Automatisation torrents Autobrr", 0.95),
    ("title", r"(?i)flaresolverr", "flaresolverr", "flaresolverr", "network", "Bypass Cloudflare FlareSolverr", 0.95),
    ("title", r"(?i)jackett", "jackett", "jackett", "media", "Indexeurs torrents Jackett", 0.95),
    ("title", r"(?i)requestrr", "requestrr", "requestrr", "media", "Bot Discord requêtes Requestrr", 0.95),
    ("title", r"(?i)tubearchivist", "tubearchivist", "tubearchivist", "media", "Archive YouTube TubeArchivist", 0.95),
    ("title", r"(?i)ytdl.?sub", "ytdl-sub", "ytdl-sub", "media", "Téléchargeur YouTube ytdl-sub", 0.95),
    ("title", r"(?i)metube", "metube", "metube", "media", "Interface youtube-dl MeTube", 0.95),
    ("title", r"(?i)pinchflat", "pinchflat", "pinchflat", "media", "Archive YouTube Pinchflat", 0.95),
    ("title", r"(?i)open.?webui|openwebui", "openwebui", "open-webui", "development", "Interface ChatGPT/Ollama Open WebUI", 0.95),
    ("title", r"(?i)ollama", "ollama", "ollama", "development", "Serveur LLM Ollama", 0.95),
    ("title", r"(?i)localai", "localai", "localai", "development", "API OpenAI locale LocalAI", 0.95),
    ("title", r"(?i)text.?generation.?webui|oobabooga", "oobabooga", "oobabooga", "development", "Interface LLM Oobabooga", 0.95),
    ("title", r"(?i)koboldai", "koboldai", "koboldai", "development", "LLM pour écriture KoboldAI", 0.95),
    ("title", r"(?i)flowise", "flowise", "flowise", "development", "LLM low-code Flowise", 0.95),
    ("title", r"(?i)langflow", "langflow", "langflow", "development", "Builder LangChain Langflow", 0.95),
    ("title", r"(?i)anything.?llm|anythingllm", "anythingllm", "anythingllm", "development", "Chat documents AnythingLLM", 0.95),
    ("title", r"(?i)chatgpt.?next.?web", "chatgpt-next-web", "chatgpt-next-web", "development", "Interface ChatGPT NextWeb", 0.95),
    ("title", r"(?i)chatbox", "chatbox", "chatbox", "development", "Client ChatGPT Chatbox", 0.95),
    ("title", r"(?i)jan", "jan", "jan", "development", "LLM local Jan", 0.95),
    ("title", r"(?i)lmstudio", "lmstudio", "lmstudio", "development", "LLM local LM Studio", 0.95),
    ("title", r"(?i)gpt4all", "gpt4all", "gpt4all", "development", "LLM local GPT4All", 0.95),
    ("title", r"(?i)stable.?diffusion", "stable-diffusion", "stable-diffusion", "development", "Génération d'images Stable Diffusion", 0.95),
    ("title", r"(?i)automatic1111|a1111", "automatic1111", "stable-diffusion", "development", "WebUI Stable Diffusion Automatic1111", 0.95),
    ("title", r"(?i)comfyui", "comfyui", "comfyui", "development", "Génération d'images ComfyUI", 0.95),
    ("title", r"(?i)invokeai", "invokeai", "invokeai", "development", "Génération d'images InvokeAI", 0.95),
    ("title", r"(?i)fooocus", "fooocus", "fooocus", "development", "Génération d'images Fooocus", 0.95),
    ("title", r"(?i)whisper", "whisper", "whisper", "development", "Transcription audio Whisper", 0.95),
    ("title", r"(?i)faster.?whisper", "faster-whisper", "whisper", "development", "Transcription Faster Whisper", 0.95),


    # ============================================================
    # AUTO-DISCOVERED APPS (2025-12-30)
    # Added automatically from RSS feeds
    # ============================================================
    ("title", r"(?i)Movary", "movary", "movary", "other", "Discovered from: add Movary (#1765)", 0.85),
    ("title", r"(?i)monetr", "monetr", "monetr", "other", "Discovered from: add monetr (#1763)", 0.85),
    ("title", r"(?i)Wishlist", "wishlist", "wishlist", "other", "Discovered from: add Wishlist (#1762)", 0.85),
    ("title", r"(?i)fittrackee", "fittrackee", "fittrackee", "other", "Discovered from: Add fittrackee (#1761)", 0.85),


    # ============================================================
    # AUTO-DISCOVERED APPS (2026-01-02)
    # Added automatically from RSS feeds
    # ============================================================
    ("title", r"(?i)Tools", "tools", "tools", "other", " A growing list of tools for visualizing self-hosted metrics in a &#39;year-in-review&#39; style ", 0.85),


    # ============================================================
    # AUTO-DISCOVERED APPS (2026-01-03)
    # Added automatically from RSS feeds
    # ============================================================
    ("title", r"(?i)demo", "demo", "demo", "other", "Discovered from: Add demo URL to dailytxt.yml (#1905)", 0.85),
]


def get_extended_fingerprints() -> List[Tuple[str, str, str, str, str, str, float]]:
    """Return all extended fingerprints."""
    return EXTENDED_FINGERPRINTS
