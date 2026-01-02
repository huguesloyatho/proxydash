"""
Tabs API routes.

Tab visibility rules:
- Default tabs (tab_type='default'): visible to all users
- Custom tabs with owner_id=None: system tabs, visible to all (legacy)
- Custom tabs with owner_id: visible to owner only
- Shared tabs (is_public=True): visible to users who subscribed to them
- Admin users can see and manage all tabs
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
import re

from app.core.database import get_db
from app.models import Tab, User, TabSubscription
from app.schemas import TabCreate, TabUpdate, TabResponse, TabWithOwner
from app.api.deps import get_current_user, get_current_admin_user

router = APIRouter(prefix="/tabs", tags=["Tabs"])


def slugify(text: str) -> str:
    """Convert text to slug."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')


def ensure_default_tab(db: Session) -> Tab:
    """Ensure a default tab exists and return it."""
    default_tab = db.query(Tab).filter(Tab.tab_type == "default").first()
    if not default_tab:
        default_tab = Tab(
            name="Dashboard",
            slug="dashboard",
            icon="mdi:home",
            position=0,
            tab_type="default",
            is_visible=True,
            owner_id=None,
            is_public=True
        )
        db.add(default_tab)
        db.commit()
        db.refresh(default_tab)
    return default_tab


def ensure_infrastructure_tab(db: Session) -> Tab:
    """Ensure an infrastructure tab exists and return it."""
    infra_tab = db.query(Tab).filter(Tab.tab_type == "infrastructure").first()
    if not infra_tab:
        # Get max position
        max_pos = db.query(Tab).order_by(Tab.position.desc()).first()
        position = (max_pos.position + 1) if max_pos else 1

        infra_tab = Tab(
            name="Infrastructure",
            slug="infrastructure",
            icon="mdi:network",
            position=position,
            tab_type="infrastructure",
            is_visible=True,
            owner_id=None,
            is_public=True
        )
        db.add(infra_tab)
        db.commit()
        db.refresh(infra_tab)
    return infra_tab


def ensure_chat_tab(db: Session) -> Tab:
    """Ensure a chat tab exists and return it."""
    chat_tab = db.query(Tab).filter(Tab.tab_type == "chat").first()
    if not chat_tab:
        # Get max position
        max_pos = db.query(Tab).order_by(Tab.position.desc()).first()
        position = (max_pos.position + 1) if max_pos else 2

        chat_tab = Tab(
            name="Assistant",
            slug="assistant",
            icon="mdi:robot",
            position=position,
            tab_type="chat",
            is_visible=True,
            owner_id=None,
            is_public=True
        )
        db.add(chat_tab)
        db.commit()
        db.refresh(chat_tab)
    return chat_tab


def can_user_view_tab(tab: Tab, user: User, db: Session) -> bool:
    """Check if user can view a tab."""
    # Admin can see all
    if user.is_admin:
        return True
    # Default tabs are visible to all
    if tab.tab_type == "default":
        return True
    # System tabs (no owner) are visible to all
    if tab.owner_id is None:
        return True
    # User's own tabs
    if tab.owner_id == user.id:
        return True
    # Check if user is subscribed to this public tab
    if tab.is_public:
        subscription = db.query(TabSubscription).filter(
            TabSubscription.user_id == user.id,
            TabSubscription.tab_id == tab.id
        ).first()
        if subscription:
            return True
    return False


def can_user_edit_tab(tab: Tab, user: User) -> bool:
    """Check if user can edit a tab."""
    # Admin can edit all
    if user.is_admin:
        return True
    # User can edit their own tabs
    if tab.owner_id == user.id:
        return True
    return False


def get_user_subscribed_tab_ids(db: Session, user_id: int) -> List[int]:
    """Get list of tab IDs the user is subscribed to."""
    subscriptions = db.query(TabSubscription.tab_id).filter(
        TabSubscription.user_id == user_id
    ).all()
    return [s.tab_id for s in subscriptions]


