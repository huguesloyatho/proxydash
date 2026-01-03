"""
Server Connection Helper.
Provides utilities to get SSH credentials from a Server model.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.server import Server


class ServerConnectionConfig:
    """SSH connection configuration from a server."""

    def __init__(
        self,
        host: str,
        ssh_port: int = 22,
        ssh_user: str = "root",
        ssh_key: str = "",
        ssh_password: str = "",
        server_name: str = "",
    ):
        self.host = host
        self.ssh_port = ssh_port
        self.ssh_user = ssh_user
        self.ssh_key = ssh_key
        self.ssh_password = ssh_password
        self.server_name = server_name

    def to_dict(self) -> Dict[str, Any]:
        return {
            "host": self.host,
            "ssh_port": self.ssh_port,
            "ssh_user": self.ssh_user,
            "ssh_key": self.ssh_key,
            "ssh_password": self.ssh_password,
        }


def get_server_connection(
    db: Session,
    server_id: Optional[int] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Optional[ServerConnectionConfig]:
    """
    Get SSH connection config from a server ID or widget config.

    Priority:
    1. If server_id is provided in config, use that server's credentials
    2. Otherwise use the credentials from config directly

    Args:
        db: Database session
        server_id: Server ID (from config.server_id)
        config: Widget configuration dict

    Returns:
        ServerConnectionConfig or None if not enough info
    """
    config = config or {}
    server_id = server_id or config.get("server_id")

    if server_id:
        # Get credentials from server
        server = db.query(Server).filter(Server.id == server_id).first()
        if server:
            return ServerConnectionConfig(
                host=server.host,
                ssh_port=server.ssh_port,
                ssh_user=server.ssh_user,
                ssh_key=server.ssh_key or "",
                ssh_password=server.ssh_password or "",
                server_name=server.name,
            )

    # Fall back to config credentials
    host = config.get("host", "")
    if host:
        return ServerConnectionConfig(
            host=host,
            ssh_port=config.get("ssh_port", 22),
            ssh_user=config.get("ssh_user", "root"),
            ssh_key=config.get("ssh_key", ""),
            ssh_password=config.get("ssh_password", ""),
            server_name=host,
        )

    return None


def merge_server_config(
    db: Session,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Merge server credentials into widget config.
    If server_id is present, replace SSH fields with server's credentials.

    This allows widgets to use a centralized server config
    while keeping other widget-specific settings.

    Args:
        db: Database session
        config: Widget configuration dict

    Returns:
        Updated config dict with server credentials merged in
    """
    server_id = config.get("server_id")
    if not server_id:
        return config

    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        return config

    # Create a copy to avoid modifying original
    merged = dict(config)

    # Override SSH fields with server credentials
    merged["host"] = server.host
    merged["ssh_port"] = server.ssh_port
    merged["ssh_user"] = server.ssh_user
    merged["ssh_key"] = server.ssh_key or ""
    merged["ssh_password"] = server.ssh_password or ""

    # Auto-enable SSH if server has credentials (key or password)
    if server.ssh_key or server.ssh_password:
        merged["ssh_enabled"] = True

    # Use server name if widget name is empty
    if not merged.get("name"):
        merged["name"] = server.name

    # Keep reference to server for display purposes
    merged["_server_name"] = server.name
    merged["_server_id"] = server.id

    return merged
