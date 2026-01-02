"""
Application detection service.
Detects application type based on domain name patterns.
"""

from typing import Optional, Tuple

# Signatures for detecting application types
# Format: (keywords in domain, app_type, icon_name, category_slug, default_description)
APP_SIGNATURES = [
    # Media
    (["plex"], "plex", "plex", "media", "Serveur multimédia Plex"),
    (["jellyfin"], "jellyfin", "jellyfin", "media", "Serveur multimédia Jellyfin"),
    (["emby"], "emby", "emby", "media", "Serveur multimédia Emby"),
    (["sonarr"], "sonarr", "sonarr", "media", "Gestionnaire de séries TV"),
    (["radarr"], "radarr", "radarr", "media", "Gestionnaire de films"),
    (["lidarr"], "lidarr", "lidarr", "media", "Gestionnaire de musique"),
    (["bazarr"], "bazarr", "bazarr", "media", "Gestionnaire de sous-titres"),
    (["prowlarr"], "prowlarr", "prowlarr", "media", "Gestionnaire d'indexeurs"),
    (["overseerr"], "overseerr", "overseerr", "media", "Gestionnaire de requêtes média"),
    (["tautulli"], "tautulli", "tautulli", "media", "Statistiques Plex"),
    (["navidrome"], "navidrome", "navidrome", "media", "Serveur de streaming musical"),
    (["airsonic"], "airsonic", "airsonic", "media", "Serveur de streaming musical"),
    (["ampache"], "ampache", "ampache", "media", "Serveur de streaming musical"),
    (["amp"], "amp", "pterodactyl", "admin", "Gestionnaire de serveurs de jeux"),

    # Productivity
    (["nextcloud"], "nextcloud", "nextcloud", "productivity", "Cloud personnel et collaboration"),
    (["onlyoffice"], "onlyoffice", "onlyoffice", "productivity", "Suite bureautique en ligne"),
    (["collabora"], "collabora", "collabora-online", "productivity", "Éditeur de documents en ligne"),
    (["outline"], "outline", "outline", "productivity", "Base de connaissances et wiki"),
    (["wiki"], "wiki", "wikijs", "productivity", "Wiki collaboratif"),
    (["bookstack"], "bookstack", "bookstack", "productivity", "Documentation et wiki"),
    (["notion"], "notion", "notion", "productivity", "Espace de travail collaboratif"),
    (["n8n"], "n8n", "n8n", "productivity", "Automatisation de workflows"),
    (["huginn"], "huginn", "huginn", "productivity", "Automatisation de tâches"),
    (["excalidraw"], "excalidraw", "excalidraw", "productivity", "Tableau blanc collaboratif"),
    (["hoarder"], "hoarder", "hoarder", "productivity", "Gestionnaire de bookmarks IA"),

    # Administration
    (["portainer"], "portainer", "portainer", "admin", "Gestion de containers Docker"),
    (["traefik"], "traefik", "traefik", "admin", "Reverse proxy et load balancer"),
    (["nginx", "npm"], "nginx-proxy-manager", "nginx-proxy-manager", "admin", "Gestion de reverse proxy"),
    (["proxmox"], "proxmox", "proxmox", "admin", "Hyperviseur de virtualisation"),
    (["cockpit"], "cockpit", "cockpit", "admin", "Administration serveur"),
    (["webmin"], "webmin", "webmin", "admin", "Administration système web"),
    (["phpmyadmin"], "phpmyadmin", "phpmyadmin", "admin", "Administration MySQL/MariaDB"),
    (["pgadmin"], "pgadmin", "pgadmin", "admin", "Administration PostgreSQL"),
    (["adminer"], "adminer", "adminer", "admin", "Administration de bases de données"),
    (["homarr"], "homarr", "homarr", "admin", "Dashboard de services"),
    (["heimdall"], "heimdall", "heimdall", "admin", "Dashboard d'applications"),
    (["dashy"], "dashy", "dashy", "admin", "Dashboard personnalisable"),
    (["homer"], "homer", "homer", "admin", "Dashboard de services"),
    (["organizr"], "organizr", "organizr", "admin", "Dashboard unifié"),
    (["remotely"], "remotely", "remotely", "admin", "Support à distance"),
    (["nexterm"], "nexterm", "guacamole", "admin", "Terminal web SSH"),
    (["infra-mapper", "infra"], "infra-mapper", "draw-io", "admin", "Cartographie d'infrastructure"),

    # Monitoring
    (["grafana"], "grafana", "grafana", "monitoring", "Visualisation de métriques"),
    (["prometheus"], "prometheus", "prometheus", "monitoring", "Collecte de métriques"),
    (["zabbix", "zab"], "zabbix", "zabbix", "monitoring", "Supervision d'infrastructure"),
    (["uptime", "kuma"], "uptime-kuma", "uptime-kuma", "monitoring", "Monitoring de disponibilité"),
    (["netdata"], "netdata", "netdata", "monitoring", "Monitoring temps réel"),
    (["glances"], "glances", "glances", "monitoring", "Monitoring système"),
    (["dozzle"], "dozzle", "dozzle", "monitoring", "Visualisation de logs Docker"),
    (["loki"], "loki", "loki", "monitoring", "Agrégation de logs"),
    (["kibana"], "kibana", "kibana", "monitoring", "Visualisation Elasticsearch"),
    (["metabase"], "metabase", "metabase", "monitoring", "Business intelligence"),
    (["openobserve"], "openobserve", "open-observe", "monitoring", "Observabilité et logs"),

    # Network
    (["pihole", "pi-hole"], "pihole", "pi-hole", "network", "Blocage de publicités DNS"),
    (["adguard"], "adguard", "adguard-home", "network", "Blocage de publicités DNS"),
    (["wireguard"], "wireguard", "wireguard", "network", "VPN WireGuard"),
    (["openvpn"], "openvpn", "openvpn", "network", "Serveur VPN OpenVPN"),
    (["headscale-ui"], "headscale-ui", "headscale", "network", "Interface Headscale"),
    (["headscale"], "headscale", "headscale", "network", "Coordination Tailscale auto-hébergé"),
    (["tailscale"], "tailscale", "tailscale", "network", "VPN mesh Tailscale"),
    (["unifi"], "unifi", "unifi", "network", "Contrôleur UniFi"),
    (["omada"], "omada", "omada", "network", "Contrôleur TP-Link Omada"),
    (["speedtest"], "speedtest", "librespeed", "network", "Test de vitesse réseau"),
    (["toolbox", "net-toolbox"], "net-toolbox", "it-tools", "network", "Outils réseau"),
    (["dumbwhois", "whois"], "whois", "it-tools", "network", "Recherche WHOIS"),

    # Storage
    (["minio"], "minio", "minio", "storage", "Stockage objet S3"),
    (["syncthing"], "syncthing", "syncthing", "storage", "Synchronisation de fichiers"),
    (["filebrowser", "filestash"], "filebrowser", "filebrowser", "storage", "Explorateur de fichiers web"),
    (["seafile"], "seafile", "seafile", "storage", "Synchronisation et partage de fichiers"),
    (["duplicati"], "duplicati", "duplicati", "storage", "Sauvegarde cloud"),
    (["restic"], "restic", "restic", "storage", "Sauvegarde de données"),
    (["photoprism"], "photoprism", "photoprism", "storage", "Galerie photos IA"),
    (["immich"], "immich", "immich", "storage", "Galerie photos auto-hébergée"),
    (["iso"], "iso", "homarr", "admin", "Dashboard de services"),

    # Security
    (["authelia"], "authelia", "authelia", "security", "Authentification SSO"),
    (["authentik"], "authentik", "authentik", "security", "Identity provider"),
    (["keycloak"], "keycloak", "keycloak", "security", "Gestion d'identités"),
    (["vaultwarden", "bitwarden"], "vaultwarden", "vaultwarden", "security", "Gestionnaire de mots de passe"),
    (["vault"], "vault", "vault", "security", "Gestion de secrets"),
    (["crowdsec"], "crowdsec", "crowdsec", "security", "Protection collaborative"),
    (["fail2ban"], "fail2ban", "fail2ban", "security", "Protection contre les intrusions"),
    (["detection"], "detection", "wazuh", "security", "Détection d'intrusions"),

    # Development
    (["gitea"], "gitea", "gitea", "development", "Forge Git légère"),
    (["gitlab"], "gitlab", "gitlab", "development", "Plateforme DevOps"),
    (["github"], "github", "github", "development", "Hébergement de code"),
    (["drone"], "drone", "drone", "development", "CI/CD"),
    (["jenkins"], "jenkins", "jenkins", "development", "Serveur d'intégration continue"),
    (["sonarqube"], "sonarqube", "sonarqube", "development", "Analyse de qualité de code"),
    (["code-server", "vscode"], "code-server", "code", "development", "VS Code dans le navigateur"),
    (["jupyter"], "jupyter", "jupyter", "development", "Notebooks interactifs"),

    # Home Automation
    (["home", "homeassistant", "hass"], "home-assistant", "home-assistant", "home", "Domotique centralisée"),
    (["nodered", "node-red"], "node-red", "node-red", "home", "Automatisation par flux"),
    (["mosquitto", "mqtt"], "mosquitto", "eclipse-mosquitto", "home", "Broker MQTT"),
    (["zigbee2mqtt"], "zigbee2mqtt", "zigbee2mqtt", "home", "Passerelle Zigbee"),
    (["esphome"], "esphome", "esphome", "home", "Firmware IoT"),

    # Communication
    (["matrix", "element"], "matrix", "element", "communication", "Messagerie décentralisée"),
    (["rocketchat"], "rocketchat", "rocket-chat", "communication", "Plateforme de communication"),
    (["mattermost"], "mattermost", "mattermost", "communication", "Messagerie d'équipe"),
    (["discord"], "discord", "discord", "communication", "Serveur Discord"),
    (["mumble"], "mumble", "mumble", "communication", "Chat vocal"),
    (["jitsi", "meet"], "jitsi", "jitsi-meet", "communication", "Visioconférence"),
    (["ntfy"], "ntfy", "ntfy", "communication", "Notifications push"),
    (["webmail", "roundcube", "snappymail"], "webmail", "roundcube", "communication", "Client mail web"),

    # AI & Tools
    (["openwebui", "open-webui"], "openwebui", "open-webui", "development", "Interface ChatGPT/Ollama"),
    (["ollama"], "ollama", "ollama", "development", "Serveur LLM local"),

    # Documents & Files
    (["pdf", "stirling"], "stirling-pdf", "stirling-pdf", "productivity", "Outils PDF"),
    (["paperless"], "paperless", "paperless-ngx", "productivity", "Gestion documentaire"),
    (["fpaper"], "fpaper", "paperless-ngx", "productivity", "Gestion documentaire"),

    # Other common apps
    (["transmission"], "transmission", "transmission", "media", "Client BitTorrent"),
    (["qbittorrent"], "qbittorrent", "qbittorrent", "media", "Client BitTorrent"),
    (["deluge"], "deluge", "deluge", "media", "Client BitTorrent"),
    (["calibre"], "calibre", "calibre-web", "media", "Bibliothèque d'ebooks"),
    (["komga"], "komga", "komga", "media", "Serveur de comics/manga"),
    (["kavita"], "kavita", "kavita", "media", "Serveur de lecture"),
    (["freshrss"], "freshrss", "freshrss", "productivity", "Agrégateur RSS"),
    (["miniflux"], "miniflux", "miniflux", "productivity", "Lecteur RSS minimaliste"),
    (["wallabag"], "wallabag", "wallabag", "productivity", "Read-it-later"),
    (["linkding"], "linkding", "linkding", "productivity", "Gestionnaire de bookmarks"),
    (["mealie"], "mealie", "mealie", "productivity", "Gestionnaire de recettes"),
    (["ocis", "owncloud"], "owncloud-infinite-scale", "owncloud", "productivity", "Cloud nouvelle génération"),
    (["fossflow"], "fossflow", "git", "development", "Workflow open source"),
]

