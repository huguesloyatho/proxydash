"""
Logs Service for fetching Docker container logs via SSH.
Provides real-time log streaming with filtering and timestamp support.
"""

import asyncssh
import logging
import os
import re
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class LogsService:
    """Service for fetching Docker container logs via SSH."""

    def __init__(self, host: str, ssh_port: int = 22, ssh_user: str = "root",
                 ssh_key: str = "", ssh_password: str = ""):
        self.host = host
        self.ssh_port = ssh_port
        self.ssh_user = ssh_user
        self.ssh_key = ssh_key
        self.ssh_password = ssh_password
        self._connection: Optional[asyncssh.SSHClientConnection] = None

    async def _get_connection(self) -> asyncssh.SSHClientConnection:
        """Get or create SSH connection."""
        if self._connection is not None:
            return self._connection

        connect_opts = {
            "host": self.host,
            "port": self.ssh_port,
            "username": self.ssh_user,
            "known_hosts": None,
        }

        if self.ssh_key:
            key_content = self.ssh_key
            if self.ssh_key.startswith('~') or self.ssh_key.startswith('/'):
                key_path = os.path.expanduser(self.ssh_key)
                if os.path.exists(key_path):
                    with open(key_path, 'r') as f:
                        key_content = f.read()
                else:
                    raise ValueError(f"Fichier clé SSH non trouvé: {key_path}")
            key = asyncssh.import_private_key(key_content)
            connect_opts["client_keys"] = [key]
        elif self.ssh_password:
            connect_opts["password"] = self.ssh_password
        else:
            raise ValueError("Ni clé SSH ni mot de passe fourni")

        self._connection = await asyncssh.connect(**connect_opts)
        return self._connection

    async def close(self):
        """Close SSH connection."""
        if self._connection:
            self._connection.close()
            await self._connection.wait_closed()
            self._connection = None

    async def get_container_logs(
        self,
        container_name: str,
        max_lines: int = 100,
        show_timestamps: bool = True,
        filter_pattern: str = "",
        since: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get logs from a Docker container.

        Args:
            container_name: Name of the container
            max_lines: Maximum number of lines to fetch
            show_timestamps: Include timestamps in logs
            filter_pattern: Regex pattern to filter logs
            since: Time filter (e.g., "1h", "30m", "2023-01-01T00:00:00")

        Returns:
            Dict with logs data
        """
        try:
            conn = await self._get_connection()

            # Build docker logs command
            cmd_parts = ["docker", "logs"]

            if show_timestamps:
                cmd_parts.append("--timestamps")

            cmd_parts.extend(["--tail", str(max_lines)])

            if since:
                cmd_parts.extend(["--since", since])

            cmd_parts.append(container_name)
            cmd_parts.append("2>&1")  # Capture stderr too

            cmd = " ".join(cmd_parts)

            result = await conn.run(cmd, check=False)

            if result.exit_status != 0 and "No such container" in (result.stdout or ""):
                return {
                    "success": False,
                    "container": container_name,
                    "error": f"Container '{container_name}' non trouvé",
                    "logs": [],
                    "line_count": 0,
                }

            # Parse logs
            raw_logs = result.stdout if result.stdout else ""
            lines = raw_logs.strip().split("\n") if raw_logs.strip() else []

            # Filter if pattern provided
            if filter_pattern:
                try:
                    pattern = re.compile(filter_pattern, re.IGNORECASE)
                    lines = [line for line in lines if pattern.search(line)]
                except re.error as e:
                    logger.warning(f"Invalid regex pattern: {filter_pattern}, error: {e}")

            # Parse log lines with timestamps
            parsed_logs = []
            for line in lines:
                if not line.strip():
                    continue

                log_entry = {"raw": line}

                # Try to parse timestamp if present (format: 2024-01-15T10:30:45.123456789Z)
                if show_timestamps and line:
                    timestamp_match = re.match(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*(.*)', line)
                    if timestamp_match:
                        log_entry["timestamp"] = timestamp_match.group(1)
                        log_entry["message"] = timestamp_match.group(2)
                    else:
                        log_entry["message"] = line
                else:
                    log_entry["message"] = line

                # Detect log level
                log_entry["level"] = self._detect_log_level(log_entry.get("message", line))

                parsed_logs.append(log_entry)

            return {
                "success": True,
                "container": container_name,
                "host": self.host,
                "logs": parsed_logs,
                "line_count": len(parsed_logs),
                "max_lines": max_lines,
                "fetched_at": datetime.now().isoformat(),
            }

        except asyncssh.Error as e:
            logger.error(f"SSH error for logs on {self.host}: {e}")
            return {
                "success": False,
                "container": container_name,
                "error": f"Erreur SSH: {str(e)}",
                "logs": [],
                "line_count": 0,
            }
        except Exception as e:
            logger.error(f"Logs fetch error on {self.host}: {e}")
            return {
                "success": False,
                "container": container_name,
                "error": str(e),
                "logs": [],
                "line_count": 0,
            }

    def _detect_log_level(self, message: str) -> str:
        """Detect log level from message content."""
        message_lower = message.lower()

        if any(x in message_lower for x in ['error', 'err', 'exception', 'fatal', 'critical']):
            return "error"
        elif any(x in message_lower for x in ['warn', 'warning']):
            return "warning"
        elif any(x in message_lower for x in ['info', 'information']):
            return "info"
        elif any(x in message_lower for x in ['debug', 'trace']):
            return "debug"
        else:
            return "default"

    async def list_containers(self) -> List[Dict[str, str]]:
        """List available containers for selection."""
        try:
            conn = await self._get_connection()

            result = await conn.run(
                'docker ps -a --format "{{.Names}}|{{.Status}}|{{.State}}"',
                check=False
            )

            if result.exit_status != 0:
                return []

            containers = []
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                parts = line.split("|")
                if len(parts) >= 3:
                    containers.append({
                        "name": parts[0],
                        "status": parts[1],
                        "state": parts[2],
                    })

            return containers

        except Exception as e:
            logger.error(f"Error listing containers on {self.host}: {e}")
            return []


async def fetch_logs_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch Docker container logs for widget.

    Args:
        config: Widget configuration with SSH and log settings

    Returns:
        Dict with logs data
    """
    host = config.get("host", "")
    ssh_port = config.get("ssh_port", 22)
    ssh_user = config.get("ssh_user", "root")
    ssh_key = config.get("ssh_key", "")
    ssh_password = config.get("ssh_password", "")
    container_name = config.get("container_name", "")
    max_lines = config.get("max_lines", 100)
    show_timestamps = config.get("show_timestamps", True)
    filter_pattern = config.get("filter_pattern", "")

    if not host:
        return {"error": "Hôte Docker non configuré", "logs": [], "success": False}

    if not container_name:
        return {"error": "Container non sélectionné", "logs": [], "success": False}

    service = LogsService(
        host=host,
        ssh_port=ssh_port,
        ssh_user=ssh_user,
        ssh_key=ssh_key,
        ssh_password=ssh_password,
    )

    try:
        result = await service.get_container_logs(
            container_name=container_name,
            max_lines=max_lines,
            show_timestamps=show_timestamps,
            filter_pattern=filter_pattern,
        )
        return result
    finally:
        await service.close()
