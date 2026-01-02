from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ApplicationBase(BaseModel):
    name: str
    url: str
    icon: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    is_visible: bool = True
    is_public: bool = False
    is_authelia_protected: bool = False


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    is_visible: Optional[bool] = None
    is_public: Optional[bool] = None
    is_authelia_protected: Optional[bool] = None
    display_order: Optional[int] = None


class ApplicationResponse(ApplicationBase):
    id: int
    npm_proxy_id: Optional[int]
    detected_type: Optional[str]
    is_manual: bool
    display_order: int
    name_override: bool
    icon_override: bool
    description_override: bool
    category_override: bool
    created_at: datetime
    updated_at: Optional[datetime]
    last_synced_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApplicationWithCategory(ApplicationResponse):
    category: Optional["CategoryResponse"] = None


from app.schemas.category import CategoryResponse
ApplicationWithCategory.model_rebuild()
