"""
Widget data fetching service.
Handles fetching data from various sources for widgets.
"""

import logging
import httpx
import asyncio
import socket
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from icalendar import Calendar
from dateutil.rrule import rrulestr
from dateutil import tz

logger = logging.getLogger(__name__)

# Disable SSL verification for self-signed certificates
SSL_VERIFY = False


async def fetch_weather_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch weather data from OpenWeatherMap API."""
    api_key = config.get("api_key")
    city = config.get("city", "Paris")
    units = config.get("units", "metric")

    if not api_key:
        return {"error": "Clé API OpenWeatherMap non configurée"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Current weather
            response = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "appid": api_key, "units": units, "lang": "fr"}
            )
            response.raise_for_status()
            current = response.json()

            data = {
                "city": current.get("name"),
                "country": current.get("sys", {}).get("country"),
                "temp": round(current.get("main", {}).get("temp", 0)),
                "feels_like": round(current.get("main", {}).get("feels_like", 0)),
                "humidity": current.get("main", {}).get("humidity"),
                "description": current.get("weather", [{}])[0].get("description", ""),
                "icon": current.get("weather", [{}])[0].get("icon", "01d"),
                "wind_speed": current.get("wind", {}).get("speed"),
            }

            # Forecast if requested
            if config.get("show_forecast", True):
                forecast_response = await client.get(
                    "https://api.openweathermap.org/data/2.5/forecast",
                    params={"q": city, "appid": api_key, "units": units, "lang": "fr", "cnt": 8}
                )
                if forecast_response.status_code == 200:
                    forecast_data = forecast_response.json()
                    data["forecast"] = [
                        {
                            "dt": item.get("dt"),
                            "temp": round(item.get("main", {}).get("temp", 0)),
                            "icon": item.get("weather", [{}])[0].get("icon", "01d"),
                            "description": item.get("weather", [{}])[0].get("description", ""),
                        }
                        for item in forecast_data.get("list", [])[:5]
                    ]

            return data

    except httpx.HTTPStatusError as e:
        logger.error(f"Weather API error: {e}")
        return {"error": f"Erreur API météo: {e.response.status_code}"}
    except Exception as e:
        logger.error(f"Weather fetch error: {e}")
        return {"error": str(e)}


async def fetch_proxmox_node_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch Proxmox node status data."""
    host = config.get("host")
    port = config.get("port", 8006)
    node = config.get("node", "pve")
    token_id = config.get("api_token_id")
    token_secret = config.get("api_token_secret")
    verify_ssl = config.get("verify_ssl", False)

    if not all([host, token_id, token_secret]):
        return {"error": "Configuration Proxmox incomplète"}

    try:
        base_url = f"https://{host}:{port}/api2/json"
        headers = {"Authorization": f"PVEAPIToken={token_id}={token_secret}"}

        async with httpx.AsyncClient(timeout=10.0, verify=verify_ssl) as client:
            # Node status
            response = await client.get(
                f"{base_url}/nodes/{node}/status",
                headers=headers
            )
            response.raise_for_status()
            status = response.json().get("data", {})

            return {
                "node": node,
                "status": "online",
                "uptime": status.get("uptime", 0),
                "cpu": round(status.get("cpu", 0) * 100, 1),
                "memory": {
                    "used": status.get("memory", {}).get("used", 0),
                    "total": status.get("memory", {}).get("total", 0),
                    "percent": round(
                        status.get("memory", {}).get("used", 0) /
                        max(status.get("memory", {}).get("total", 1), 1) * 100, 1
                    ),
                },
                "swap": {
                    "used": status.get("swap", {}).get("used", 0),
                    "total": status.get("swap", {}).get("total", 0),
                },
                "rootfs": {
                    "used": status.get("rootfs", {}).get("used", 0),
                    "total": status.get("rootfs", {}).get("total", 0),
                    "percent": round(
                        status.get("rootfs", {}).get("used", 0) /
                        max(status.get("rootfs", {}).get("total", 1), 1) * 100, 1
                    ),
                },
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"Proxmox API error: {e}")
        return {"error": f"Erreur API Proxmox: {e.response.status_code}", "status": "error"}
    except Exception as e:
        logger.error(f"Proxmox fetch error: {e}")
        return {"error": str(e), "status": "error"}


