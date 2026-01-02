"""
Docker Service for managing containers via SSH.
Provides list, start, stop, restart operations for Docker containers.
"""

import asyncio
import asyncssh
import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ContainerInfo:
    """Docker container information."""
    id: str
    name: str
    image: str
    status: str
    state: str  # running, exited, paused, etc.
    ports: List[str]
    created: str
    cpu_percent: Optional[float] = None
    memory_usage: Optional[int] = None
    memory_limit: Optional[int] = None
    memory_percent: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "image": self.image,
            "status": self.status,
            "state": self.state,
            "ports": self.ports,
            "created": self.created,
            "cpu_percent": self.cpu_percent,
            "memory_usage": self.memory_usage,
            "memory_limit": self.memory_limit,
            "memory_percent": self.memory_percent,
        }


class DockerService:
    """Service for managing Docker containers via SSH."""

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

    async def list_containers(self, filter_names: Optional[List[str]] = None,
                              include_stopped: bool = True,
                              show_stats: bool = True) -> Dict[str, Any]:
        """
        List Docker containers with their status and optionally stats.

        Args:
            filter_names: List of container names to filter (None = all)
            include_stopped: Include stopped containers
            show_stats: Include CPU/memory stats (slower)

        Returns:
            Dict with containers list and summary
        """
        try:
            conn = await self._get_connection()

            # List all containers
            all_flag = "-a" if include_stopped else ""
            format_str = '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}'

            result = await conn.run(
                f'docker ps {all_flag} --format "{format_str}"',
                check=False
            )

            if result.exit_status != 0:
                error_msg = result.stderr.strip() if result.stderr else "Impossible d'exécuter docker ps"
                return {"error": error_msg, "containers": []}

            containers: List[ContainerInfo] = []
            lines = result.stdout.strip().split("\n") if result.stdout.strip() else []

            for line in lines:
                if not line.strip():
                    continue

                parts = line.split("|")
                if len(parts) >= 7:
                    container_id = parts[0][:12]
                    name = parts[1]
                    image = parts[2]
                    status = parts[3]
                    state = parts[4]
                    ports_str = parts[5]
                    created = parts[6]

                    # Filter by name if specified
                    if filter_names and name not in filter_names:
                        continue

                    # Parse ports
                    port_list = []
                    if ports_str:
                        for p in ports_str.split(","):
                            p = p.strip()
                            if "->" in p:
                                try:
                                    host_part = p.split("->")[0]
                                    if ":" in host_part:
                                        port_list.append(host_part.split(":")[-1])
                                except Exception:
                                    pass

                    containers.append(ContainerInfo(
                        id=container_id,
                        name=name,
                        image=image,
                        status=status,
                        state=state,
                        ports=port_list,
                        created=created,
                    ))

            # Get stats if requested
            if show_stats and containers:
                running_containers = [c for c in containers if c.state == "running"]
                if running_containers:
                    names_for_stats = " ".join([c.name for c in running_containers])
                    stats_result = await conn.run(
                        f'docker stats --no-stream --format "{{{{.Name}}}}|{{{{.CPUPerc}}}}|{{{{.MemUsage}}}}|{{{{.MemPerc}}}}" {names_for_stats}',
                        check=False
                    )

                    if stats_result.exit_status == 0:
                        stats_map = {}
                        for line in stats_result.stdout.strip().split("\n"):
                            if not line.strip():
                                continue
                            parts = line.split("|")
                            if len(parts) >= 4:
                                name = parts[0]
                                try:
                                    cpu = float(parts[1].replace("%", ""))
                                except ValueError:
                                    cpu = 0.0

                                # Parse memory usage: "123.4MiB / 1.234GiB"
                                mem_str = parts[2]
                                mem_usage = 0
                                mem_limit = 0
                                try:
                                    mem_parts = mem_str.split("/")
                                    if len(mem_parts) == 2:
                                        mem_usage = self._parse_memory_string(mem_parts[0].strip())
                                        mem_limit = self._parse_memory_string(mem_parts[1].strip())
                                except Exception:
                                    pass

                                try:
                                    mem_percent = float(parts[3].replace("%", ""))
                                except ValueError:
                                    mem_percent = 0.0

                                stats_map[name] = {
                                    "cpu": cpu,
                                    "mem_usage": mem_usage,
                                    "mem_limit": mem_limit,
                                    "mem_percent": mem_percent,
                                }

                        # Apply stats to containers
                        for container in containers:
                            if container.name in stats_map:
                                stats = stats_map[container.name]
                                container.cpu_percent = stats["cpu"]
                                container.memory_usage = stats["mem_usage"]
                                container.memory_limit = stats["mem_limit"]
                                container.memory_percent = stats["mem_percent"]

            # Summary
            running = sum(1 for c in containers if c.state == "running")
            stopped = sum(1 for c in containers if c.state == "exited")
            paused = sum(1 for c in containers if c.state == "paused")

            return {
                "containers": [c.to_dict() for c in containers],
                "summary": {
                    "total": len(containers),
                    "running": running,
                    "stopped": stopped,
                    "paused": paused,
                },
                "host": self.host,
                "fetched_at": datetime.now().isoformat(),
            }

        except asyncssh.Error as e:
            logger.error(f"SSH error for Docker list on {self.host}: {e}")
            return {"error": f"Erreur SSH: {str(e)}", "containers": []}
        except Exception as e:
            logger.error(f"Docker list error on {self.host}: {e}")
            return {"error": str(e), "containers": []}

    def _parse_memory_string(self, mem_str: str) -> int:
        """Parse memory string like '123.4MiB' to bytes."""
        mem_str = mem_str.strip().upper()
        multipliers = {
            "B": 1,
            "KB": 1024,
            "KIB": 1024,
            "MB": 1024 * 1024,
            "MIB": 1024 * 1024,
            "GB": 1024 * 1024 * 1024,
            "GIB": 1024 * 1024 * 1024,
        }

        for suffix, multiplier in multipliers.items():
            if mem_str.endswith(suffix):
                try:
                    value = float(mem_str[:-len(suffix)])
                    return int(value * multiplier)
                except ValueError:
                    return 0
        return 0

    async def start_container(self, container_name: str) -> Dict[str, Any]:
        """Start a Docker container."""
        return await self._container_action("start", container_name)

    async def stop_container(self, container_name: str) -> Dict[str, Any]:
        """Stop a Docker container."""
        return await self._container_action("stop", container_name)

    async def restart_container(self, container_name: str) -> Dict[str, Any]:
        """Restart a Docker container."""
        return await self._container_action("restart", container_name)

    async def _container_action(self, action: str, container_name: str) -> Dict[str, Any]:
        """Execute an action on a container (start, stop, restart)."""
        try:
            conn = await self._get_connection()

            result = await conn.run(
                f"docker {action} {container_name}",
                check=False
            )

            if result.exit_status == 0:
                return {
                    "success": True,
                    "action": action,
                    "container": container_name,
                    "message": f"Container {container_name} {action}ed successfully",
                }
            else:
                error_msg = result.stderr.strip() if result.stderr else f"Failed to {action} container"
                return {
                    "success": False,
                    "action": action,
                    "container": container_name,
                    "error": error_msg,
                }

        except asyncssh.Error as e:
            logger.error(f"SSH error for Docker {action} on {self.host}: {e}")
            return {
                "success": False,
                "action": action,
                "container": container_name,
                "error": f"Erreur SSH: {str(e)}",
            }
        except Exception as e:
            logger.error(f"Docker {action} error on {self.host}: {e}")
            return {
                "success": False,
                "action": action,
                "container": container_name,
                "error": str(e),
            }

    async def get_container_logs(self, container_name: str, lines: int = 50) -> Dict[str, Any]:
        """Get logs from a container."""
        try:
            conn = await self._get_connection()

            result = await conn.run(
                f"docker logs --tail {lines} {container_name} 2>&1",
                check=False
            )

            return {
                "success": True,
                "container": container_name,
                "logs": result.stdout if result.stdout else "",
                "lines": lines,
            }

        except Exception as e:
            logger.error(f"Docker logs error on {self.host}: {e}")
            return {
                "success": False,
                "container": container_name,
                "error": str(e),
            }


async def fetch_docker_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch Docker containers data for widget.

    Args:
        config: Widget configuration with SSH and container settings

    Returns:
        Dict with containers list and summary
    """
    host = config.get("host", "")
    ssh_port = config.get("ssh_port", 22)
    ssh_user = config.get("ssh_user", "root")
    ssh_key = config.get("ssh_key", "")
    ssh_password = config.get("ssh_password", "")
    containers_filter = config.get("containers", "")
    show_stats = config.get("show_stats", True)

    if not host:
        return {"error": "Hôte Docker non configuré", "containers": []}

    # Parse container filter (one name per line)
    filter_names = None
    if containers_filter:
        filter_names = [c.strip() for c in containers_filter.split("\n") if c.strip()]

    service = DockerService(
        host=host,
        ssh_port=ssh_port,
        ssh_user=ssh_user,
        ssh_key=ssh_key,
        ssh_password=ssh_password,
    )

    try:
        result = await service.list_containers(
            filter_names=filter_names,
            include_stopped=True,
            show_stats=show_stats,
        )
        return result
    finally:
        await service.close()
