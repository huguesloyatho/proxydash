"""
Server management API routes (admin only).
Servers represent reusable SSH connections that widgets can reference.
"""

from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import asyncssh

from app.core.database import get_db
from app.models import Server
from app.schemas import ServerCreate, ServerUpdate, ServerResponse, ServerTestResult
from app.api.deps import get_current_admin_user

router = APIRouter(prefix="/servers", tags=["Servers"])


async def test_ssh_connection(server: Server) -> ServerTestResult:
    """Test SSH connection to a server and detect Docker."""
    try:
        # Build connection options
        connect_kwargs = {
            "host": server.host,
            "port": server.ssh_port,
            "username": server.ssh_user,
            "known_hosts": None,
            "connect_timeout": 10,
        }

        # Add authentication
        if server.ssh_key:
            key_data = server.ssh_key
            if not key_data.startswith("-----"):
                # Might be a file path, expand it
                import os
                expanded_path = os.path.expanduser(key_data)
                if os.path.exists(expanded_path):
                    with open(expanded_path, "r") as f:
                        key_data = f.read()

            connect_kwargs["client_keys"] = [asyncssh.import_private_key(key_data)]
        elif server.ssh_password:
            connect_kwargs["password"] = server.ssh_password

        async with asyncssh.connect(**connect_kwargs) as conn:
            # Connection successful, check for Docker
            result = await conn.run("docker --version 2>/dev/null", check=False)
            has_docker = result.exit_status == 0
            docker_version = None
            containers_count = None

            if has_docker:
                docker_version = result.stdout.strip().split(",")[0] if result.stdout else None
                # Count containers
                count_result = await conn.run("docker ps -a --format '{{.ID}}' | wc -l", check=False)
                if count_result.exit_status == 0:
                    try:
                        containers_count = int(count_result.stdout.strip())
                    except ValueError:
                        containers_count = 0

            return ServerTestResult(
                success=True,
                message="Connexion SSH réussie",
                has_docker=has_docker,
                docker_version=docker_version,
                containers_count=containers_count,
            )

    except asyncssh.DisconnectError as e:
        return ServerTestResult(success=False, message=f"Déconnexion: {str(e)}")
    except asyncssh.PermissionDenied:
        return ServerTestResult(success=False, message="Permission refusée (mauvais utilisateur ou clé)")
    except asyncssh.HostKeyNotVerifiable:
        return ServerTestResult(success=False, message="Clé hôte non vérifiable")
    except OSError as e:
        return ServerTestResult(success=False, message=f"Erreur réseau: {str(e)}")
    except Exception as e:
        return ServerTestResult(success=False, message=f"Erreur: {str(e)}")


@router.get("", response_model=List[ServerResponse])
async def list_servers(
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all servers (admin only)."""
    servers = db.query(Server).order_by(Server.name).all()
    return servers


@router.post("", response_model=ServerResponse)
async def create_server(
    data: ServerCreate,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new server (admin only)."""
    # Check for duplicate name
    existing = db.query(Server).filter(Server.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un serveur avec ce nom existe déjà"
        )

    server = Server(
        name=data.name,
        description=data.description,
        icon=data.icon,
        host=data.host,
        ssh_port=data.ssh_port,
        ssh_user=data.ssh_user,
        ssh_key=data.ssh_key,
        ssh_password=data.ssh_password,
        has_docker=data.has_docker,
        has_proxmox=data.has_proxmox,
    )

    # Test connection
    result = await test_ssh_connection(server)
    server.is_online = result.success
    server.last_check = datetime.utcnow()
    if not result.success:
        server.last_error = result.message
    else:
        server.last_error = None
        # Update has_docker based on actual detection
        if result.has_docker is not None:
            server.has_docker = result.has_docker

    db.add(server)
    db.commit()
    db.refresh(server)

    return server


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific server (admin only)."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serveur non trouvé"
        )
    return server


@router.patch("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: int,
    data: ServerUpdate,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a server (admin only)."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serveur non trouvé"
        )

    # Check for duplicate name
    if data.name and data.name != server.name:
        existing = db.query(Server).filter(Server.name == data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un serveur avec ce nom existe déjà"
            )

    # Update fields
    if data.name is not None:
        server.name = data.name
    if data.description is not None:
        server.description = data.description
    if data.icon is not None:
        server.icon = data.icon
    if data.host is not None:
        server.host = data.host
    if data.ssh_port is not None:
        server.ssh_port = data.ssh_port
    if data.ssh_user is not None:
        server.ssh_user = data.ssh_user
    if data.ssh_key is not None:
        server.ssh_key = data.ssh_key
    if data.ssh_password is not None:
        server.ssh_password = data.ssh_password
    if data.has_docker is not None:
        server.has_docker = data.has_docker
    if data.has_proxmox is not None:
        server.has_proxmox = data.has_proxmox

    # Test connection if connection settings changed
    connection_changed = any([
        data.host, data.ssh_port, data.ssh_user, data.ssh_key, data.ssh_password
    ])
    if connection_changed:
        result = await test_ssh_connection(server)
        server.is_online = result.success
        server.last_check = datetime.utcnow()
        server.last_error = result.message if not result.success else None
        if result.success and result.has_docker is not None:
            server.has_docker = result.has_docker

    db.commit()
    db.refresh(server)

    return server


@router.delete("/{server_id}")
async def delete_server(
    server_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a server (admin only)."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serveur non trouvé"
        )

    db.delete(server)
    db.commit()

    return {"message": "Serveur supprimé"}


@router.post("/{server_id}/test", response_model=ServerTestResult)
async def test_server(
    server_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Test SSH connection to a server (admin only)."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serveur non trouvé"
        )

    result = await test_ssh_connection(server)

    # Update server status
    server.is_online = result.success
    server.last_check = datetime.utcnow()
    server.last_error = result.message if not result.success else None
    if result.success and result.has_docker is not None:
        server.has_docker = result.has_docker
    db.commit()

    return result


@router.get("/{server_id}/containers")
async def list_server_containers(
    server_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List Docker containers on a server (admin only)."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serveur non trouvé"
        )

    if not server.has_docker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce serveur n'a pas Docker installé"
        )

    try:
        connect_kwargs = {
            "host": server.host,
            "port": server.ssh_port,
            "username": server.ssh_user,
            "known_hosts": None,
            "connect_timeout": 10,
        }

        if server.ssh_key:
            key_data = server.ssh_key
            if not key_data.startswith("-----"):
                import os
                expanded_path = os.path.expanduser(key_data)
                if os.path.exists(expanded_path):
                    with open(expanded_path, "r") as f:
                        key_data = f.read()
            connect_kwargs["client_keys"] = [asyncssh.import_private_key(key_data)]
        elif server.ssh_password:
            connect_kwargs["password"] = server.ssh_password

        async with asyncssh.connect(**connect_kwargs) as conn:
            result = await conn.run(
                "docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}'",
                check=False
            )

            if result.exit_status != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Erreur lors de la récupération des containers"
                )

            containers = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    parts = line.split("|")
                    if len(parts) >= 5:
                        containers.append({
                            "id": parts[0],
                            "name": parts[1],
                            "image": parts[2],
                            "status": parts[3],
                            "state": parts[4],
                        })

            return {
                "success": True,
                "server": server.name,
                "containers": containers,
                "count": len(containers),
            }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de connexion: {str(e)}"
        )