async def fetch_proxmox_vm_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch Proxmox VM/LXC status data."""
    host = config.get("host")
    port = config.get("port", 8006)
    node = config.get("node", "pve")
    vmid = config.get("vmid")
    vm_type = config.get("vm_type", "qemu")
    token_id = config.get("api_token_id")
    token_secret = config.get("api_token_secret")
    verify_ssl = config.get("verify_ssl", False)

    if not all([host, token_id, token_secret, vmid]):
        return {"error": "Configuration Proxmox incomplète"}

    try:
        base_url = f"https://{host}:{port}/api2/json"
        headers = {"Authorization": f"PVEAPIToken={token_id}={token_secret}"}

        async with httpx.AsyncClient(timeout=10.0, verify=verify_ssl) as client:
            # VM status
            response = await client.get(
                f"{base_url}/nodes/{node}/{vm_type}/{vmid}/status/current",
                headers=headers
            )
            response.raise_for_status()
            status = response.json().get("data", {})

            return {
                "vmid": vmid,
                "name": status.get("name", f"VM {vmid}"),
                "status": status.get("status", "unknown"),
                "type": vm_type,
                "uptime": status.get("uptime", 0),
                "cpu": round(status.get("cpu", 0) * 100, 1),
                "memory": {
                    "used": status.get("mem", 0),
                    "total": status.get("maxmem", 0),
                    "percent": round(
                        status.get("mem", 0) /
                        max(status.get("maxmem", 1), 1) * 100, 1
                    ),
                },
                "disk": {
                    "used": status.get("disk", 0),
                    "total": status.get("maxdisk", 0),
                },
                "netin": status.get("netin", 0),
                "netout": status.get("netout", 0),
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"Proxmox VM API error: {e}")
        return {"error": f"Erreur API Proxmox: {e.response.status_code}", "status": "error"}
    except Exception as e:
        logger.error(f"Proxmox VM fetch error: {e}")
        return {"error": str(e), "status": "error"}


async def fetch_proxmox_summary_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch summary of all VMs/LXCs on a Proxmox node."""
    host = config.get("host")
    port = config.get("port", 8006)
    node = config.get("node", "pve")
    token_id = config.get("api_token_id")
    token_secret = config.get("api_token_secret")
    verify_ssl = config.get("verify_ssl", False)
    show_lxc = config.get("show_lxc", True)
    show_qemu = config.get("show_qemu", True)

    if not all([host, token_id, token_secret]):
        return {"error": "Configuration Proxmox incomplète"}

    try:
        base_url = f"https://{host}:{port}/api2/json"
        headers = {"Authorization": f"PVEAPIToken={token_id}={token_secret}"}

        vms = []
        async with httpx.AsyncClient(timeout=15.0, verify=verify_ssl) as client:
            if show_qemu:
                response = await client.get(
                    f"{base_url}/nodes/{node}/qemu",
                    headers=headers
                )
                if response.status_code == 200:
                    for vm in response.json().get("data", []):
                        vms.append({
                            "vmid": vm.get("vmid"),
                            "name": vm.get("name", f"VM {vm.get('vmid')}"),
                            "status": vm.get("status"),
                            "type": "qemu",
                            "cpu": round(vm.get("cpu", 0) * 100, 1),
                            "mem_percent": round(
                                vm.get("mem", 0) / max(vm.get("maxmem", 1), 1) * 100, 1
                            ),
                        })

            if show_lxc:
                response = await client.get(
                    f"{base_url}/nodes/{node}/lxc",
                    headers=headers
                )
                if response.status_code == 200:
                    for lxc in response.json().get("data", []):
                        vms.append({
                            "vmid": lxc.get("vmid"),
                            "name": lxc.get("name", f"LXC {lxc.get('vmid')}"),
                            "status": lxc.get("status"),
                            "type": "lxc",
                            "cpu": round(lxc.get("cpu", 0) * 100, 1),
                            "mem_percent": round(
                                lxc.get("mem", 0) / max(lxc.get("maxmem", 1), 1) * 100, 1
                            ),
                        })

        # Sort by name
        vms.sort(key=lambda x: x.get("name", ""))

        running = sum(1 for vm in vms if vm.get("status") == "running")
        stopped = sum(1 for vm in vms if vm.get("status") == "stopped")

        return {
            "node": node,
            "vms": vms,
            "summary": {
                "total": len(vms),
                "running": running,
                "stopped": stopped,
            }
        }

    except Exception as e:
        logger.error(f"Proxmox summary fetch error: {e}")
        return {"error": str(e)}


