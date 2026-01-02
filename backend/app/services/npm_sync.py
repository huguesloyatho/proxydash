"""
NPM (Nginx Proxy Manager) synchronization service.
Supports two connection modes:
- Database mode: Direct PostgreSQL access (full features)
- API mode: REST API access (degraded mode - no advanced_config/Authelia detection)

Supports priority-based selection when the same domain exists in multiple NPMs.
"""

import json
import logging
from datetime import datetime
from typing import List, Dict, Set, Union, Protocol
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text

from app.models import Application, Category, NpmInstance
from app.services.app_detection import detect_application, get_icon_url, format_app_name, should_hide_app
from app.services.ollama import generate_description
from app.services.npm_api_client import NPMApiClient, NPMApiProxyHost
from app.services.http_fingerprint import fingerprint_url, get_icon_url as fingerprint_get_icon_url

logger = logging.getLogger(__name__)


class ProxyHostProtocol(Protocol):
    """Protocol for proxy host objects (from DB or API)."""
    id: int
    primary_domain: str
    url: str
    is_authelia_protected: bool
    instance: "NpmInstance"


class NPMProxyHost:
    """Represents a proxy host from NPM database (full mode)."""

    def __init__(self, row, instance: NpmInstance):
        self.id = row.id
        self.instance = instance
        self.domain_names = json.loads(row.domain_names) if isinstance(row.domain_names, str) else row.domain_names
        self.forward_host = row.forward_host
        self.forward_port = row.forward_port
        self.enabled = row.enabled == 1
        self.is_deleted = row.is_deleted == 1
        self.ssl_forced = row.ssl_forced == 1
        self.forward_scheme = row.forward_scheme
        self.advanced_config = row.advanced_config or ""

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
        """Check if the proxy host is protected by Authelia."""
        if not self.advanced_config:
            return False
        config_lower = self.advanced_config.lower()
        return "authelia" in config_lower or "auth_request" in config_lower


class NPMApiProxyHostWrapper:
    """Wrapper to add instance reference to API proxy hosts."""

    def __init__(self, api_host: NPMApiProxyHost, instance: NpmInstance):
        self._api_host = api_host
        self.instance = instance
        self.id = api_host.id

    @property
    def primary_domain(self) -> str:
        return self._api_host.primary_domain

    @property
    def url(self) -> str:
        return self._api_host.url

    @property
    def is_authelia_protected(self) -> bool:
        # Always False in API mode - advanced_config not available
        return False


def get_npm_connection(instance: NpmInstance):
    """Create a database connection for an NPM instance."""
    url = f"postgresql://{instance.db_user}:{instance.db_password}@{instance.db_host}:{instance.db_port}/{instance.db_name}"
    return create_engine(url, connect_args={"connect_timeout": 10})


def get_npm_proxy_hosts_from_database(instance: NpmInstance) -> List[NPMProxyHost]:
    """
    Fetch all active proxy hosts from NPM PostgreSQL database.

    Args:
        instance: NpmInstance to fetch from

    Returns:
        List of NPMProxyHost objects
    """
    try:
        engine = get_npm_connection(instance)
        with engine.connect() as conn:
            query = text("""
                SELECT id, domain_names, forward_host, forward_port,
                       enabled, is_deleted, ssl_forced, forward_scheme, advanced_config
                FROM proxy_host
                WHERE is_deleted = 0 AND enabled = 1
                ORDER BY id
            """)
            result = conn.execute(query)
            return [NPMProxyHost(row, instance) for row in result]
    except Exception as e:
        logger.error(f"Failed to fetch from NPM database {instance.name}: {e}")
        raise


async def get_npm_proxy_hosts_from_api(instance: NpmInstance) -> List[NPMApiProxyHostWrapper]:
    """
    Fetch all active proxy hosts from NPM REST API.

    Args:
        instance: NpmInstance to fetch from

    Returns:
        List of NPMApiProxyHostWrapper objects

    Note:
        API mode is degraded - advanced_config is not available,
        so Authelia detection will not work.
    """
    try:
        client = NPMApiClient(instance.api_url, instance.api_email, instance.api_password)
        api_hosts = await client.get_proxy_hosts()
        return [NPMApiProxyHostWrapper(h, instance) for h in api_hosts]
    except Exception as e:
        logger.error(f"Failed to fetch from NPM API {instance.name}: {e}")
        raise


