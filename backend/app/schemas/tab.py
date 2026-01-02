from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class TabBase(BaseModel):
    name: str
    slug: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None
    tab_type: str = 'custom'
    content: Optional[dict] = None
    is_visible: bool = True
    is_public: bool = False


class TabCreate(TabBase):
    pass


class TabUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None
    content: Optional[dict] = None
    is_visible: Optional[bool] = None
    is_public: Optional[bool] = None


class TabResponse(TabBase):
    id: int
    owner_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TabOwnerInfo(BaseModel):
    """Minimal owner info for tab display."""
    id: int
    username: str


class TabWithOwner(TabResponse):
    """Tab response with owner information."""
    owner: Optional[TabOwnerInfo] = None