# =============================================================================
# STATIC ROUTES (must be defined BEFORE dynamic routes like /{tab_id})
# =============================================================================

@router.get("", response_model=List[TabResponse])
async def list_tabs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List visible tabs for the current user.
    Returns: default tabs + infrastructure tab + chat tab + user's own tabs + subscribed shared tabs
    """
    # Ensure system tabs exist first
    ensure_default_tab(db)
    ensure_infrastructure_tab(db)
    ensure_chat_tab(db)

    # Get subscribed tab IDs
    subscribed_ids = get_user_subscribed_tab_ids(db, current_user.id)

    # Build query for visible tabs (system tabs + user tabs + subscribed tabs)
    if subscribed_ids:
        tabs = db.query(Tab).filter(
            Tab.is_visible == True,
            or_(
                Tab.tab_type.in_(["default", "infrastructure", "chat"]),
                Tab.owner_id == None,
                Tab.owner_id == current_user.id,
                Tab.id.in_(subscribed_ids)
            )
        ).order_by(Tab.position).all()
    else:
        tabs = db.query(Tab).filter(
            Tab.is_visible == True,
            or_(
                Tab.tab_type.in_(["default", "infrastructure", "chat"]),
                Tab.owner_id == None,
                Tab.owner_id == current_user.id
            )
        ).order_by(Tab.position).all()

    return tabs


@router.get("/all", response_model=List[TabResponse])
async def list_all_tabs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all tabs including hidden ones.
    Admin: sees all tabs
    Regular user: sees their own tabs + subscribed tabs + default tabs
    """
    if current_user.is_admin:
        tabs = db.query(Tab).order_by(Tab.position).all()
    else:
        subscribed_ids = get_user_subscribed_tab_ids(db, current_user.id)
        if subscribed_ids:
            tabs = db.query(Tab).filter(
                or_(
                    Tab.tab_type == "default",
                    Tab.owner_id == None,
                    Tab.owner_id == current_user.id,
                    Tab.id.in_(subscribed_ids)
                )
            ).order_by(Tab.position).all()
        else:
            tabs = db.query(Tab).filter(
                or_(
                    Tab.tab_type == "default",
                    Tab.owner_id == None,
                    Tab.owner_id == current_user.id
                )
            ).order_by(Tab.position).all()

    # If no tabs exist, create default tab
    if not tabs:
        default_tab = ensure_default_tab(db)
        tabs = [default_tab]

    return tabs


@router.get("/shared", response_model=List[TabWithOwner])
async def list_shared_tabs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all public/shared tabs available for subscription.
    Excludes user's own tabs and tabs they're already subscribed to.
    """
    # Get tabs user is already subscribed to
    subscribed_ids = get_user_subscribed_tab_ids(db, current_user.id)

    # Get public tabs from other users that the user hasn't subscribed to
    if subscribed_ids:
        tabs = db.query(Tab).filter(
            Tab.is_visible == True,
            Tab.is_public == True,
            Tab.owner_id != None,
            Tab.owner_id != current_user.id,
            ~Tab.id.in_(subscribed_ids)
        ).order_by(Tab.position).all()
    else:
        tabs = db.query(Tab).filter(
            Tab.is_visible == True,
            Tab.is_public == True,
            Tab.owner_id != None,
            Tab.owner_id != current_user.id
        ).order_by(Tab.position).all()

    # Add owner info to response
    result = []
    for tab in tabs:
        # Convert to dict first to avoid Pydantic validation issues with SQLAlchemy relationships
        tab_data = {
            "id": tab.id,
            "name": tab.name,
            "slug": tab.slug,
            "icon": tab.icon,
            "position": tab.position,
            "tab_type": tab.tab_type,
            "content": tab.content,
            "is_visible": tab.is_visible,
            "is_public": tab.is_public,
            "owner_id": tab.owner_id,
            "created_at": tab.created_at,
            "updated_at": tab.updated_at,
            "owner": {"id": tab.owner.id, "username": tab.owner.username} if tab.owner else None
        }
        result.append(TabWithOwner.model_validate(tab_data))

    return result


@router.get("/subscriptions", response_model=List[TabWithOwner])
async def list_subscribed_tabs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List tabs the current user is subscribed to.
    """
    subscriptions = db.query(TabSubscription).filter(
        TabSubscription.user_id == current_user.id
    ).all()

    result = []
    for sub in subscriptions:
        tab = sub.tab
        if tab and tab.is_visible:
            # Convert to dict first to avoid Pydantic validation issues with SQLAlchemy relationships
            tab_data = {
                "id": tab.id,
                "name": tab.name,
                "slug": tab.slug,
                "icon": tab.icon,
                "position": tab.position,
                "tab_type": tab.tab_type,
                "content": tab.content,
                "is_visible": tab.is_visible,
                "is_public": tab.is_public,
                "owner_id": tab.owner_id,
                "created_at": tab.created_at,
                "updated_at": tab.updated_at,
                "owner": {"id": tab.owner.id, "username": tab.owner.username} if tab.owner else None
            }
            result.append(TabWithOwner.model_validate(tab_data))

    return result