async def get_npm_proxy_hosts_from_instance(instance: NpmInstance) -> tuple[List[Union[NPMProxyHost, NPMApiProxyHostWrapper]], bool]:
    """
    Fetch proxy hosts from an NPM instance using the appropriate connection mode.

    Args:
        instance: NpmInstance to fetch from

    Returns:
        Tuple of (hosts, is_degraded)
        - hosts: List of proxy host objects
        - is_degraded: True if using API mode (less info available)
    """
    if instance.connection_mode == "api":
        hosts = await get_npm_proxy_hosts_from_api(instance)
        return hosts, True
    else:
        # Database mode - synchronous but wrapped
        hosts = get_npm_proxy_hosts_from_database(instance)
        return hosts, False


def select_priority_hosts(all_hosts: List[Union[NPMProxyHost, NPMApiProxyHostWrapper]]) -> Dict[str, Union[NPMProxyHost, NPMApiProxyHostWrapper]]:
    """
    Select the highest priority host for each domain.
    Lower priority number = higher priority.

    Args:
        all_hosts: List of all proxy hosts from all instances

    Returns:
        Dictionary mapping domain -> best proxy host
    """
    domain_hosts: Dict[str, Union[NPMProxyHost, NPMApiProxyHostWrapper]] = {}

    for host in all_hosts:
        domain = host.primary_domain
        if not domain:
            continue

        if domain not in domain_hosts:
            domain_hosts[domain] = host
        else:
            # Keep the one with lower priority (higher precedence)
            existing = domain_hosts[domain]
            if host.instance.priority < existing.instance.priority:
                domain_hosts[domain] = host
            # If same priority, keep the existing one (first come first serve)

    return domain_hosts


