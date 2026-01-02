from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class WidgetBase(BaseModel):
    widget_type: str
    title: Optional[str] = None
    position: int = 0
    column: int = 0
    size: str = "medium"
    col_span: int = 1  # Grid column span (1-4)
    row_span: int = 1  # Grid row span (1-4)
    config: Dict[str, Any] = {}
    is_visible: bool = True
    is_public: bool = False


class WidgetCreate(WidgetBase):
    pass


class WidgetUpdate(BaseModel):
    widget_type: Optional[str] = None
    title: Optional[str] = None
    position: Optional[int] = None
    column: Optional[int] = None
    size: Optional[str] = None
    col_span: Optional[int] = None
    row_span: Optional[int] = None
    config: Optional[Dict[str, Any]] = None
    is_visible: Optional[bool] = None
    is_public: Optional[bool] = None


class WidgetResponse(WidgetBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WidgetTypeConfigField(BaseModel):
    type: str
    default: Any
    label: str
    options: Optional[List[str]] = None


class WidgetTypeInfo(BaseModel):
    name: str
    description: str
    icon: str
    config_schema: Dict[str, WidgetTypeConfigField]


class WidgetDataResponse(BaseModel):
    """Response for widget data fetching"""
    widget_id: int
    widget_type: str
    data: Dict[str, Any]
    error: Optional[str] = None
    fetched_at: datetime
