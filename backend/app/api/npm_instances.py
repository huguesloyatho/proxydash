"""
NPM Instance management API routes (admin only).
Supports both database and API connection modes.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text

from app.core.database import get_db
from app.models import NpmInstance
from app.schemas import NpmInstanceCreate, NpmInstanceUpdate, NpmInstanceResponse
from app.api.deps import get_current_admin_user
from app.services.npm_api_client import NPMApiClient

router = APIRouter(prefix="/npm-instances", tags=["NPM Instances"])


def test_database_connection(instance: NpmInstance) -> tuple[bool, int | None, str | None]:
    """Test connection to an NPM PostgreSQL database."""
    try:
        url = f"postgresql://{instance.db_user}:{instance.db_password}@{instance.db_host}:{instance.db_port}/{instance.db_name}"
        engine = create_engine(url, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM proxy_host WHERE is_deleted = 0"))
            count = result.scalar()
            return True, count, None
    except Exception as e:
        return False, None, str(e)


async def test_api_connection(instance: NpmInstance) -> tuple[bool, int | None, str | None]:
    """Test connection to an NPM REST API."""
    try:
        client = NPMApiClient(instance.api_url, instance.api_email, instance.api_password)
        success, count, error = await client.test_connection()
        return success, count, error
    except Exception as e:
        return False, None, str(e)


async def test_npm_connection(instance: NpmInstance) -> tuple[bool, int | None, str | None, bool]:
    """
    Test connection to an NPM instance using the appropriate mode.

    Returns:
        Tuple of (success, count, error, is_degraded)
    """
    if instance.connection_mode == "api":
        success, count, error = await test_api_connection(instance)
        return success, count, error, True  # API mode is always degraded
    else:
        success, count, error = test_database_connection(instance)
        return success, count, error, False


@router.get("", response_model=List[NpmInstanceResponse])
async def list_npm_instances(
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all NPM instances (admin only)."""
    instances = db.query(NpmInstance).order_by(NpmInstance.priority, NpmInstance.name).all()
    return instances


@router.post("", response_model=NpmInstanceResponse)
async def create_npm_instance(
    data: NpmInstanceCreate,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new NPM instance (admin only)."""
    instance = NpmInstance(
        name=data.name,
        connection_mode=data.connection_mode,
        # Database fields
        db_host=data.db_host,
        db_port=data.db_port,
        db_name=data.db_name,
        db_user=data.db_user,
        db_password=data.db_password,
        # API fields
        api_url=data.api_url,
        api_email=data.api_email,
        api_password=data.api_password,
        # Common fields
        priority=data.priority,
        is_active=data.is_active,
    )

    # Test connection
    is_online, count, error, is_degraded = await test_npm_connection(instance)
    instance.is_online = is_online
    instance.is_degraded = is_degraded
    if not is_online:
        instance.last_error = error

    db.add(instance)
    db.commit()
    db.refresh(instance)

    return instance


@router.get("/{instance_id}", response_model=NpmInstanceResponse)
async def get_npm_instance(
    instance_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific NPM instance (admin only)."""
    instance = db.query(NpmInstance).filter(NpmInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instance NPM non trouvée"
        )
    return instance


@router.patch("/{instance_id}", response_model=NpmInstanceResponse)
async def update_npm_instance(
    instance_id: int,
    data: NpmInstanceUpdate,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update an NPM instance (admin only)."""
    instance = db.query(NpmInstance).filter(NpmInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instance NPM non trouvée"
        )

    # Update fields
    if data.name is not None:
        instance.name = data.name
    if data.connection_mode is not None:
        instance.connection_mode = data.connection_mode
    # Database fields
    if data.db_host is not None:
        instance.db_host = data.db_host
    if data.db_port is not None:
        instance.db_port = data.db_port
    if data.db_name is not None:
        instance.db_name = data.db_name
    if data.db_user is not None:
        instance.db_user = data.db_user
    if data.db_password is not None:
        instance.db_password = data.db_password
    # API fields
    if data.api_url is not None:
        instance.api_url = data.api_url
    if data.api_email is not None:
        instance.api_email = data.api_email
    if data.api_password is not None:
        instance.api_password = data.api_password
    # Common fields
    if data.priority is not None:
        instance.priority = data.priority
    if data.is_active is not None:
        instance.is_active = data.is_active

    # Test connection if connection settings changed
    connection_changed = any([
        data.connection_mode,
        data.db_host, data.db_port, data.db_name, data.db_user, data.db_password,
        data.api_url, data.api_email, data.api_password
    ])
    if connection_changed:
        is_online, count, error, is_degraded = await test_npm_connection(instance)
        instance.is_online = is_online
        instance.is_degraded = is_degraded
        instance.last_error = error if not is_online else None

    db.commit()
    db.refresh(instance)

    return instance


@router.delete("/{instance_id}")
async def delete_npm_instance(
    instance_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete an NPM instance (admin only)."""
    instance = db.query(NpmInstance).filter(NpmInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instance NPM non trouvée"
        )

    db.delete(instance)
    db.commit()

    return {"message": "Instance NPM supprimée"}


@router.post("/{instance_id}/test")
async def test_npm_instance_endpoint(
    instance_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Test connection to an NPM instance (admin only)."""
    instance = db.query(NpmInstance).filter(NpmInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instance NPM non trouvée"
        )

    is_online, count, error, is_degraded = await test_npm_connection(instance)
    instance.is_online = is_online
    instance.is_degraded = is_degraded
    instance.last_error = error if not is_online else None
    db.commit()

    if is_online:
        return {
            "success": True,
            "proxy_hosts_count": count,
            "is_degraded": is_degraded,
            "mode": instance.connection_mode
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error or "Connexion échouée"
        )