@router.post("/reorder")
async def reorder_tabs(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reorder tabs by updating their positions.
    Users can only reorder their own tabs and tabs they can view.
    """
    tab_ids = data.get("tab_ids", [])

    if not tab_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liste d'IDs requise"
        )

    for index, tab_id in enumerate(tab_ids):
        tab = db.query(Tab).filter(Tab.id == tab_id).first()
        if tab and can_user_view_tab(tab, current_user, db):
            tab.position = index

    db.commit()

    return {"message": "Ordre des onglets mis à jour"}


@router.get("/slug/{slug}", response_model=TabResponse)
async def get_tab_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific tab by slug."""
    tab = db.query(Tab).filter(Tab.slug == slug).first()

    if not tab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onglet non trouvé"
        )

    # Check visibility
    if not can_user_view_tab(tab, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cet onglet"
        )

    return tab


@router.post("", response_model=TabResponse)
async def create_tab(
    tab_data: TabCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new tab.
    Any authenticated user can create tabs (they become the owner).
    """
    # Generate slug if not provided - include user id to avoid conflicts
    base_slug = tab_data.slug or slugify(tab_data.name)
    slug = f"{base_slug}-{current_user.id}" if not current_user.is_admin else base_slug

    # Check if slug exists
    existing = db.query(Tab).filter(Tab.slug == slug).first()
    if existing:
        # Add timestamp to make unique
        import time
        slug = f"{base_slug}-{current_user.id}-{int(time.time())}"

    # Get max position for user's tabs
    max_pos = db.query(Tab).order_by(Tab.position.desc()).first()
    position = (max_pos.position + 1) if max_pos else 0

    tab = Tab(
        name=tab_data.name,
        slug=slug,
        icon=tab_data.icon,
        position=tab_data.position if tab_data.position is not None else position,
        tab_type=tab_data.tab_type,
        content=tab_data.content,
        is_visible=tab_data.is_visible,
        owner_id=current_user.id,  # Set current user as owner
        is_public=tab_data.is_public if hasattr(tab_data, 'is_public') else False
    )
    db.add(tab)
    db.commit()
    db.refresh(tab)
    return tab


# =============================================================================
# DYNAMIC ROUTES (must be defined AFTER static routes)
# =============================================================================

@router.get("/{tab_id}", response_model=TabResponse)
async def get_tab(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific tab by ID."""
    tab = db.query(Tab).filter(Tab.id == tab_id).first()

    if not tab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onglet non trouvé"
        )

    # Check visibility
    if not can_user_view_tab(tab, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cet onglet"
        )

    return tab