async def fetch_calendar_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch and parse iCal data from multiple sources."""
    ical_urls_raw = config.get("ical_urls", "")
    days_ahead = config.get("days_ahead", 7)

    # Parse URLs (one per line)
    ical_urls = [url.strip() for url in ical_urls_raw.split("\n") if url.strip()]

    if not ical_urls:
        return {"events": [], "message": "Aucune URL iCal configurée"}

    all_events = []
    now = datetime.now(tz.tzlocal())
    end_date = now + timedelta(days=days_ahead)

    async with httpx.AsyncClient(timeout=15.0) as client:
        for url in ical_urls:
            try:
                response = await client.get(url)
                response.raise_for_status()

                cal = Calendar.from_ical(response.content)

                for component in cal.walk():
                    if component.name == "VEVENT":
                        dtstart = component.get("dtstart")
                        dtend = component.get("dtend")
                        summary = str(component.get("summary", "Sans titre"))

                        if dtstart:
                            start = dtstart.dt
                            # Handle all-day events (date without time)
                            if isinstance(start, datetime):
                                if start.tzinfo is None:
                                    start = start.replace(tzinfo=tz.tzlocal())
                            else:
                                # All-day event
                                start = datetime.combine(start, datetime.min.time()).replace(tzinfo=tz.tzlocal())

                            end = None
                            if dtend:
                                end = dtend.dt
                                if isinstance(end, datetime):
                                    if end.tzinfo is None:
                                        end = end.replace(tzinfo=tz.tzlocal())
                                else:
                                    end = datetime.combine(end, datetime.min.time()).replace(tzinfo=tz.tzlocal())

                            # Handle recurring events
                            rrule = component.get("rrule")
                            if rrule:
                                try:
                                    rule = rrulestr(rrule.to_ical().decode(), dtstart=start)
                                    occurrences = list(rule.between(now, end_date, inc=True))[:10]
                                    for occ in occurrences:
                                        all_events.append({
                                            "summary": summary,
                                            "start": occ.isoformat(),
                                            "end": (occ + (end - start)).isoformat() if end else None,
                                            "all_day": not isinstance(dtstart.dt, datetime),
                                        })
                                except Exception:
                                    pass
                            elif now <= start <= end_date:
                                all_events.append({
                                    "summary": summary,
                                    "start": start.isoformat(),
                                    "end": end.isoformat() if end else None,
                                    "all_day": not isinstance(dtstart.dt, datetime),
                                })

            except Exception as e:
                logger.warning(f"Failed to fetch iCal from {url}: {e}")
                continue

    # Sort by start date
    all_events.sort(key=lambda x: x["start"])

    return {"events": all_events[:50]}  # Limit to 50 events


async def check_port(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a port is open on a host."""
    try:
        loop = asyncio.get_event_loop()
        future = loop.run_in_executor(
            None,
            lambda: socket.create_connection((host, port), timeout=timeout)
        )
        conn = await asyncio.wait_for(future, timeout=timeout + 1)
        conn.close()
        return True
    except Exception:
        return False


