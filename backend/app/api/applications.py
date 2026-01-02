"""
Applications API routes.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models import Application, Category
from app.schemas import (
    ApplicationCreate, ApplicationUpdate, ApplicationResponse, ApplicationWithCategory
)
from app.api.deps import get_current_user, get_current_admin_user
from app.services.npm_sync import sync_all_npm_instances
from app.services.http_fingerprint import fingerprint_url, get_icon_url as fingerprint_get_icon_url, get_online_database_stats
from app.services.app_detection import detect_application, get_icon_url, format_app_name
from app.models import User

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationWithCategory])
async def list_applications(
    category: Optional[str] = Query(None, description="Filter by category slug"),
    visible_only: bool = Query(True, description="Only show visible applications"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all applications, optionally filtered by category."""
    query = db.query(Application).options(joinedload(Application.category))

    if visible_only:
        query = query.filter(Application.is_visible == True)

    if category:
        query = query.join(Category).filter(Category.slug == category)

    applications = query.order_by(Application.display_order, Application.name).all()
    return applications


@router.get("/{app_id}", response_model=ApplicationWithCategory)
async def get_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific application by ID."""
    app = db.query(Application).options(
        joinedload(Application.category)
    ).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application non trouvée"
        )

    return app


@router.post("", response_model=ApplicationResponse)
async def create_application(
    app_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new manual application."""
    app = Application(
        name=app_data.name,
        url=app_data.url,
        icon=app_data.icon,
        description=app_data.description,
        category_id=app_data.category_id,
        is_visible=app_data.is_visible,
        is_manual=True,
        name_override=True,
        icon_override=True if app_data.icon else False,
        description_override=True if app_data.description else False,
        category_override=True if app_data.category_id else False,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: int,
    app_data: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update an application (sets override flags for modified fields)."""
    app = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application non trouvée"
        )

    update_data = app_data.model_dump(exclude_unset=True)

    # Set override flags for modified fields
    if "name" in update_data:
        app.name_override = True
    if "icon" in update_data:
        app.icon_override = True
    if "description" in update_data:
        app.description_override = True
    if "category_id" in update_data:
        app.category_override = True

    for field, value in update_data.items():
        setattr(app, field, value)

    db.commit()
    db.refresh(app)
    return app


@router.delete("/{app_id}")
async def delete_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete an application."""
    app = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application non trouvée"
        )

    db.delete(app)
    db.commit()

    return {"message": "Application supprimée"}


@router.post("/{app_id}/reset")
async def reset_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Reset an application's overrides to sync from NPM again."""
    app = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application non trouvée"
        )

    if app.is_manual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de réinitialiser une application manuelle"
        )

    app.name_override = False
    app.icon_override = False
    app.description_override = False
    app.category_override = False

    db.commit()

    return {"message": "Application réinitialisée, les données seront mises à jour à la prochaine synchronisation"}


@router.post("/sync")
async def trigger_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Manually trigger NPM synchronization from all configured instances."""
    stats = await sync_all_npm_instances(db, use_ollama=True)

    return {
        "message": "Synchronisation terminée",
        "stats": stats
    }


@router.post("/reorder")
async def reorder_applications(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Reorder applications by updating their display_order."""
    app_ids = data.get("app_ids", [])

    if not app_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liste d'IDs requise"
        )

    for index, app_id in enumerate(app_ids):
        app = db.query(Application).filter(Application.id == app_id).first()
        if app:
            app.display_order = index

    db.commit()

    return {"message": "Ordre des applications mis à jour"}