async def sync_all_npm_instances(db: Session, use_ollama: bool = True, use_http_fingerprint: bool = True) -> dict:
    """
    Synchronize applications from all active NPM instances.

    Args:
        db: SQLAlchemy session for our database
        use_ollama: Whether to use Ollama for generating descriptions
        use_http_fingerprint: Whether to use HTTP fingerprinting for undetected apps

    Returns:
        Dictionary with sync statistics
    """
    stats = {
        "total": 0,
        "created": 0,
        "updated": 0,
        "unchanged": 0,
        "errors": 0,
        "removed": 0,
        "instances_synced": 0,
        "instances_failed": 0,
        "instances_degraded": 0,
        "fingerprinted": 0,  # Apps detected via HTTP fingerprinting
    }

    # Get all active NPM instances sorted by priority
    instances = db.query(NpmInstance).filter(
        NpmInstance.is_active == True
    ).order_by(NpmInstance.priority).all()

    if not instances:
        logger.warning("No active NPM instances configured")
        return stats

    # Collect all proxy hosts from all instances
    all_hosts: List[Union[NPMProxyHost, NPMApiProxyHostWrapper]] = []
    instance_hosts: Dict[int, List[Union[NPMProxyHost, NPMApiProxyHostWrapper]]] = {}

    for instance in instances:
        mode_label = "API" if instance.connection_mode == "api" else "DB"
        logger.info(f"Fetching from NPM instance: {instance.name} (priority: {instance.priority}, mode: {mode_label})")
        try:
            hosts, is_degraded = await get_npm_proxy_hosts_from_instance(instance)
            all_hosts.extend(hosts)
            instance_hosts[instance.id] = hosts

            # Update instance status
            instance.is_online = True
            instance.is_degraded = is_degraded
            instance.last_error = None
            instance.last_synced_at = datetime.utcnow()
            stats["instances_synced"] += 1
            if is_degraded:
                stats["instances_degraded"] += 1
            logger.info(f"  Found {len(hosts)} proxy hosts" + (" (degraded mode)" if is_degraded else ""))
        except Exception as e:
            instance.is_online = False
            instance.last_error = str(e)[:500]
            stats["instances_failed"] += 1
            logger.error(f"  Failed: {e}")

    db.commit()

    if not all_hosts:
        logger.warning("No proxy hosts found in any NPM instance")
        return stats

    # Select best host for each domain based on priority
    selected_hosts = select_priority_hosts(all_hosts)
    stats["total"] = len(selected_hosts)

    logger.info(f"Selected {len(selected_hosts)} unique domains from {len(all_hosts)} total hosts")

    # Get category mapping
    categories = {c.slug: c.id for c in db.query(Category).all()}

    # Track which instance+proxy_id combinations we've processed
    processed_keys: Set[str] = set()

    for domain, host in selected_hosts.items():
        try:
            key = f"{host.instance.id}:{host.id}"
            processed_keys.add(key)

            # Check if application already exists for this domain
            # First try to find by exact URL
            existing_app = db.query(Application).filter(
                Application.url == host.url
            ).first()

            # Or by domain name (handles http vs https and different instances)
            if not existing_app:
                # Check for same domain with different scheme
                alt_scheme_url = host.url.replace("https://", "http://") if host.url.startswith("https://") else host.url.replace("http://", "https://")
                existing_app = db.query(Application).filter(
                    Application.url == alt_scheme_url
                ).first()

            # Or by npm_instance_id + npm_proxy_id (same instance, same proxy)
            if not existing_app:
                existing_app = db.query(Application).filter(
                    Application.npm_instance_id == host.instance.id,
                    Application.npm_proxy_id == host.id
                ).first()

            # Or by domain in URL (handles cases where same domain exists from different NPM instances)
            if not existing_app:
                existing_app = db.query(Application).filter(
                    Application.url.like(f"%://{domain}%"),
                    Application.is_manual == False
                ).first()

            # Detect application type - first try subdomain-based detection
            detected_type, icon, category_slug, default_desc = detect_application(host.primary_domain)

            # If subdomain detection failed, try HTTP fingerprinting
            fingerprint_used = False
            if use_http_fingerprint and not detected_type:
                try:
                    fingerprint_result = await fingerprint_url(host.url)
                    if fingerprint_result.app_type and fingerprint_result.confidence >= 0.7:
                        detected_type = fingerprint_result.app_type
                        icon = fingerprint_result.icon
                        category_slug = fingerprint_result.category
                        default_desc = fingerprint_result.description
                        fingerprint_used = True
                        stats["fingerprinted"] += 1
                        logger.info(
                            f"HTTP fingerprint detected {host.primary_domain} as {detected_type} "
                            f"(confidence: {fingerprint_result.confidence:.0%})"
                        )
                except Exception as e:
                    logger.debug(f"HTTP fingerprint failed for {host.primary_domain}: {e}")

            if existing_app:
                # Update existing application
                updated = False

                # Update instance reference if changed
                if existing_app.npm_instance_id != host.instance.id:
                    existing_app.npm_instance_id = host.instance.id
                    existing_app.npm_proxy_id = host.id
                    updated = True

                if not existing_app.name_override:
                    new_name = format_app_name(host.primary_domain, detected_type)
                    if existing_app.name != new_name:
                        existing_app.name = new_name
                        updated = True

                if existing_app.url != host.url:
                    existing_app.url = host.url
                    updated = True

                # Update forward info (for infrastructure schema)
                if hasattr(host, 'forward_host'):
                    if existing_app.forward_host != host.forward_host:
                        existing_app.forward_host = host.forward_host
                        updated = True
                    if existing_app.forward_port != host.forward_port:
                        existing_app.forward_port = host.forward_port
                        updated = True
                    if existing_app.forward_scheme != host.forward_scheme:
                        existing_app.forward_scheme = host.forward_scheme
                        updated = True

                if not existing_app.icon_override and icon:
                    new_icon = get_icon_url(icon)
                    if existing_app.icon != new_icon:
                        existing_app.icon = new_icon
                        updated = True

                if not existing_app.category_override and category_slug and category_slug in categories:
                    new_cat_id = categories[category_slug]
                    if existing_app.category_id != new_cat_id:
                        existing_app.category_id = new_cat_id
                        updated = True

                if not existing_app.description_override:
                    if default_desc and existing_app.description != default_desc:
                        existing_app.description = default_desc
                        updated = True

                # Only update Authelia status if instance is not degraded
                if not host.instance.is_degraded:
                    if existing_app.is_authelia_protected != host.is_authelia_protected:
                        existing_app.is_authelia_protected = host.is_authelia_protected
                        updated = True

                existing_app.detected_type = detected_type
                existing_app.last_synced_at = datetime.utcnow()

                if updated:
                    stats["updated"] += 1
                else:
                    stats["unchanged"] += 1

            else:
                # Create new application
                description = default_desc

                if use_ollama and not description:
                    try:
                        generated = await generate_description(
                            format_app_name(host.primary_domain, detected_type),
                            host.primary_domain,
                            detected_type
                        )
                        if generated:
                            description = generated
                    except Exception as e:
                        logger.warning(f"Failed to generate description for {host.primary_domain}: {e}")

                is_hidden = should_hide_app(host.primary_domain)

                app = Application(
                    npm_instance_id=host.instance.id,
                    npm_proxy_id=host.id,
                    name=format_app_name(host.primary_domain, detected_type),
                    url=host.url,
                    icon=get_icon_url(icon) if icon else None,
                    description=description,
                    detected_type=detected_type,
                    category_id=categories.get(category_slug) if category_slug else categories.get("other"),
                    is_visible=not is_hidden,
                    is_manual=False,
                    # Only set Authelia if not degraded mode
                    is_authelia_protected=host.is_authelia_protected if not host.instance.is_degraded else False,
                    # Forward info for infrastructure schema
                    forward_host=getattr(host, 'forward_host', None),
                    forward_port=getattr(host, 'forward_port', None),
                    forward_scheme=getattr(host, 'forward_scheme', None),
                    last_synced_at=datetime.utcnow(),
                )
                db.add(app)
                stats["created"] += 1
                logger.info(f"Created application: {app.name} ({host.primary_domain}) from {host.instance.name}")

        except Exception as e:
            logger.error(f"Error processing proxy host {host.id} from {host.instance.name}: {e}")
            stats["errors"] += 1

    db.commit()

    # Remove applications that no longer exist in any NPM
    removed = remove_orphaned_applications(db, instances, instance_hosts)
    stats["removed"] = removed

    logger.info(f"Sync completed: {stats}")
    return stats


