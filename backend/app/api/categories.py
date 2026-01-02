"""
Categories API routes.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Category, Application
from app.schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from app.api.deps import get_current_user, get_current_admin_user
from app.models import User

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all categories ordered by display order."""
    categories = db.query(Category).order_by(Category.order, Category.name).all()
    return categories


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific category by ID."""
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    return category


@router.post("", response_model=CategoryResponse)
async def create_category(
    cat_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new category."""
    # Check if slug already exists
    if db.query(Category).filter(Category.slug == cat_data.slug).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une catégorie avec ce slug existe déjà"
        )

    category = Category(**cat_data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    cat_data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a category."""
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    update_data = cat_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a category (applications will be moved to 'other')."""
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    # Get 'other' category
    other_category = db.query(Category).filter(Category.slug == "other").first()

    if category.slug == "other":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer la catégorie 'Autres'"
        )

    # Move applications to 'other'
    if other_category:
        db.query(Application).filter(
            Application.category_id == category_id
        ).update({"category_id": other_category.id})

    db.delete(category)
    db.commit()

    return {"message": "Catégorie supprimée"}


@router.get("/{category_id}/applications", response_model=List)
async def get_category_applications(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all applications in a category."""
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    applications = db.query(Application).filter(
        Application.category_id == category_id,
        Application.is_visible == True
    ).order_by(Application.display_order, Application.name).all()

    return applications