@router.post("/fingerprint")
async def test_fingerprint(
    data: dict,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Test HTTP fingerprinting for a URL.
    Useful for debugging detection issues.
    """
    url = data.get("url")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL requise"
        )

    # First try subdomain detection
    from urllib.parse import urlparse
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path

    subdomain_type, subdomain_icon, subdomain_category, subdomain_desc = detect_application(domain)

    # Then try HTTP fingerprinting
    fingerprint_result = await fingerprint_url(url)

    return {
        "url": url,
        "domain": domain,
        "subdomain_detection": {
            "detected_type": subdomain_type,
            "icon": subdomain_icon,
            "category": subdomain_category,
            "description": subdomain_desc,
        },
        "http_fingerprint": {
            "detected_type": fingerprint_result.app_type,
            "icon": fingerprint_result.icon,
            "category": fingerprint_result.category,
            "description": fingerprint_result.description,
            "confidence": fingerprint_result.confidence,
            "detection_method": fingerprint_result.detection_method,
        },
        "final_detection": {
            "type": subdomain_type or fingerprint_result.app_type,
            "icon": get_icon_url(subdomain_icon) if subdomain_icon else (
                fingerprint_get_icon_url(fingerprint_result.icon) if fingerprint_result.icon else None
            ),
            "category": subdomain_category or fingerprint_result.category,
            "description": subdomain_desc or fingerprint_result.description,
            "method": "subdomain" if subdomain_type else (
                "http_fingerprint" if fingerprint_result.app_type else "none"
            ),
        }
    }


@router.post("/{app_id}/redetect")
async def redetect_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Re-run detection for an application using both subdomain and HTTP fingerprinting.
    This will update the app's type, icon, category, and description if not overridden.
    """
    app = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application non trouvée"
        )

    # Extract domain from URL
    from urllib.parse import urlparse
    parsed = urlparse(app.url)
    domain = parsed.netloc or parsed.path

    # Try subdomain detection first
    detected_type, icon, category_slug, description = detect_application(domain)

    # If that failed, try HTTP fingerprinting
    detection_method = "subdomain" if detected_type else None
    if not detected_type:
        fingerprint_result = await fingerprint_url(app.url)
        if fingerprint_result.app_type and fingerprint_result.confidence >= 0.7:
            detected_type = fingerprint_result.app_type
            icon = fingerprint_result.icon
            category_slug = fingerprint_result.category
            description = fingerprint_result.description
            detection_method = f"http_fingerprint ({fingerprint_result.confidence:.0%})"

    if not detected_type:
        return {
            "message": "Aucune détection possible pour cette application",
            "app_id": app_id,
            "url": app.url,
            "domain": domain,
        }

    # Update application fields (respecting overrides)
    changes = []

    app.detected_type = detected_type
    changes.append(f"detected_type: {detected_type}")

    if not app.name_override:
        new_name = format_app_name(domain, detected_type)
        if app.name != new_name:
            app.name = new_name
            changes.append(f"name: {new_name}")

    if not app.icon_override and icon:
        new_icon = get_icon_url(icon)
        if app.icon != new_icon:
            app.icon = new_icon
            changes.append(f"icon: {icon}")

    if not app.category_override and category_slug:
        category = db.query(Category).filter(Category.slug == category_slug).first()
        if category and app.category_id != category.id:
            app.category_id = category.id
            changes.append(f"category: {category_slug}")

    if not app.description_override and description:
        if app.description != description:
            app.description = description
            changes.append(f"description updated")

    db.commit()
    db.refresh(app)

    return {
        "message": "Application re-détectée avec succès",
        "app_id": app_id,
        "detection_method": detection_method,
        "detected_type": detected_type,
        "changes": changes,
    }


@router.get("/detection/stats")
async def get_detection_stats(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get detection system statistics including local and online database info.
    """
    from app.services.http_fingerprint import ALL_FINGERPRINTS

    # Local database stats
    local_patterns = len(ALL_FINGERPRINTS)
    local_app_types = len(set(fp[2] for fp in ALL_FINGERPRINTS))

    # Online database stats
    online_stats = await get_online_database_stats()

    return {
        "local_database": {
            "patterns": local_patterns,
            "app_types": local_app_types,
        },
        "online_database": online_stats,
        "detection_methods": [
            "subdomain",
            "http_title",
            "http_meta_generator",
            "http_meta_application",
            "http_body",
            "http_header",
            "online_fallback"
        ]
    }


@router.post("/detection/search")
async def search_apps_online(
    data: dict,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Search for applications in the online database.
    Useful for finding apps that might not be in the local fingerprint database.
    """
    query = data.get("query", "")
    limit = data.get("limit", 10)

    if not query or len(query) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query trop courte (minimum 2 caractères)"
        )

    from app.services.online_app_lookup import search_apps_online as search_online

    results = await search_online(query, limit=limit)

    return {
        "query": query,
        "count": len(results),
        "results": [
            {
                "name": r.app_name,
                "description": r.description,
                "icon": r.icon,
                "icon_url": r.icon_url,
                "category": r.category,
                "source_url": r.source_url,
                "github_url": r.github_url,
                "license": r.license,
            }
            for r in results
        ]
    }