async def check_ping(host: str) -> bool:
    """Check if host responds to ping."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", "2", host,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await asyncio.wait_for(proc.wait(), timeout=5)
        return proc.returncode == 0
    except Exception:
        return False


async def fetch_ssh_metrics(host: str, port: int, username: str, ssh_key: str, ssh_password: str, show_docker: bool) -> Dict[str, Any]:
    """Fetch system metrics via SSH connection."""
    import asyncssh
    import io

    metrics = {
        "cpu_percent": None,
        "memory": None,
        "disk": None,
        "containers": [],
        "ssh_error": None,
    }

    try:
        # Prepare connection options
        connect_opts = {
            "host": host,
            "port": port,
            "username": username,
            "known_hosts": None,  # Disable host key verification for simplicity
            "login_timeout": 10,  # Timeout for connection
            "connect_timeout": 10,  # Timeout for TCP connection
        }

        if ssh_key:
            # Use SSH key - can be a file path or the key content directly
            import os
            key_content = ssh_key
            # Check if it's a file path
            if ssh_key.startswith('~') or ssh_key.startswith('/'):
                key_path = os.path.expanduser(ssh_key)
                if os.path.exists(key_path):
                    with open(key_path, 'r') as f:
                        key_content = f.read()
                else:
                    return {"ssh_error": f"Fichier clé SSH non trouvé: {key_path}"}
            key = asyncssh.import_private_key(key_content)
            connect_opts["client_keys"] = [key]
        elif ssh_password:
            connect_opts["password"] = ssh_password
        else:
            return {"ssh_error": "Ni clé SSH ni mot de passe fourni"}

        async with asyncssh.connect(**connect_opts) as conn:
            # Get CPU usage (using /proc/stat - two measurements 1s apart)
            cpu_result = await conn.run(
                "cat /proc/stat | head -1 && sleep 0.5 && cat /proc/stat | head -1",
                check=False
            )
            if cpu_result.exit_status == 0:
                try:
                    lines = cpu_result.stdout.strip().split("\n")
                    if len(lines) >= 2:
                        cpu1 = [int(x) for x in lines[0].split()[1:8]]
                        cpu2 = [int(x) for x in lines[1].split()[1:8]]
                        idle1 = cpu1[3]
                        idle2 = cpu2[3]
                        total1 = sum(cpu1)
                        total2 = sum(cpu2)
                        idle_delta = idle2 - idle1
                        total_delta = total2 - total1
                        if total_delta > 0:
                            metrics["cpu_percent"] = round((1 - idle_delta / total_delta) * 100, 1)
                except Exception:
                    pass

            # Get memory info
            mem_result = await conn.run("cat /proc/meminfo", check=False)
            if mem_result.exit_status == 0:
                try:
                    mem_info = {}
                    for line in mem_result.stdout.strip().split("\n"):
                        parts = line.split(":")
                        if len(parts) == 2:
                            key = parts[0].strip()
                            value = int(parts[1].strip().split()[0]) * 1024  # Convert to bytes
                            mem_info[key] = value

                    total = mem_info.get("MemTotal", 0)
                    available = mem_info.get("MemAvailable", mem_info.get("MemFree", 0))
                    used = total - available

                    metrics["memory"] = {
                        "total": total,
                        "used": used,
                        "percent": round(used / total * 100, 1) if total > 0 else 0,
                    }
                except Exception:
                    pass

            # Get disk info (root partition)
            disk_result = await conn.run("df -B1 / | tail -1", check=False)
            if disk_result.exit_status == 0:
                try:
                    parts = disk_result.stdout.strip().split()
                    if len(parts) >= 5:
                        total = int(parts[1])
                        used = int(parts[2])
                        metrics["disk"] = {
                            "total": total,
                            "used": used,
                            "percent": round(used / total * 100, 1) if total > 0 else 0,
                        }
                except Exception:
                    pass

            # Get Docker containers if requested
            if show_docker:
                docker_result = await conn.run(
                    'docker ps --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}" 2>/dev/null',
                    check=False
                )
                if docker_result.exit_status == 0 and docker_result.stdout.strip():
                    for line in docker_result.stdout.strip().split("\n"):
                        parts = line.split("|")
                        if len(parts) >= 4:
                            # Parse ports from format like "0.0.0.0:8080->80/tcp, 0.0.0.0:443->443/tcp"
                            ports_str = parts[3]
                            port_list = []
                            if ports_str:
                                for p in ports_str.split(","):
                                    p = p.strip()
                                    if "->" in p:
                                        # Extract host port
                                        try:
                                            host_part = p.split("->")[0]
                                            if ":" in host_part:
                                                port_list.append(host_part.split(":")[-1])
                                        except Exception:
                                            pass

                            metrics["containers"].append({
                                "id": parts[0][:12],
                                "name": parts[1],
                                "status": parts[2],
                                "ports": port_list,
                            })

    except asyncssh.Error as e:
        metrics["ssh_error"] = f"SSH: {str(e)}"
    except Exception as e:
        metrics["ssh_error"] = f"Erreur: {str(e)}"

    return metrics


async def fetch_vm_status_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch status for a generic VM/server via ping, port checks, and optionally SSH."""
    name = config.get("name", "Serveur")
    host = config.get("host", "")
    check_ports_str = config.get("check_ports", "")
    icon_url = config.get("icon_url", "")
    description = config.get("description", "")

    # SSH options
    ssh_enabled = config.get("ssh_enabled", False)
    ssh_port = config.get("ssh_port", 22)
    ssh_user = config.get("ssh_user", "root")
    ssh_key = config.get("ssh_key", "")
    ssh_password = config.get("ssh_password", "")
    show_docker = config.get("show_docker", True)

    if not host:
        return {"error": "Adresse IP/hostname non configurée"}

    # Parse ports
    ports = []
    if check_ports_str:
        try:
            ports = [int(p.strip()) for p in check_ports_str.split(",") if p.strip()]
        except ValueError:
            ports = []

    # Check ping
    is_online = await check_ping(host)

    # Check ports
    port_status = {}
    for port in ports:
        port_status[port] = await check_port(host, port)

    result = {
        "name": name,
        "host": host,
        "is_online": is_online,
        "ports": port_status,
        "icon_url": icon_url,
        "description": description,
        "checked_at": datetime.now().isoformat(),
    }

    # If SSH is enabled and server is online, fetch additional metrics
    if ssh_enabled and is_online:
        ssh_metrics = await fetch_ssh_metrics(host, ssh_port, ssh_user, ssh_key, ssh_password, show_docker)
        result["cpu_percent"] = ssh_metrics.get("cpu_percent")
        result["memory"] = ssh_metrics.get("memory")
        result["disk"] = ssh_metrics.get("disk")
        result["containers"] = ssh_metrics.get("containers", [])
        result["ssh_error"] = ssh_metrics.get("ssh_error")
        result["ssh_enabled"] = True
    else:
        result["ssh_enabled"] = False

    return result


