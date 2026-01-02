from pydantic import BaseModel
from typing import Optional


class CategoryBase(BaseModel):
    slug: str
    name: str
    icon: str
    order: int = 0
    is_public: bool = False


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    is_public: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: int

    class Config:
        from_attributes = True