# Apps to hide by default (backend services, not user-facing)
HIDDEN_APPS = [
    "headscale.masenam.com",  # Backend for headscale-ui, not user-facing
]


def detect_application(domain: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Detect application type from domain name.

    Args:
        domain: The domain name (e.g., "nextcloud.example.com")

    Returns:
        Tuple of (app_type, icon, category_slug, description) or (None, None, None, None) if not detected
    """
    domain_lower = domain.lower()

    # Extract subdomain (first part before the first dot)
    subdomain = domain_lower.split(".")[0] if "." in domain_lower else domain_lower

    for keywords, app_type, icon, category, description in APP_SIGNATURES:
        for keyword in keywords:
            if keyword in subdomain:
                return app_type, icon, category, description

    return None, None, None, None


def should_hide_app(domain: str) -> bool:
    """Check if an app should be hidden by default."""
    return domain.lower() in [h.lower() for h in HIDDEN_APPS]


def get_icon_url(icon_name: str) -> str:
    """
    Get the Dashboard Icons URL for an icon.

    Args:
        icon_name: The icon name from APP_SIGNATURES

    Returns:
        URL to the icon SVG
    """
    return f"https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/{icon_name}.svg"


def format_app_name(domain: str, detected_type: Optional[str] = None) -> str:
    """
    Format a nice display name from domain and detected type.

    Args:
        domain: The domain name
        detected_type: The detected app type (optional)

    Returns:
        Formatted display name
    """
    if detected_type:
        # Capitalize and format the detected type
        return detected_type.replace("-", " ").replace("_", " ").title()

    # Extract subdomain and format it
    subdomain = domain.split(".")[0] if "." in domain else domain
    return subdomain.replace("-", " ").replace("_", " ").title()