def remove_orphaned_applications(
    db: Session,
    instances: List[NpmInstance],
    instance_hosts: Dict[int, List[Union[NPMProxyHost, NPMApiProxyHostWrapper]]]
) -> int:
    """
    Remove applications that no longer exist in any NPM instance.

    Args:
        db: SQLAlchemy session for our database
        instances: List of NPM instances that were synced
        instance_hosts: Dictionary mapping instance_id to list of hosts

    Returns:
        Number of applications removed
    """
    count = 0

    # Build set of valid (instance_id, proxy_id) pairs
    valid_pairs: Set[tuple] = set()
    for instance_id, hosts in instance_hosts.items():
        for host in hosts:
            valid_pairs.add((instance_id, host.id))

    # Find applications from synced instances that are no longer valid
    instance_ids = [i.id for i in instances]
    apps = db.query(Application).filter(
        Application.npm_instance_id.in_(instance_ids),
        Application.is_manual == False
    ).all()

    for app in apps:
        if (app.npm_instance_id, app.npm_proxy_id) not in valid_pairs:
            logger.info(f"Removing deleted application: {app.name}")
            db.delete(app)
            count += 1

    db.commit()
    return count


# Legacy function for backward compatibility
async def sync_applications(db: Session, npm_db: Session, use_ollama: bool = True) -> dict:
    """
    Legacy synchronization function. Now redirects to sync_all_npm_instances.
    The npm_db parameter is ignored as we now read from NpmInstance table.
    """
    return await sync_all_npm_instances(db, use_ollama)


def remove_deleted_applications(db: Session, npm_db: Session) -> int:
    """
    Legacy function. Orphan removal is now handled in sync_all_npm_instances.
    """
    return 0
