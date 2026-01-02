"""
Widget model for dashboard customization.
Supports various widget types: clock, calendar, weather, VM status, etc.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func

from app.core.database import Base


class Widget(Base):
    __tablename__ = "widgets"

    id = Column(Integer, primary_key=True, index=True)

    # Widget type: clock, calendar, weather, proxmox_vm, proxmox_node, custom_iframe, etc.
    widget_type = Column(String(50), nullable=False)

    # Display settings
    title = Column(String(200), nullable=True)  # Optional custom title
    position = Column(Integer, default=0)  # Order on dashboard
    column = Column(Integer, default=0)  # Grid column (0=left, 1=center, 2=right)
    size = Column(String(20), default="medium")  # small, medium, large

    # Grid span for more flexible sizing (1-4 columns, 1-4 rows)
    col_span = Column(Integer, default=1)  # How many grid columns to span
    row_span = Column(Integer, default=1)  # How many grid rows to span

    # Widget-specific configuration (JSON)
    # Examples:
    # - clock: {"timezone": "Europe/Paris", "format_24h": true}
    # - weather: {"city": "Paris", "api_key": "xxx", "units": "metric"}
    # - proxmox_vm: {"host": "192.168.1.x", "node": "pve", "vmid": 100, "api_token": "xxx"}
    # - proxmox_node: {"host": "192.168.1.x", "node": "pve", "api_token": "xxx"}
    # - calendar: {"ical_url": "https://...", "days_ahead": 7}
    config = Column(JSON, default=dict)

    # Status
    is_visible = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # Show on public dashboard

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Available widget types and their configuration schema
WIDGET_TYPES = {
    "clock": {
        "name": "Horloge",
        "description": "Affiche l'heure et la date",
        "icon": "IconClock",
        "config_schema": {
            "timezone": {"type": "string", "default": "Europe/Paris", "label": "Fuseau horaire"},
            "format_24h": {"type": "boolean", "default": True, "label": "Format 24h"},
            "show_date": {"type": "boolean", "default": True, "label": "Afficher la date"},
            "show_seconds": {"type": "boolean", "default": False, "label": "Afficher les secondes"},
        }
    },
    "calendar": {
        "name": "Calendrier",
        "description": "Affiche un calendrier avec événements iCal (Nextcloud, Google, Apple)",
        "icon": "IconCalendar",
        "config_schema": {
            "ical_urls": {"type": "textarea", "default": "", "label": "URLs iCal (une par ligne)"},
            "show_week_numbers": {"type": "boolean", "default": False, "label": "Numéros de semaine"},
            "first_day_monday": {"type": "boolean", "default": True, "label": "Semaine commence lundi"},
            "show_events_list": {"type": "boolean", "default": True, "label": "Liste des événements"},
            "days_ahead": {"type": "number", "default": 7, "label": "Jours à afficher"},
        }
    },
    "weather": {
        "name": "Météo",
        "description": "Affiche la météo actuelle et prévisions",
        "icon": "IconCloud",
        "config_schema": {
            "city": {"type": "string", "default": "Paris", "label": "Ville"},
            "api_key": {"type": "password", "default": "", "label": "Clé API OpenWeatherMap"},
            "units": {"type": "select", "options": ["metric", "imperial"], "default": "metric", "label": "Unités"},
            "show_forecast": {"type": "boolean", "default": True, "label": "Afficher prévisions"},
        }
    },
    "proxmox_node": {
        "name": "Proxmox - Noeud",
        "description": "État d'un noeud Proxmox (CPU, RAM, stockage)",
        "icon": "IconServer",
        "config_schema": {
            "host": {"type": "string", "default": "", "label": "Hôte Proxmox"},
            "port": {"type": "number", "default": 8006, "label": "Port"},
            "node": {"type": "string", "default": "pve", "label": "Nom du noeud"},
            "api_token_id": {"type": "string", "default": "", "label": "Token ID (user@realm!tokenid)"},
            "api_token_secret": {"type": "password", "default": "", "label": "Token Secret"},
            "verify_ssl": {"type": "boolean", "default": False, "label": "Vérifier SSL"},
        }
    },
    "proxmox_vm": {
        "name": "Proxmox - VM/LXC",
        "description": "État d'une VM ou conteneur LXC",
        "icon": "IconBox",
        "config_schema": {
            "host": {"type": "string", "default": "", "label": "Hôte Proxmox"},
            "port": {"type": "number", "default": 8006, "label": "Port"},
            "node": {"type": "string", "default": "pve", "label": "Nom du noeud"},
            "vmid": {"type": "number", "default": 100, "label": "VM ID"},
            "vm_type": {"type": "select", "options": ["qemu", "lxc"], "default": "qemu", "label": "Type"},
            "api_token_id": {"type": "string", "default": "", "label": "Token ID"},
            "api_token_secret": {"type": "password", "default": "", "label": "Token Secret"},
            "verify_ssl": {"type": "boolean", "default": False, "label": "Vérifier SSL"},
        }
    },
    "proxmox_summary": {
        "name": "Proxmox - Résumé",
        "description": "Résumé de toutes les VMs/LXCs d'un noeud",
        "icon": "IconLayoutGrid",
        "config_schema": {
            "host": {"type": "string", "default": "", "label": "Hôte Proxmox"},
            "port": {"type": "number", "default": 8006, "label": "Port"},
            "node": {"type": "string", "default": "pve", "label": "Nom du noeud"},
            "api_token_id": {"type": "string", "default": "", "label": "Token ID"},
            "api_token_secret": {"type": "password", "default": "", "label": "Token Secret"},
            "verify_ssl": {"type": "boolean", "default": False, "label": "Vérifier SSL"},
            "show_lxc": {"type": "boolean", "default": True, "label": "Afficher LXC"},
            "show_qemu": {"type": "boolean", "default": True, "label": "Afficher VMs"},
        }
    },
    "system_stats": {
        "name": "Statistiques système",
        "description": "CPU, RAM, disque d'un serveur via SSH ou agent",
        "icon": "IconChartBar",
        "config_schema": {
            "host": {"type": "string", "default": "", "label": "Hôte SSH"},
            "port": {"type": "number", "default": 22, "label": "Port SSH"},
            "username": {"type": "string", "default": "", "label": "Utilisateur"},
            "ssh_key": {"type": "textarea", "default": "", "label": "Clé SSH privée"},
            "show_cpu": {"type": "boolean", "default": True, "label": "Afficher CPU"},
            "show_ram": {"type": "boolean", "default": True, "label": "Afficher RAM"},
            "show_disk": {"type": "boolean", "default": True, "label": "Afficher disque"},
        }
    },
    "iframe": {
        "name": "iFrame personnalisé",
        "description": "Intègre n'importe quelle page web",
        "icon": "IconBrowser",
        "config_schema": {
            "url": {"type": "string", "default": "", "label": "URL"},
            "height": {"type": "number", "default": 300, "label": "Hauteur (px)"},
            "refresh_interval": {"type": "number", "default": 0, "label": "Rafraîchir (secondes, 0=jamais)"},
        }
    },
    "vm_status": {
        "name": "VM / Serveur",
        "description": "État d'une VM ou serveur avec ressources et containers Docker",
        "icon": "IconServer2",
        "config_schema": {
            "name": {"type": "string", "default": "", "label": "Nom de la VM"},
            "host": {"type": "string", "default": "", "label": "Adresse IP ou hostname"},
            "check_ports": {"type": "string", "default": "", "label": "Ports à vérifier (ex: 22,80,443)"},
            "icon_url": {"type": "string", "default": "", "label": "URL icône (optionnel)"},
            "description": {"type": "string", "default": "", "label": "Description"},
            "ssh_enabled": {"type": "boolean", "default": False, "label": "Activer SSH pour métriques"},
            "ssh_port": {"type": "number", "default": 22, "label": "Port SSH"},
            "ssh_user": {"type": "string", "default": "root", "label": "Utilisateur SSH"},
            "ssh_key": {"type": "textarea", "default": "", "label": "Clé SSH privée (format PEM)"},
            "ssh_password": {"type": "password", "default": "", "label": "Mot de passe SSH (si pas de clé)"},
            "show_docker": {"type": "boolean", "default": True, "label": "Afficher containers Docker"},
        }
    },
    "vikunja": {
        "name": "Vikunja",
        "description": "Tâches et projets depuis Vikunja",
        "icon": "IconChecklist",
        "config_schema": {
            "api_url": {"type": "string", "default": "", "label": "URL API Vikunja"},
            "api_token": {"type": "password", "default": "", "label": "Token API"},
            "project_id": {"type": "number", "default": 0, "label": "ID du projet (0 = tous)"},
            "show_completed": {"type": "boolean", "default": False, "label": "Afficher terminées"},
            "max_tasks": {"type": "number", "default": 10, "label": "Nombre max de tâches"},
            "filter": {"type": "select", "options": ["all", "today", "week", "overdue"], "default": "all", "label": "Filtre"},
            "assignee_id": {"type": "number", "default": 0, "label": "Assigné à (ID utilisateur, 0 = tous)"},
        }
    },
    "crowdsec": {
        "name": "CrowdSec",
        "description": "Sécurité - Décisions et alertes CrowdSec",
        "icon": "IconShield",
        "config_schema": {
            "api_url": {"type": "string", "default": "http://localhost:8080", "label": "URL API CrowdSec (LAPI)"},
            "api_key": {"type": "password", "default": "", "label": "Clé API (Bouncer)"},
            "max_decisions": {"type": "number", "default": 10, "label": "Nombre max de décisions"},
            "max_alerts": {"type": "number", "default": 10, "label": "Nombre max d'alertes"},
            "show_metrics": {"type": "boolean", "default": True, "label": "Afficher les métriques"},
            "show_decisions": {"type": "boolean", "default": True, "label": "Afficher les décisions"},
            "show_alerts": {"type": "boolean", "default": True, "label": "Afficher les alertes"},
            "show_countries": {"type": "boolean", "default": True, "label": "Afficher les pays"},
            "refresh_interval": {"type": "number", "default": 60, "label": "Rafraîchissement (secondes)"},
        }
    },
    "uptime_ping": {
        "name": "Uptime / Ping",
        "description": "Monitoring de disponibilité avec graphiques SmokePing (latence, jitter, perte de paquets)",
        "icon": "IconActivityHeartbeat",
        "config_schema": {
            "targets": {"type": "textarea", "default": "", "label": "Cibles (une par ligne: IP ou hostname)"},
            "target_names": {"type": "textarea", "default": "", "label": "Noms des cibles (une par ligne, optionnel)"},
            "ping_count": {"type": "number", "default": 5, "label": "Nombre de pings par mesure"},
            "ping_interval": {"type": "number", "default": 60, "label": "Intervalle entre mesures (secondes)"},
            "ping_timeout": {"type": "number", "default": 5, "label": "Timeout par ping (secondes)"},
            "history_hours": {"type": "number", "default": 24, "label": "Historique à afficher (heures)"},
            "graph_height": {"type": "number", "default": 150, "label": "Hauteur du graphique (pixels)"},
            "show_jitter": {"type": "boolean", "default": True, "label": "Afficher le jitter (bandes colorées)"},
            "show_packet_loss": {"type": "boolean", "default": True, "label": "Afficher la perte de paquets"},
            "show_statistics": {"type": "boolean", "default": True, "label": "Afficher les statistiques"},
            "latency_warning": {"type": "number", "default": 100, "label": "Seuil d'alerte latence (ms)"},
            "latency_critical": {"type": "number", "default": 500, "label": "Seuil critique latence (ms)"},
            "loss_warning": {"type": "number", "default": 5, "label": "Seuil d'alerte perte (%)"},
            "loss_critical": {"type": "number", "default": 20, "label": "Seuil critique perte (%)"},
        }
    },
    "docker": {
        "name": "Docker Containers",
        "description": "Gestion de containers Docker spécifiques (état, start/stop/restart)",
        "icon": "IconBrandDocker",
        "config_schema": {
            "host": {"type": "string", "default": "", "label": "Hôte Docker (IP ou hostname)"},
            "ssh_port": {"type": "number", "default": 22, "label": "Port SSH"},
            "ssh_user": {"type": "string", "default": "root", "label": "Utilisateur SSH"},
            "ssh_key": {"type": "textarea", "default": "", "label": "Clé SSH privée (format PEM)"},
            "ssh_password": {"type": "password", "default": "", "label": "Mot de passe SSH (si pas de clé)"},
            "containers": {"type": "textarea", "default": "", "label": "Containers à surveiller (un nom par ligne, vide = tous)"},
            "show_stats": {"type": "boolean", "default": True, "label": "Afficher CPU/Mémoire"},
            "show_actions": {"type": "boolean", "default": True, "label": "Afficher boutons d'action"},
            "refresh_interval": {"type": "number", "default": 30, "label": "Rafraîchissement (secondes)"},
        }
    },
    "logs": {
        "name": "Logs Docker",
        "description": "Affichage des logs d'un container Docker en temps réel",
        "icon": "IconFileText",
        "config_schema": {
            "host": {"type": "string", "default": "", "label": "Hôte Docker (IP ou hostname)"},
            "ssh_port": {"type": "number", "default": 22, "label": "Port SSH"},
            "ssh_user": {"type": "string", "default": "root", "label": "Utilisateur SSH"},
            "ssh_key": {"type": "textarea", "default": "", "label": "Clé SSH privée (format PEM)"},
            "ssh_password": {"type": "password", "default": "", "label": "Mot de passe SSH (si pas de clé)"},
            "container_name": {"type": "string", "default": "", "label": "Nom du container"},
            "max_lines": {"type": "number", "default": 100, "label": "Nombre de lignes à afficher"},
            "auto_scroll": {"type": "boolean", "default": True, "label": "Défilement automatique"},
            "show_timestamps": {"type": "boolean", "default": True, "label": "Afficher les timestamps"},
            "filter_pattern": {"type": "string", "default": "", "label": "Filtrer (regex, optionnel)"},
            "refresh_interval": {"type": "number", "default": 5, "label": "Rafraîchissement (secondes)"},
        }
    },
    "rss_feed": {
        "name": "Flux RSS / Actualités",
        "description": "Agrégateur de flux RSS avec gestion des articles lus/non-lus",
        "icon": "IconRss",
        "config_schema": {
            "feed_urls": {"type": "textarea", "default": "", "label": "URLs des flux RSS (une par ligne)"},
            "max_display": {"type": "number", "default": 10, "label": "Nombre d'articles à afficher"},
            "max_articles_per_feed": {"type": "number", "default": 20, "label": "Max articles par flux"},
            "show_images": {"type": "boolean", "default": True, "label": "Afficher les images"},
            "show_summary": {"type": "boolean", "default": True, "label": "Afficher le résumé"},
            "show_author": {"type": "boolean", "default": False, "label": "Afficher l'auteur"},
            "show_date": {"type": "boolean", "default": True, "label": "Afficher la date"},
            "show_source": {"type": "boolean", "default": True, "label": "Afficher la source"},
            "open_in_new_tab": {"type": "boolean", "default": True, "label": "Ouvrir dans nouvel onglet"},
            "refresh_interval": {"type": "number", "default": 300, "label": "Rafraîchissement (secondes)"},
            "compact_mode": {"type": "boolean", "default": False, "label": "Mode compact (sans images)"},
        }
    },
    "notes": {
        "name": "Notes / Mémo",
        "description": "Notes rapides persistantes (locales ou synchronisées avec Nextcloud)",
        "icon": "IconNote",
        "config_schema": {
            "source": {"type": "select", "options": ["local", "nextcloud"], "default": "local", "label": "Source des notes"},
            "nextcloud_url": {"type": "string", "default": "", "label": "URL Nextcloud (si source = nextcloud)"},
            "nextcloud_username": {"type": "string", "default": "", "label": "Nom d'utilisateur Nextcloud"},
            "nextcloud_password": {"type": "password", "default": "", "label": "Mot de passe Nextcloud"},
            "nextcloud_category": {"type": "string", "default": "", "label": "Catégorie Nextcloud (optionnel)"},
            "default_color": {"type": "string", "default": "#fef3c7", "label": "Couleur par défaut des notes"},
            "show_pinned_first": {"type": "boolean", "default": True, "label": "Afficher les notes épinglées en premier"},
            "show_archived": {"type": "boolean", "default": False, "label": "Afficher les notes archivées"},
            "compact_mode": {"type": "boolean", "default": False, "label": "Mode compact"},
            "max_notes_display": {"type": "number", "default": 10, "label": "Nombre max de notes affichées"},
        }
    },
    "grafana": {
        "name": "Grafana Panel",
        "description": "Intégrer un panel Grafana (graphiques, métriques, alertes)",
        "icon": "IconChartLine",
        "config_schema": {
            "grafana_url": {"type": "string", "default": "", "label": "URL Grafana (ex: https://grafana.example.com)"},
            "panel_id": {"type": "string", "default": "", "label": "ID du panel (ex: 2)"},
            "dashboard_uid": {"type": "string", "default": "", "label": "UID du dashboard"},
            "org_id": {"type": "number", "default": 1, "label": "ID de l'organisation"},
            "theme": {"type": "select", "options": ["light", "dark"], "default": "dark", "label": "Thème"},
            "from": {"type": "string", "default": "now-6h", "label": "Début (ex: now-6h, now-1d)"},
            "to": {"type": "string", "default": "now", "label": "Fin (ex: now)"},
            "refresh": {"type": "string", "default": "30s", "label": "Rafraîchissement (ex: 5s, 1m, 5m)"},
            "timezone": {"type": "string", "default": "browser", "label": "Fuseau horaire"},
            "variables": {"type": "textarea", "default": "", "label": "Variables (var-name=value, une par ligne)"},
            "auth_method": {"type": "select", "options": ["none", "anonymous", "api_key", "service_account"], "default": "anonymous", "label": "Méthode d'authentification"},
            "api_key": {"type": "password", "default": "", "label": "Clé API Grafana (si auth_method = api_key)"},
            "show_legend": {"type": "boolean", "default": True, "label": "Afficher la légende"},
            "transparent": {"type": "boolean", "default": False, "label": "Fond transparent"},
        }
    },
}