async def fetch_vikunja_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch tasks from Vikunja API."""
    api_url = config.get("api_url", "").rstrip("/")
    api_token = config.get("api_token", "")
    project_id = config.get("project_id", 0)
    show_completed = config.get("show_completed", False)
    max_tasks = config.get("max_tasks", 10)
    filter_type = config.get("filter", "all")
    assignee_id = config.get("assignee_id", 0)  # Filter by assignee

    if not api_url or not api_token:
        return {"error": "Configuration Vikunja incomplète"}

    try:
        headers = {"Authorization": f"Bearer {api_token}"}

        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            # Build params with Vikunja filter syntax
            params: Dict[str, Any] = {"per_page": max_tasks * 3}  # Fetch more to allow for filtering

            # Use Vikunja's native filter to exclude completed tasks if needed
            # This is more efficient than fetching all and filtering client-side
            if not show_completed:
                params["filter"] = "done = false"

            if project_id and project_id > 0:
                url = f"{api_url}/api/v1/projects/{project_id}/tasks"
            else:
                url = f"{api_url}/api/v1/tasks/all"

            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            tasks_data = response.json()

            # Get total count from pagination header
            # Vikunja uses x-pagination-total-pages header
            total_pages_header = response.headers.get("x-pagination-total-pages", "0")
            per_page_used = max_tasks * 3
            if total_pages_header.isdigit():
                # Total tasks = total_pages * per_page (approximation)
                # But we need exact count, so make a separate call
                count_params: Dict[str, Any] = {"per_page": 1}
                count_response = await client.get(url.replace("/tasks/all", "/tasks/all"), headers=headers, params=count_params)
                count_total_pages = count_response.headers.get("x-pagination-total-pages", "0")
                total_all_tasks = int(count_total_pages) if count_total_pages.isdigit() else len(tasks_data)
            else:
                total_all_tasks = len(tasks_data)

            tasks = []
            now = datetime.now(tz.tzlocal())
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_end = today_start + timedelta(days=7)

            for task in tasks_data:
                # Parse due date
                due_date = None
                due_date_str = task.get("due_date")
                if due_date_str and due_date_str != "0001-01-01T00:00:00Z":
                    try:
                        due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                    except Exception:
                        pass

                # Apply filter
                if filter_type == "today":
                    if not due_date or due_date.date() != now.date():
                        continue
                elif filter_type == "week":
                    if not due_date or not (today_start <= due_date <= week_end):
                        continue
                elif filter_type == "overdue":
                    if not due_date or due_date >= now:
                        continue

                # Filter by assignee
                if assignee_id and assignee_id > 0:
                    assignees = task.get("assignees") or []
                    assignee_ids = [a.get("id") for a in assignees if a and isinstance(a, dict)]
                    if assignee_id not in assignee_ids:
                        continue

                # Handle labels safely (can be None or missing)
                labels_data = task.get("labels") or []
                labels = [l.get("title") for l in labels_data if l and isinstance(l, dict)]

                # Handle assignees
                assignees_data = task.get("assignees") or []
                assignees_list = [
                    {
                        "id": a.get("id"),
                        "name": a.get("name", ""),
                        "username": a.get("username", ""),
                    }
                    for a in assignees_data if a and isinstance(a, dict)
                ]

                tasks.append({
                    "id": task.get("id"),
                    "title": task.get("title", "Sans titre"),
                    "done": task.get("done", False),
                    "priority": task.get("priority", 0),
                    "due_date": due_date.isoformat() if due_date else None,
                    "project_id": task.get("project_id"),
                    "labels": labels,
                    "assignees": assignees_list,
                })

            # Sort by priority (desc) then due date
            tasks.sort(key=lambda x: (-x.get("priority", 0), x.get("due_date") or "9999"))

            # Count: when filtered, tasks_data only contains incomplete tasks
            # Use total_all_tasks for the complete count
            if not show_completed:
                incomplete_count = len(tasks_data)
                completed_count = max(0, total_all_tasks - incomplete_count)
            else:
                completed_count = sum(1 for t in tasks_data if t.get("done"))
                incomplete_count = len(tasks_data) - completed_count

            return {
                "tasks": tasks[:max_tasks],
                "total": total_all_tasks,
                "completed_count": completed_count,
                "incomplete_count": incomplete_count,
                "show_completed": show_completed,
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"Vikunja API error: {e}")
        return {"error": f"Erreur API Vikunja: {e.response.status_code}"}
    except Exception as e:
        logger.error(f"Vikunja fetch error: {e}")
        return {"error": str(e)}


async def fetch_crowdsec_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch CrowdSec security data (decisions, alerts, metrics)."""
    api_url = config.get("api_url", "").rstrip("/")
    api_key = config.get("api_key", "")
    max_decisions = config.get("max_decisions", 10)
    max_alerts = config.get("max_alerts", 10)
    show_metrics = config.get("show_metrics", True)
    show_decisions = config.get("show_decisions", True)
    show_alerts = config.get("show_alerts", True)
    show_countries = config.get("show_countries", True)

    if not api_url or not api_key:
        return {"error": "Configuration CrowdSec incomplète (URL ou clé API manquante)"}

    headers = {
        "X-Api-Key": api_key,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            decisions = []
            alerts = []

            # Fetch decisions
            if show_decisions:
                try:
                    dec_response = await client.get(f"{api_url}/v1/decisions", headers=headers)
                    if dec_response.status_code == 200:
                        decisions = dec_response.json() or []
                    elif dec_response.status_code == 403:
                        return {"error": "Clé API CrowdSec invalide"}
                except Exception as e:
                    logger.warning(f"Failed to fetch CrowdSec decisions: {e}")

            # Fetch alerts
            if show_alerts:
                try:
                    alerts_response = await client.get(f"{api_url}/v1/alerts", headers=headers)
                    if alerts_response.status_code == 200:
                        alerts = alerts_response.json() or []
                except Exception as e:
                    logger.warning(f"Failed to fetch CrowdSec alerts: {e}")

            # Sort alerts by ID descending (most recent first)
            alerts = sorted(alerts, key=lambda x: x.get("id", 0), reverse=True)

            # Calculate metrics
            metrics = {}
            if show_metrics:
                origin_counts = {}
                action_counts = {}
                country_counts = {}
                scenario_counts = {}

                for decision in decisions:
                    origin = decision.get("origin", "unknown")
                    action = decision.get("type", "unknown")
                    origin_counts[origin] = origin_counts.get(origin, 0) + 1
                    action_counts[action] = action_counts.get(action, 0) + 1

                for alert in alerts:
                    source = alert.get("source", {})
                    country = source.get("cn", "unknown") if source else "unknown"
                    if show_countries:
                        country_counts[country] = country_counts.get(country, 0) + 1

                    scenario = alert.get("scenario", "unknown")
                    scenario_counts[scenario] = scenario_counts.get(scenario, 0) + 1

                metrics = {
                    "total_decisions": len(decisions),
                    "total_alerts": len(alerts),
                    "by_origin": origin_counts,
                    "by_action": action_counts,
                    "by_country": dict(sorted(country_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
                    "by_scenario": dict(sorted(scenario_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
                }

            # Format decisions for display
            formatted_decisions = []
            for dec in decisions[:max_decisions]:
                formatted_decisions.append({
                    "id": dec.get("id"),
                    "origin": dec.get("origin", "unknown"),
                    "scope": dec.get("scope", ""),
                    "value": dec.get("value", ""),
                    "type": dec.get("type", "ban"),
                    "duration": dec.get("duration", ""),
                    "scenario": dec.get("scenario", ""),
                })

            # Format alerts for display
            formatted_alerts = []
            for alert in alerts[:max_alerts]:
                source = alert.get("source", {}) or {}
                formatted_alerts.append({
                    "id": alert.get("id"),
                    "scenario": alert.get("scenario", "unknown"),
                    "message": alert.get("message", ""),
                    "ip": source.get("ip", ""),
                    "country": source.get("cn", ""),
                    "as_name": source.get("as_name", ""),
                    "created_at": alert.get("created_at", ""),
                    "events_count": alert.get("events_count", 0),
                })

            return {
                "decisions": formatted_decisions,
                "decisions_count": len(decisions),
                "alerts": formatted_alerts,
                "alerts_count": len(alerts),
                "metrics": metrics,
                "fetched_at": datetime.now().isoformat(),
            }

    except httpx.TimeoutException:
        return {"error": "Timeout lors de la connexion à CrowdSec"}
    except httpx.RequestError as e:
        return {"error": f"Impossible de joindre CrowdSec: {str(e)}"}
    except Exception as e:
        logger.error(f"CrowdSec fetch error: {e}")
        return {"error": str(e)}


async def fetch_uptime_ping_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch ping data for uptime monitoring widget."""
    from app.services.ping_service import PingService

    targets_str = config.get("targets", "")
    names_str = config.get("target_names", "")
    ping_count = config.get("ping_count", 5)
    ping_timeout = config.get("ping_timeout", 5)
    latency_warning = config.get("latency_warning", 100)
    latency_critical = config.get("latency_critical", 500)
    loss_warning = config.get("loss_warning", 5)
    loss_critical = config.get("loss_critical", 20)

    # Parse targets
    targets = [t.strip() for t in targets_str.split("\n") if t.strip()]
    names = [n.strip() for n in names_str.split("\n") if n.strip()]

    if not targets:
        return {"error": "Aucune cible configurée", "targets": []}

    # Create target list with names
    target_list = []
    for i, target in enumerate(targets):
        name = names[i] if i < len(names) and names[i] else target
        target_list.append({"target": target, "name": name})

    # Perform pings
    ping_service = PingService()
    results = []

    for item in target_list:
        target = item["target"]
        name = item["name"]

        result = await ping_service.ping(
            target=target,
            count=ping_count,
            timeout=ping_timeout,
        )

        # Determine status color based on thresholds
        status = "ok"
        if not result.is_reachable:
            status = "critical"
        elif result.packet_loss_percent >= loss_critical:
            status = "critical"
        elif result.packet_loss_percent >= loss_warning:
            status = "warning"
        elif result.latency_avg and result.latency_avg >= latency_critical:
            status = "critical"
        elif result.latency_avg and result.latency_avg >= latency_warning:
            status = "warning"

        results.append({
            "target": target,
            "name": name,
            "is_reachable": result.is_reachable,
            "latency_min": result.latency_min,
            "latency_avg": result.latency_avg,
            "latency_max": result.latency_max,
            "jitter": result.jitter,
            "packet_loss_percent": result.packet_loss_percent,
            "status": status,
            "error_message": result.error_message,
            "timestamp": result.timestamp.isoformat() if result.timestamp else None,
        })

    return {
        "targets": results,
        "config": {
            "latency_warning": latency_warning,
            "latency_critical": latency_critical,
            "loss_warning": loss_warning,
            "loss_critical": loss_critical,
            "show_jitter": config.get("show_jitter", True),
            "show_packet_loss": config.get("show_packet_loss", True),
            "show_statistics": config.get("show_statistics", True),
            "graph_height": config.get("graph_height", 150),
        },
        "fetched_at": datetime.now().isoformat(),
    }


async def fetch_widget_data(widget_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch data for a widget based on its type.

    Args:
        widget_type: Type of widget
        config: Widget configuration

    Returns:
        Dictionary with widget data or error
    """
    from app.services.docker_service import fetch_docker_data
    from app.services.logs_service import fetch_logs_data

    fetchers = {
        "weather": fetch_weather_data,
        "proxmox_node": fetch_proxmox_node_data,
        "proxmox_vm": fetch_proxmox_vm_data,
        "proxmox_summary": fetch_proxmox_summary_data,
        "calendar": fetch_calendar_data,
        "vm_status": fetch_vm_status_data,
        "vikunja": fetch_vikunja_data,
        "crowdsec": fetch_crowdsec_data,
        "uptime_ping": fetch_uptime_ping_data,
        "docker": fetch_docker_data,
        "logs": fetch_logs_data,
    }

    fetcher = fetchers.get(widget_type)
    if not fetcher:
        # Some widgets don't need backend data (clock, iframe)
        return {"message": "Ce widget n'a pas besoin de données backend"}

    return await fetcher(config)
