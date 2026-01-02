"""
NPM API Client for fetching proxy hosts via REST API.
Used when direct database access is not available (e.g., SQLite instances).
Note: API mode provides less information than database mode (degraded mode).
"""

import logging
import httpx
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class NPMApiProxyHost:
    """Represents a proxy host from NPM API."""
    id: int
    domain_names: List[str]
    forward_host: str
    forward_port: int
    enabled: bool
    ssl_forced: bool
    forward_scheme: str
    # Note: advanced_config is NOT available via API (degraded mode)
    advanced_config: str = ""

    @property
    def primary_domain(self) -> str:
        """Get the primary domain name."""
        return self.domain_names[0] if self.domain_names else ""

    @property
    def url(self) -> str:
        """Build the public URL."""
        scheme = "https" if self.ssl_forced else "http"
        return f"{scheme}://{self.primary_domain}"

    @property
    def is_authelia_protected(self) -> bool:
        """
        Check if the proxy host is protected by Authelia.
        NOTE: This always returns False in API mode because advanced_config
        is not available via the API. This is a limitation of degraded mode.
        """
        return False


class NPMApiClient:
    """Client for interacting with NPM REST API."""

    def __init__(self, base_url: str, email: str, password: str):
        """
        Initialize the NPM API client.

        Args:
            base_url: NPM base URL (e.g., "https://npm.example.com")
            email: NPM admin email
            password: NPM admin password
        """
        self.base_url = base_url.rstrip('/')
        self.email = email
        self.password = password
        self.token: Optional[str] = None

    async def _get_token(self) -> str:
        """Authenticate and get JWT token."""
        if self.token:
            return self.token

        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            response = await client.post(
                f"{self.base_url}/api/tokens",
                json={
                    "identity": self.email,
                    "secret": self.password
                }
            )
            response.raise_for_status()
            data = response.json()
            self.token = data.get("token")
            if not self.token:
                raise ValueError("No token in response")
            return self.token

    async def get_proxy_hosts(self) -> List[NPMApiProxyHost]:
        """
        Fetch all enabled proxy hosts from NPM API.

        Returns:
            List of NPMApiProxyHost objects

        Note:
            API mode does NOT provide:
            - advanced_config (nginx custom config)
            - is_deleted flag (API only returns active hosts)
            This means Authelia detection is NOT available in API mode.
        """
        token = await self._get_token()

        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(
                f"{self.base_url}/api/nginx/proxy-hosts",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            hosts_data = response.json()

        proxy_hosts = []
        for host in hosts_data:
            # Only include enabled hosts
            if not host.get("enabled", False):
                continue

            proxy_hosts.append(NPMApiProxyHost(
                id=host.get("id"),
                domain_names=host.get("domain_names", []),
                forward_host=host.get("forward_host", ""),
                forward_port=host.get("forward_port", 80),
                enabled=host.get("enabled", False),
                ssl_forced=host.get("ssl_forced", 0) == 1,
                forward_scheme=host.get("forward_scheme", "http"),
                # advanced_config not available via API
                advanced_config=""
            ))

        return proxy_hosts

    async def test_connection(self) -> tuple[bool, int, Optional[str]]:
        """
        Test connection to NPM API.

        Returns:
            Tuple of (success, proxy_host_count, error_message)
        """
        try:
            hosts = await self.get_proxy_hosts()
            return True, len(hosts), None
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return False, 0, "Authentification échouée - vérifiez email/mot de passe"
            return False, 0, f"Erreur HTTP {e.response.status_code}"
        except httpx.ConnectError:
            return False, 0, "Impossible de se connecter à l'API NPM"
        except Exception as e:
            return False, 0, str(e)


async def get_npm_proxy_hosts_from_api(
    api_url: str,
    api_email: str,
    api_password: str
) -> tuple[List[NPMApiProxyHost], bool, Optional[str]]:
    """
    Fetch proxy hosts from NPM via API.

    Args:
        api_url: NPM base URL
        api_email: NPM admin email
        api_password: NPM admin password

    Returns:
        Tuple of (proxy_hosts, success, error_message)
    """
    client = NPMApiClient(api_url, api_email, api_password)
    try:
        hosts = await client.get_proxy_hosts()
        return hosts, True, None
    except Exception as e:
        logger.error(f"Failed to fetch from NPM API {api_url}: {e}")
        return [], False, str(e)
