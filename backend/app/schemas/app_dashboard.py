"""
Schemas for App Dashboard feature.
"""

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Union
from datetime import datetime


# ============== Block Position ==============

class BlockPosition(BaseModel):
    """Position and size of a block in the grid."""
    x: int = 0
    y: int = 0
    w: int = 6  # Width in grid units (12 columns total)
    h: int = 4  # Height in grid units


# ============== Block Actions ==============

class ActionInput(BaseModel):
    """Input field for an action button."""
    id: str
    label: str
    type: str = "text"  # text, select, number, password
    required: bool = False
    default: Optional[str] = None
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # For select type


class RowAction(BaseModel):
    """Action that can be performed on a table row."""
    id: str
    label: str
    icon: Optional[str] = None
    color: Optional[str] = None
    command: str  # Command template with {{row.field}} placeholders
    confirm: bool = False
    confirm_message: Optional[str] = None


class ActionButton(BaseModel):
    """Action button with optional inputs."""
    id: str
    label: str
    icon: Optional[str] = None
    color: Optional[str] = None
    command: str
    inputs: Optional[List[ActionInput]] = None
    confirm: bool = False
    confirm_message: Optional[str] = None


# ============== Block Configurations ==============

class TableColumn(BaseModel):
    """Column definition for table block."""
    key: str
    label: str
    width: Optional[str] = None
    format: Optional[str] = None  # datetime, number, boolean, etc.


class HighlightPattern(BaseModel):
    """Pattern for highlighting log lines."""
    pattern: str
    color: str
    bold: bool = False


class CounterConfig(BaseModel):
    """Configuration for counter block."""
    command: str
    parser: str = "number"
    icon: Optional[str] = None
    color: Optional[str] = None
    suffix: Optional[str] = None
    prefix: Optional[str] = None
    refresh_interval: int = 30


class TableConfig(BaseModel):
    """Configuration for table block."""
    command: str
    parser: str = "json"
    columns: List[TableColumn]
    refresh_interval: int = 30
    row_actions: Optional[List[RowAction]] = None
    sortable: bool = True
    filterable: bool = True


class ChartConfig(BaseModel):
    """Configuration for chart block."""
    command: str
    parser: str = "json"
    chart_type: str = "line"  # line, bar, pie, doughnut, area
    x_key: Optional[str] = None
    y_key: Optional[str] = None
    label_key: Optional[str] = None
    value_key: Optional[str] = None
    color: Optional[str] = None
    refresh_interval: int = 60


class LogsConfig(BaseModel):
    """Configuration for logs block."""
    command: str
    refresh_interval: int = 10
    max_lines: int = 100
    highlight_patterns: Optional[List[HighlightPattern]] = None
    follow: bool = True


class ActionsConfig(BaseModel):
    """Configuration for actions block."""
    buttons: List[ActionButton]


# ============== Dashboard Block ==============

class DashboardBlock(BaseModel):
    """A block in the dashboard grid."""
    id: str
    type: str  # counter, table, chart, logs, actions
    title: str
    position: BlockPosition
    config: Dict[str, Any]  # Type-specific config


# ============== App Template Schemas ==============

class ConfigSchemaField(BaseModel):
    """Schema field for template configuration."""
    type: str  # string, number, password, select
    label: str
    required: bool = False
    default: Optional[str] = None
    description: Optional[str] = None
    options: Optional[List[str]] = None  # For select type


class AppTemplateBase(BaseModel):
    """Base schema for app template."""
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    version: str = "1.0.0"
    author: Optional[str] = None
    config_schema: Dict[str, ConfigSchemaField] = {}
    blocks: List[DashboardBlock] = []
    is_public: bool = True


class AppTemplateCreate(AppTemplateBase):
    """Schema for creating a template."""
    pass


class AppTemplateUpdate(BaseModel):
    """Schema for updating a template."""
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    version: Optional[str] = None
    config_schema: Optional[Dict[str, Any]] = None
    blocks: Optional[List[DashboardBlock]] = None
    is_public: Optional[bool] = None


class AppTemplateResponse(AppTemplateBase):
    """Response schema for app template."""
    id: int
    is_builtin: bool = False
    is_community: bool = False
    downloads: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AppTemplateListItem(BaseModel):
    """Minimal template info for lists."""
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    version: str
    author: Optional[str] = None
    is_builtin: bool
    is_community: bool
    downloads: int

    class Config:
        from_attributes = True


# ============== Dashboard Content (stored in Tab.content) ==============

class AppDashboardContent(BaseModel):
    """Content structure for app_dashboard tabs."""
    template_id: Optional[int] = None
    template_slug: Optional[str] = None  # Alternative to ID
    server_id: int
    variables: Dict[str, str] = {}  # Template variables (container_name, etc.)
    blocks: Optional[List[DashboardBlock]] = None  # Custom blocks override
    layout: Optional[List[Dict[str, Any]]] = None  # Custom layout


# ============== Command Execution ==============

class ExecuteCommandRequest(BaseModel):
    """Request to execute a command."""
    server_id: int
    command: str
    variables: Dict[str, Any] = {}
    row: Optional[Dict[str, Any]] = None  # For row actions
    parser: str = "raw"


class ExecuteActionRequest(BaseModel):
    """Request to execute an action button."""
    server_id: int
    action: ActionButton
    variables: Dict[str, Any] = {}
    inputs: Dict[str, str] = {}  # User-provided input values


class CommandResultResponse(BaseModel):
    """Response from command execution."""
    success: bool
    output: Any = None
    error: Optional[str] = None
    execution_time: float = 0.0


# ============== Block Data Fetch ==============

class BlockDataRequest(BaseModel):
    """Request to fetch data for a block."""
    block: DashboardBlock
    server_id: int
    variables: Dict[str, str] = {}


class BlockDataResponse(BaseModel):
    """Response with block data."""
    block_id: str
    success: bool
    data: Any = None
    error: Optional[str] = None
    fetched_at: datetime = Field(default_factory=datetime.now)


# ============== Dashboard Creation ==============

class CreateAppDashboardTab(BaseModel):
    """Request to create an app dashboard tab."""
    name: str
    icon: Optional[str] = None
    template_id: Optional[int] = None
    template_slug: Optional[str] = None
    server_id: int
    variables: Dict[str, str] = {}


class UpdateAppDashboardTab(BaseModel):
    """Request to update an app dashboard tab."""
    name: Optional[str] = None
    icon: Optional[str] = None
    server_id: Optional[int] = None
    variables: Optional[Dict[str, str]] = None
    blocks: Optional[List[DashboardBlock]] = None
    layout: Optional[List[Dict[str, Any]]] = None
