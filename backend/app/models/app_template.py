"""
App Template model for reusable application dashboard templates.
Templates define blocks, commands, and layouts for specific applications
like CrowdSec, Pi-hole, Portainer, etc.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func

from app.core.database import Base


class AppTemplate(Base):
    __tablename__ = "app_templates"

    id = Column(Integer, primary_key=True, index=True)

    # Template identification
    name = Column(String(100), nullable=False)  # e.g., "CrowdSec", "Pi-hole"
    slug = Column(String(100), unique=True, nullable=False, index=True)  # e.g., "crowdsec"
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)  # Icon name or URL

    # Version and authorship
    version = Column(String(20), default="1.0.0")
    author = Column(String(100), nullable=True)

    # Template content
    # Schema for configuration variables (container name, paths, etc.)
    config_schema = Column(JSON, nullable=True, default=dict)
    # Default blocks with their configurations
    blocks = Column(JSON, nullable=False, default=list)

    # Community features
    is_builtin = Column(Boolean, default=False)  # Built-in system template
    is_community = Column(Boolean, default=False)  # Community-contributed
    is_public = Column(Boolean, default=True)  # Visible to all users
    downloads = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Default CrowdSec template
CROWDSEC_TEMPLATE = {
    "name": "CrowdSec",
    "slug": "crowdsec",
    "description": "Dashboard pour CrowdSec Security Engine - Visualisez les bans, alertes, allowlists et gérez les décisions",
    "icon": "IconShield",
    "version": "2.2.0",
    "author": "System",
    "is_builtin": True,
    "config_schema": {
        "container_name": {
            "type": "string",
            "label": "Nom du conteneur",
            "required": True,
            "default": "crowdsec",
            "description": "Nom du conteneur Docker CrowdSec"
        }
    },
    "blocks": [
        # Row 1: Counters
        {
            "id": "counter-bans",
            "type": "counter",
            "title": "IPs Bannies",
            "position": {"x": 0, "y": 0, "w": 2, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} cscli decisions list -o json 2>/dev/null | jq 'length' || echo 0",
                "parser": "number",
                "icon": "IconBan",
                "color": "red",
                "refresh_interval": 30
            }
        },
        {
            "id": "counter-alerts",
            "type": "counter",
            "title": "Alertes (24h)",
            "position": {"x": 2, "y": 0, "w": 2, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} cscli alerts list -o json 2>/dev/null | jq 'length' || echo 0",
                "parser": "number",
                "icon": "IconAlertTriangle",
                "color": "orange",
                "refresh_interval": 30
            }
        },
        {
            "id": "counter-allowlists",
            "type": "counter",
            "title": "Allowlists",
            "position": {"x": 4, "y": 0, "w": 2, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} cscli allowlists list -o json 2>/dev/null | jq 'length' || echo 0",
                "parser": "number",
                "icon": "IconShieldCheck",
                "color": "green",
                "refresh_interval": 60
            }
        },
        {
            "id": "counter-bouncers",
            "type": "counter",
            "title": "Bouncers",
            "position": {"x": 6, "y": 0, "w": 2, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} cscli bouncers list -o json 2>/dev/null | jq 'length' || echo 0",
                "parser": "number",
                "icon": "IconShieldOff",
                "color": "blue",
                "refresh_interval": 60
            }
        },
        {
            "id": "counter-machines",
            "type": "counter",
            "title": "Machines",
            "position": {"x": 8, "y": 0, "w": 2, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} cscli machines list -o json 2>/dev/null | jq 'length' || echo 0",
                "parser": "number",
                "icon": "IconServer",
                "color": "violet",
                "refresh_interval": 60
            }
        },
        {
            "id": "counter-collections",
            "type": "counter",
            "title": "Collections",
            "position": {"x": 10, "y": 0, "w": 2, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} cscli collections list -o json 2>/dev/null | jq '[.[] | select(.status == \"enabled\")] | length' || echo 0",
                "parser": "number",
                "icon": "IconPackage",
                "color": "cyan",
                "refresh_interval": 120
            }
        },
        # Row 2: Decisions table + Actions
        {
            "id": "table-decisions",
            "type": "table",
            "title": "Décisions Actives (Bans)",
            "position": {"x": 0, "y": 2, "w": 8, "h": 5},
            "config": {
                "command": "docker exec {{container_name}} cscli decisions list -o json 2>/dev/null || echo '[]'",
                "parser": "json",
                "refresh_interval": 30,
                "columns": [
                    {"key": "source.ip", "label": "IP/Range", "width": "150px"},
                    {"key": "scenario", "label": "Scénario", "width": "200px"},
                    {"key": "decisions.0.origin", "label": "Origine", "width": "80px"},
                    {"key": "source.scope", "label": "Scope", "width": "60px"},
                    {"key": "decisions.0.duration", "label": "Durée restante", "width": "120px"}
                ],
                "row_actions": [
                    {
                        "id": "unban",
                        "label": "Débannir",
                        "icon": "IconLockOpen",
                        "color": "green",
                        "command": "docker exec {{container_name}} cscli decisions delete --ip {{row.source.ip}}",
                        "confirm": True,
                        "confirm_message": "Êtes-vous sûr de vouloir débannir {{row.source.ip}} ?"
                    }
                ]
            }
        },
        {
            "id": "actions-main",
            "type": "actions",
            "title": "Actions",
            "position": {"x": 8, "y": 2, "w": 4, "h": 5},
            "config": {
                "buttons": [
                    {
                        "id": "ban-ip",
                        "label": "Bannir une IP",
                        "icon": "IconBan",
                        "color": "red",
                        "command": "docker exec {{container_name}} cscli decisions add --ip {{input.ip}} --duration {{input.duration}} --reason '{{input.reason}}'",
                        "inputs": [
                            {"id": "ip", "label": "Adresse IP ou CIDR", "type": "text", "required": True, "placeholder": "192.168.1.100 ou 10.0.0.0/24"},
                            {"id": "duration", "label": "Durée", "type": "select", "options": ["1h", "4h", "24h", "7d", "30d", "365d"], "default": "24h"},
                            {"id": "reason", "label": "Raison", "type": "text", "default": "Manual ban"}
                        ],
                        "confirm": True
                    },
                    {
                        "id": "create-allowlist",
                        "label": "Créer une Allowlist",
                        "icon": "IconShieldPlus",
                        "color": "green",
                        "command": "docker exec {{container_name}} cscli allowlists create '{{input.name}}' --description '{{input.description}}'",
                        "inputs": [
                            {"id": "name", "label": "Nom de l'allowlist", "type": "text", "required": True, "placeholder": "trusted-ips"},
                            {"id": "description", "label": "Description", "type": "text", "default": "Liste d'IPs de confiance"}
                        ],
                        "confirm": True
                    },
                    {
                        "id": "update-hub",
                        "label": "Mettre à jour le hub",
                        "icon": "IconRefresh",
                        "color": "blue",
                        "command": "docker exec {{container_name}} cscli hub update",
                        "confirm": True,
                        "confirm_message": "Voulez-vous mettre à jour le hub CrowdSec ?"
                    },
                    {
                        "id": "upgrade-collections",
                        "label": "Upgrade collections",
                        "icon": "IconArrowUp",
                        "color": "cyan",
                        "command": "docker exec {{container_name}} cscli hub upgrade",
                        "confirm": True
                    }
                ]
            }
        },
        # Row 3: Allowlists table
        {
            "id": "table-allowlists",
            "type": "table",
            "title": "Allowlists (Groupes)",
            "position": {"x": 0, "y": 7, "w": 6, "h": 5},
            "config": {
                "command": "docker exec {{container_name}} cscli allowlists list -o json 2>/dev/null | jq '[.[] | {name: .name, description: .description, items_count: (.items | length), created_at: .created_at}]' || echo '[]'",
                "parser": "json",
                "refresh_interval": 60,
                "columns": [
                    {"key": "name", "label": "Nom", "width": "150px"},
                    {"key": "description", "label": "Description"},
                    {"key": "items_count", "label": "IPs", "width": "60px"},
                    {"key": "created_at", "label": "Créée le", "format": "datetime", "width": "140px"}
                ],
                "header_action": {
                    "id": "create-allowlist",
                    "label": "Créer un groupe",
                    "icon": "IconPlus",
                    "color": "green",
                    "command": "docker exec {{container_name}} cscli allowlists create '{{input.name}}' -d '{{input.description}}'",
                    "inputs": [
                        {"id": "name", "label": "Nom du groupe", "type": "text", "required": True, "placeholder": "trusted-ips"},
                        {"id": "description", "label": "Description", "type": "text", "default": "Liste d'IPs de confiance"}
                    ],
                    "confirm": True
                },
                "row_actions": [
                    {
                        "id": "add-to-allowlist",
                        "label": "Ajouter une IP",
                        "icon": "IconPlus",
                        "color": "green",
                        "command": "docker exec {{container_name}} cscli allowlists add '{{row.name}}' '{{input.ip}}' -d '{{input.comment}}'",
                        "inputs": [
                            {"id": "ip", "label": "IP ou CIDR", "type": "text", "required": True, "placeholder": "192.168.1.100 ou 10.0.0.0/24"},
                            {"id": "comment", "label": "Commentaire", "type": "text", "default": "Ajout manuel"}
                        ],
                        "confirm": True
                    },
                    {
                        "id": "delete-allowlist",
                        "label": "Supprimer le groupe",
                        "icon": "IconTrash",
                        "color": "red",
                        "command": "docker exec {{container_name}} cscli allowlists delete '{{row.name}}'",
                        "confirm": True,
                        "confirm_message": "Êtes-vous sûr de vouloir supprimer l'allowlist '{{row.name}}' et toutes ses IPs ?"
                    }
                ]
            }
        },
        # Row 3b: Allowlist items (IPs whitelistées)
        {
            "id": "table-allowlist-items",
            "type": "table",
            "title": "IPs Whitelistées",
            "position": {"x": 6, "y": 7, "w": 6, "h": 5},
            "config": {
                "command": "docker exec {{container_name}} cscli allowlists list -o json 2>/dev/null | jq '[.[] | .name as $list | (.items // [])[] | {allowlist: $list, value: .value, description: .description, created_at: .created_at}]' || echo '[]'",
                "parser": "json",
                "refresh_interval": 60,
                "columns": [
                    {"key": "allowlist", "label": "Groupe", "width": "120px"},
                    {"key": "value", "label": "IP/CIDR", "width": "150px"},
                    {"key": "description", "label": "Description"},
                    {"key": "created_at", "label": "Ajoutée le", "format": "datetime", "width": "140px"}
                ],
                "row_actions": [
                    {
                        "id": "remove-from-allowlist",
                        "label": "Retirer de la liste",
                        "icon": "IconTrash",
                        "color": "red",
                        "command": "docker exec {{container_name}} cscli allowlists remove '{{row.allowlist}}' '{{row.value}}'",
                        "confirm": True,
                        "confirm_message": "Retirer {{row.value}} de l'allowlist '{{row.allowlist}}' ?"
                    }
                ]
            }
        },
        # Row 4: Alerts table
        {
            "id": "table-alerts",
            "type": "table",
            "title": "Alertes Récentes",
            "position": {"x": 0, "y": 12, "w": 12, "h": 5},
            "config": {
                "command": "docker exec {{container_name}} cscli alerts list -o json -l 20 2>/dev/null || echo '[]'",
                "parser": "json",
                "refresh_interval": 30,
                "columns": [
                    {"key": "id", "label": "ID", "width": "60px"},
                    {"key": "source.ip", "label": "Source IP", "width": "130px"},
                    {"key": "scenario", "label": "Scénario"},
                    {"key": "events_count", "label": "Événements", "width": "100px"},
                    {"key": "created_at", "label": "Date", "format": "datetime", "width": "150px"}
                ],
                "row_actions": [
                    {
                        "id": "ban-alert-ip",
                        "label": "Bannir cette IP",
                        "icon": "IconBan",
                        "color": "red",
                        "command": "docker exec {{container_name}} cscli decisions add --ip {{row.source.ip}} --duration 24h --reason 'Manual ban from alert #{{row.id}}'",
                        "confirm": True,
                        "confirm_message": "Bannir {{row.source.ip}} pour 24h ?"
                    },
                    {
                        "id": "whitelist-alert-ip",
                        "label": "Whitelist cette IP",
                        "icon": "IconShieldCheck",
                        "color": "green",
                        "command": "docker exec {{container_name}} cscli allowlists add 'trusted' '{{row.source.ip}}' -d 'Whitelisted from alert #{{row.id}}'",
                        "confirm": True,
                        "confirm_message": "Ajouter {{row.source.ip}} à la whitelist 'trusted' ?"
                    },
                    {
                        "id": "delete-alert",
                        "label": "Supprimer l'alerte",
                        "icon": "IconTrash",
                        "color": "orange",
                        "command": "docker exec {{container_name}} cscli alerts delete --id {{row.id}}",
                        "confirm": True
                    }
                ]
            }
        },
        # Row 5: Logs
        {
            "id": "logs-crowdsec",
            "type": "logs",
            "title": "Logs CrowdSec",
            "position": {"x": 0, "y": 17, "w": 12, "h": 4},
            "config": {
                "command": "docker logs --tail 50 {{container_name}} 2>&1",
                "refresh_interval": 10,
                "max_lines": 100,
                "highlight_patterns": [
                    {"pattern": "error|Error|ERROR", "color": "red"},
                    {"pattern": "warning|Warning|WARN", "color": "orange"},
                    {"pattern": "info|INFO", "color": "blue"},
                    {"pattern": "ban|Ban|BAN", "color": "red", "bold": True},
                    {"pattern": "allow|Allow|whitelist|Whitelist", "color": "green", "bold": True}
                ]
            }
        }
    ]
}

# Pi-hole template
PIHOLE_TEMPLATE = {
    "name": "Pi-hole",
    "slug": "pihole",
    "description": "Dashboard pour Pi-hole DNS blocker - Statistiques de requêtes et gestion des listes",
    "icon": "IconCircleDot",
    "version": "1.0.0",
    "author": "System",
    "is_builtin": True,
    "config_schema": {
        "container_name": {
            "type": "string",
            "label": "Nom du conteneur",
            "required": True,
            "default": "pihole",
        },
        "api_token": {
            "type": "password",
            "label": "Token API Pi-hole",
            "required": False,
            "description": "Token pour les actions d'administration (optionnel)"
        }
    },
    "blocks": [
        {
            "id": "counter-queries",
            "type": "counter",
            "title": "Requêtes (24h)",
            "position": {"x": 0, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} pihole -c -j 2>/dev/null | jq '.dns_queries_today' || echo 0",
                "parser": "number",
                "icon": "IconSearch",
                "color": "blue",
                "refresh_interval": 60
            }
        },
        {
            "id": "counter-blocked",
            "type": "counter",
            "title": "Bloquées (24h)",
            "position": {"x": 3, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} pihole -c -j 2>/dev/null | jq '.ads_blocked_today' || echo 0",
                "parser": "number",
                "icon": "IconShieldOff",
                "color": "red",
                "refresh_interval": 60
            }
        },
        {
            "id": "counter-percent",
            "type": "counter",
            "title": "% Bloqué",
            "position": {"x": 6, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} pihole -c -j 2>/dev/null | jq '.ads_percentage_today' || echo 0",
                "parser": "number",
                "icon": "IconPercentage",
                "color": "green",
                "suffix": "%",
                "refresh_interval": 60
            }
        },
        {
            "id": "counter-domains",
            "type": "counter",
            "title": "Domaines bloqués",
            "position": {"x": 9, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "docker exec {{container_name}} pihole -c -j 2>/dev/null | jq '.domains_being_blocked' || echo 0",
                "parser": "number",
                "icon": "IconList",
                "color": "violet",
                "refresh_interval": 300
            }
        }
    ]
}

# Headscale template (VPN mesh network coordinator)
HEADSCALE_TEMPLATE = {
    "name": "Headscale",
    "slug": "headscale",
    "description": "Dashboard pour Headscale - Coordinateur VPN mesh Tailscale auto-hébergé. Gérez les utilisateurs, nodes, routes et clés d'accès.",
    "icon": "IconNetwork",
    "version": "1.2.0",
    "author": "System",
    "is_builtin": True,
    "config_schema": {
        "headscale_url": {
            "type": "string",
            "label": "URL Headscale",
            "required": True,
            "default": "http://localhost:8080",
            "description": "URL de l'API Headscale (ex: http://headscale:8080 sans slash final)"
        },
        "api_key": {
            "type": "password",
            "label": "Clé API",
            "required": True,
            "description": "Clé API Headscale pour l'authentification"
        }
    },
    "blocks": [
        # Counters row
        {
            "id": "counter-users",
            "type": "counter",
            "title": "Utilisateurs",
            "position": {"x": 0, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/user' | jq -r 'if .users then (.users | length) else 0 end'",
                "parser": "number",
                "icon": "IconUsers",
                "color": "blue",
                "refresh_interval": 30
            }
        },
        {
            "id": "counter-nodes",
            "type": "counter",
            "title": "Nodes",
            "position": {"x": 3, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/node' | jq -r 'if .nodes then (.nodes | length) else 0 end'",
                "parser": "number",
                "icon": "IconDevices",
                "color": "green",
                "refresh_interval": 30
            }
        },
        {
            "id": "counter-online",
            "type": "counter",
            "title": "Nodes en ligne",
            "position": {"x": 6, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/node' | jq -r 'if .nodes then [.nodes[] | select(.online == true)] | length else 0 end'",
                "parser": "number",
                "icon": "IconWifi",
                "color": "teal",
                "refresh_interval": 30
            }
        },
        {
            "id": "counter-routes",
            "type": "counter",
            "title": "Routes actives",
            "position": {"x": 9, "y": 0, "w": 3, "h": 2},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/routes' | jq -r 'if .routes then [.routes[] | select(.enabled == true)] | length else 0 end'",
                "parser": "number",
                "icon": "IconRoute",
                "color": "violet",
                "refresh_interval": 30
            }
        },
        # Users table
        {
            "id": "table-users",
            "type": "table",
            "title": "Utilisateurs",
            "position": {"x": 0, "y": 2, "w": 6, "h": 4},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/user' | jq -r 'if .users then .users else [] end'",
                "parser": "json",
                "refresh_interval": 30,
                "columns": [
                    {"key": "id", "label": "ID", "width": "60px"},
                    {"key": "name", "label": "Nom"},
                    {"key": "createdAt", "label": "Créé le", "format": "datetime"}
                ],
                "row_actions": [
                    {
                        "id": "delete-user",
                        "label": "Supprimer",
                        "icon": "IconTrash",
                        "color": "red",
                        "command": "curl -s -X DELETE -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/user/{{row.name}}'",
                        "confirm": True,
                        "confirm_message": "Êtes-vous sûr de vouloir supprimer l'utilisateur {{row.name}} ?"
                    }
                ]
            }
        },
        # Actions block
        {
            "id": "actions-main",
            "type": "actions",
            "title": "Actions",
            "position": {"x": 6, "y": 2, "w": 6, "h": 4},
            "config": {
                "buttons": [
                    {
                        "id": "create-user",
                        "label": "Créer un utilisateur",
                        "icon": "IconUserPlus",
                        "color": "blue",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' -H 'Content-Type: application/json' -d '{\"name\": \"{{input.username}}\"}' '{{headscale_url}}/api/v1/user'",
                        "inputs": [
                            {"id": "username", "label": "Nom d'utilisateur", "type": "text", "required": True, "placeholder": "john"}
                        ]
                    },
                    {
                        "id": "create-preauth",
                        "label": "Créer clé pré-auth",
                        "icon": "IconKey",
                        "color": "green",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' -H 'Content-Type: application/json' -d '{\"user\": \"{{input.user}}\", \"reusable\": {{input.reusable}}, \"ephemeral\": {{input.ephemeral}}}' '{{headscale_url}}/api/v1/preauthkey'",
                        "inputs": [
                            {"id": "user", "label": "Utilisateur", "type": "text", "required": True, "placeholder": "john"},
                            {"id": "reusable", "label": "Réutilisable", "type": "select", "options": ["true", "false"], "default": "false"},
                            {"id": "ephemeral", "label": "Éphémère", "type": "select", "options": ["true", "false"], "default": "false"}
                        ]
                    },
                    {
                        "id": "create-apikey",
                        "label": "Créer clé API",
                        "icon": "IconApi",
                        "color": "violet",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' -H 'Content-Type: application/json' -d '{}' '{{headscale_url}}/api/v1/apikey'",
                        "inputs": []
                    }
                ]
            }
        },
        # Nodes table
        {
            "id": "table-nodes",
            "type": "table",
            "title": "Nodes",
            "position": {"x": 0, "y": 6, "w": 12, "h": 5},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/node' | jq -r 'if .nodes then .nodes else [] end'",
                "parser": "json",
                "refresh_interval": 30,
                "columns": [
                    {"key": "id", "label": "ID", "width": "50px"},
                    {"key": "givenName", "label": "Nom"},
                    {"key": "user.name", "label": "Utilisateur", "width": "100px"},
                    {"key": "ipAddresses.0", "label": "IP", "width": "120px"},
                    {"key": "online", "label": "En ligne", "width": "80px", "format": "boolean"},
                    {"key": "lastSeen", "label": "Dernière connexion", "format": "datetime"},
                    {"key": "expiry", "label": "Expiration", "format": "datetime"}
                ],
                "row_actions": [
                    {
                        "id": "rename-node",
                        "label": "Renommer",
                        "icon": "IconEdit",
                        "color": "blue",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/node/{{row.id}}/rename/{{input.newname}}'",
                        "inputs": [
                            {"id": "newname", "label": "Nouveau nom", "type": "text", "required": True}
                        ]
                    },
                    {
                        "id": "delete-node",
                        "label": "Supprimer",
                        "icon": "IconTrash",
                        "color": "red",
                        "command": "curl -s -X DELETE -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/node/{{row.id}}'",
                        "confirm": True,
                        "confirm_message": "Êtes-vous sûr de vouloir supprimer le node {{row.givenName}} ?"
                    }
                ]
            }
        },
        # Routes table
        {
            "id": "table-routes",
            "type": "table",
            "title": "Routes",
            "position": {"x": 0, "y": 11, "w": 8, "h": 4},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/routes' | jq -r 'if .routes then .routes else [] end'",
                "parser": "json",
                "refresh_interval": 30,
                "columns": [
                    {"key": "id", "label": "ID", "width": "50px"},
                    {"key": "node.givenName", "label": "Node"},
                    {"key": "prefix", "label": "Préfixe (CIDR)"},
                    {"key": "advertised", "label": "Annoncée", "width": "80px", "format": "boolean"},
                    {"key": "enabled", "label": "Active", "width": "80px", "format": "boolean"},
                    {"key": "isPrimary", "label": "Primaire", "width": "80px", "format": "boolean"}
                ],
                "row_actions": [
                    {
                        "id": "enable-route",
                        "label": "Activer",
                        "icon": "IconCheck",
                        "color": "green",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/routes/{{row.id}}/enable'",
                        "confirm": True
                    },
                    {
                        "id": "disable-route",
                        "label": "Désactiver",
                        "icon": "IconX",
                        "color": "orange",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/routes/{{row.id}}/disable'",
                        "confirm": True
                    }
                ]
            }
        },
        # API Keys table
        {
            "id": "table-apikeys",
            "type": "table",
            "title": "Clés API",
            "position": {"x": 8, "y": 11, "w": 4, "h": 4},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/apikey' | jq -r 'if .apiKeys then .apiKeys else [] end'",
                "parser": "json",
                "refresh_interval": 60,
                "columns": [
                    {"key": "id", "label": "ID", "width": "50px"},
                    {"key": "prefix", "label": "Préfixe"},
                    {"key": "expiration", "label": "Expiration", "format": "datetime"},
                    {"key": "createdAt", "label": "Créé le", "format": "datetime"}
                ],
                "row_actions": [
                    {
                        "id": "expire-apikey",
                        "label": "Expirer",
                        "icon": "IconClock",
                        "color": "red",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' -H 'Content-Type: application/json' -d '{\"prefix\": \"{{row.prefix}}\"}' '{{headscale_url}}/api/v1/apikey/expire'",
                        "confirm": True,
                        "confirm_message": "Êtes-vous sûr de vouloir expirer cette clé API ?"
                    }
                ]
            }
        },
        # Pre-auth keys table
        {
            "id": "table-preauthkeys",
            "type": "table",
            "title": "Clés Pré-authentification",
            "position": {"x": 0, "y": 15, "w": 12, "h": 4},
            "config": {
                "command": "curl -s -H 'Authorization: Bearer {{api_key}}' '{{headscale_url}}/api/v1/preauthkey?all=true' | jq -r 'if .preAuthKeys then .preAuthKeys else [] end'",
                "parser": "json",
                "refresh_interval": 60,
                "columns": [
                    {"key": "id", "label": "ID", "width": "50px"},
                    {"key": "user", "label": "Utilisateur"},
                    {"key": "key", "label": "Clé", "width": "200px"},
                    {"key": "reusable", "label": "Réutilisable", "width": "100px", "format": "boolean"},
                    {"key": "ephemeral", "label": "Éphémère", "width": "80px", "format": "boolean"},
                    {"key": "used", "label": "Utilisée", "width": "80px", "format": "boolean"},
                    {"key": "expiration", "label": "Expiration", "format": "datetime"}
                ],
                "row_actions": [
                    {
                        "id": "expire-preauth",
                        "label": "Expirer",
                        "icon": "IconClock",
                        "color": "red",
                        "command": "curl -s -X POST -H 'Authorization: Bearer {{api_key}}' -H 'Content-Type: application/json' -d '{\"user\": \"{{row.user}}\", \"key\": \"{{row.key}}\"}' '{{headscale_url}}/api/v1/preauthkey/expire'",
                        "confirm": True,
                        "confirm_message": "Êtes-vous sûr de vouloir expirer cette clé pré-auth ?"
                    }
                ]
            }
        }
    ]
}

# All built-in templates
BUILTIN_TEMPLATES = [CROWDSEC_TEMPLATE, PIHOLE_TEMPLATE, HEADSCALE_TEMPLATE]