@router.post("/detection/refresh")
async def refresh_online_database(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Force refresh the online app database from awesome-selfhosted.
    """
    from app.services.online_app_lookup import refresh_online_database as refresh_db

    success = await refresh_db()

    if success:
        stats = await get_online_database_stats()
        return {
            "message": "Base de données en ligne mise à jour",
            "stats": stats
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Échec de la mise à jour de la base de données en ligne"
        )


@router.get("/detection/update-status")
async def get_update_status(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get the status of the auto-update system.
    Shows last check times, known apps count, and recent update history.
    """
    from app.services.database_updater import get_updater

    updater = get_updater()
    status = updater.get_update_status()

    return {
        "auto_update": {
            "enabled": True,
            "schedule": "Daily at 4:00 AM",
            "sources": [
                {"name": "selfh.st", "url": "https://selfh.st/rss"},
                {"name": "awesome-selfhosted", "url": "https://github.com/awesome-selfhosted/awesome-selfhosted/commits/master.atom"}
            ]
        },
        "status": status
    }


@router.post("/detection/check-updates")
async def check_for_updates(
    data: dict = None,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Manually check RSS feeds for new applications.
    Use dry_run=true to preview without modifying the database.
    """
    from app.services.database_updater import get_updater

    dry_run = data.get("dry_run", True) if data else True

    updater = get_updater()
    result = await updater.run_update(add_to_database=not dry_run)

    return {
        "dry_run": dry_run,
        "result": result
    }


@router.post("/detection/run-update")
async def run_manual_update(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Manually run the database update (same as nightly cron).
    This will check RSS feeds and add new apps to the fingerprint database.
    """
    from app.services.database_updater import run_nightly_update

    result = await run_nightly_update()

    return {
        "message": "Mise à jour de la base de données terminée",
        "result": result
    }


@router.post("/cleanup-duplicates")
async def cleanup_duplicates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Find and remove duplicate applications based on domain.
    Keeps the application with the highest priority NPM instance.
    """
    from urllib.parse import urlparse
    from sqlalchemy import func
    from app.models import NpmInstance

    # Get all non-manual applications
    apps = db.query(Application).filter(
        Application.is_manual == False
    ).all()

    # Group by domain
    domain_apps: dict = {}
    for app in apps:
        parsed = urlparse(app.url)
        domain = parsed.netloc.lower()
        if domain not in domain_apps:
            domain_apps[domain] = []
        domain_apps[domain].append(app)

    # Find duplicates and determine which to keep
    duplicates_removed = 0
    duplicates_info = []

    for domain, apps_list in domain_apps.items():
        if len(apps_list) > 1:
            # Sort by NPM instance priority (lower = better)
            # If same instance or no instance, sort by ID (keep oldest)
            def get_priority(app):
                if app.npm_instance_id:
                    instance = db.query(NpmInstance).filter(
                        NpmInstance.id == app.npm_instance_id
                    ).first()
                    if instance:
                        return (instance.priority, app.id)
                return (999, app.id)

            apps_list.sort(key=get_priority)

            # Keep the first one (highest priority), remove the rest
            keep = apps_list[0]
            remove = apps_list[1:]

            for app in remove:
                duplicates_info.append({
                    "domain": domain,
                    "removed_id": app.id,
                    "removed_name": app.name,
                    "kept_id": keep.id,
                    "kept_name": keep.name,
                })
                db.delete(app)
                duplicates_removed += 1

    db.commit()

    return {
        "message": f"{duplicates_removed} doublon(s) supprimé(s)",
        "duplicates_removed": duplicates_removed,
        "details": duplicates_info
    }