@router.patch("/{tab_id}", response_model=TabResponse)
async def update_tab(
    tab_id: int,
    tab_data: TabUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a tab.
    Users can update their own tabs, admins can update any tab.
    """
    tab = db.query(Tab).filter(Tab.id == tab_id).first()

    if not tab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onglet non trouvé"
        )

    # Check edit permission
    if not can_user_edit_tab(tab, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas la permission de modifier cet onglet"
        )

    # Prevent modifying system tabs' content
    if tab.tab_type in ["default", "infrastructure", "chat"] and tab_data.content is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de modifier le contenu des onglets système"
        )

    update_data = tab_data.model_dump(exclude_unset=True)

    # Non-admin users cannot change owner_id
    if not current_user.is_admin and "owner_id" in update_data:
        del update_data["owner_id"]

    # Check slug uniqueness if changing
    if "slug" in update_data and update_data["slug"] != tab.slug:
        existing = db.query(Tab).filter(Tab.slug == update_data["slug"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un onglet avec ce slug existe déjà"
            )

    for field, value in update_data.items():
        setattr(tab, field, value)

    db.commit()
    db.refresh(tab)
    return tab


@router.delete("/{tab_id}")
async def delete_tab(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a tab.
    Users can delete their own tabs, admins can delete any tab (except default).
    """
    tab = db.query(Tab).filter(Tab.id == tab_id).first()

    if not tab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onglet non trouvé"
        )

    # Check edit permission
    if not can_user_edit_tab(tab, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas la permission de supprimer cet onglet"
        )

    # Prevent deleting system tabs (default, infrastructure, chat)
    if tab.tab_type in ["default", "infrastructure", "chat"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer cet onglet système"
        )

    # Delete all subscriptions to this tab
    db.query(TabSubscription).filter(TabSubscription.tab_id == tab_id).delete()

    db.delete(tab)
    db.commit()

    return {"message": "Onglet supprimé"}


@router.post("/{tab_id}/subscribe")
async def subscribe_to_tab(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Subscribe to a shared tab.
    """
    tab = db.query(Tab).filter(Tab.id == tab_id).first()

    if not tab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onglet non trouvé"
        )

    # Cannot subscribe to own tab
    if tab.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas vous abonner à votre propre onglet"
        )

    # Tab must be public
    if not tab.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cet onglet n'est pas partagé"
        )

    # Check if already subscribed
    existing = db.query(TabSubscription).filter(
        TabSubscription.user_id == current_user.id,
        TabSubscription.tab_id == tab_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous êtes déjà abonné à cet onglet"
        )

    # Create subscription
    subscription = TabSubscription(
        user_id=current_user.id,
        tab_id=tab_id
    )
    db.add(subscription)
    db.commit()

    return {"message": "Abonnement réussi", "tab_id": tab_id}


@router.delete("/{tab_id}/subscribe")
async def unsubscribe_from_tab(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unsubscribe from a shared tab.
    """
    subscription = db.query(TabSubscription).filter(
        TabSubscription.user_id == current_user.id,
        TabSubscription.tab_id == tab_id
    ).first()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vous n'êtes pas abonné à cet onglet"
        )

    db.delete(subscription)
    db.commit()

    return {"message": "Désabonnement réussi", "tab_id": tab_id}


@router.patch("/{tab_id}/toggle-public", response_model=TabResponse)
async def toggle_tab_public(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle the public/private status of a tab.
    Only the owner or admin can toggle this.
    When making private, all subscriptions are removed.
    """
    tab = db.query(Tab).filter(Tab.id == tab_id).first()

    if not tab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onglet non trouvé"
        )

    # Check edit permission
    if not can_user_edit_tab(tab, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas la permission de modifier cet onglet"
        )

    # Cannot change system tabs' public status
    if tab.tab_type in ["default", "infrastructure", "chat"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de modifier les onglets système"
        )

    tab.is_public = not tab.is_public

    # If making private, remove all subscriptions
    if not tab.is_public:
        db.query(TabSubscription).filter(TabSubscription.tab_id == tab_id).delete()

    db.commit()
    db.refresh(tab)

    return tab
