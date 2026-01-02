"""
API endpoints for App Dashboard feature.
Manages app templates and executes commands for dashboard blocks.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_admin_user
from app.models import User, Tab, AppTemplate, BUILTIN_TEMPLATES
from app.schemas.app_dashboard import (
    AppTemplateResponse, AppTemplateListItem, AppTemplateCreate, AppTemplateUpdate,
    ExecuteCommandRequest, ExecuteActionRequest, CommandResultResponse,
    BlockDataRequest, BlockDataResponse, CreateAppDashboardTab, UpdateAppDashboardTab,
    AppDashboardContent, DashboardBlock
)
from app.services.command_executor import CommandExecutor, execute_dashboard_command

router = APIRouter(prefix="/app-dashboard", tags=["App Dashboard"])


# ============== Templates ==============

@router.get("/templates", response_model=List[AppTemplateListItem])
async def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all available app templates.
    Includes built-in and community templates.
    """
    # Ensure built-in templates exist in database
    await ensure_builtin_templates(db)

    templates = db.query(AppTemplate).filter(
        (AppTemplate.is_public == True) | (AppTemplate.is_builtin == True)
    ).all()

    return templates


@router.get("/templates/{template_id}", response_model=AppTemplateResponse)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific template by ID."""
    template = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("/templates/by-slug/{slug}", response_model=AppTemplateResponse)
async def get_template_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific template by slug."""
    template = db.query(AppTemplate).filter(AppTemplate.slug == slug).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates", response_model=AppTemplateResponse)
async def create_template(
    template_data: AppTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Create a new app template (admin only)."""
    # Check if slug exists
    existing = db.query(AppTemplate).filter(AppTemplate.slug == template_data.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Template with this slug already exists")

    template = AppTemplate(
        name=template_data.name,
        slug=template_data.slug,
        description=template_data.description,
        icon=template_data.icon,
        version=template_data.version,
        author=template_data.author or current_user.username,
        config_schema=template_data.config_schema,
        blocks=[block.model_dump() for block in template_data.blocks],
        is_public=template_data.is_public,
        is_builtin=False,
        is_community=True,
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return template


@router.put("/templates/{template_id}", response_model=AppTemplateResponse)
async def update_template(
    template_id: int,
    template_data: AppTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Update an app template (admin only)."""
    template = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if template.is_builtin:
        raise HTTPException(status_code=400, detail="Cannot modify built-in templates")

    update_data = template_data.model_dump(exclude_unset=True)
    if "blocks" in update_data and update_data["blocks"]:
        update_data["blocks"] = [b.model_dump() if hasattr(b, 'model_dump') else b for b in update_data["blocks"]]

    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)

    return template


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete an app template (admin only)."""
    template = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if template.is_builtin:
        raise HTTPException(status_code=400, detail="Cannot delete built-in templates")

    db.delete(template)
    db.commit()

    return {"message": "Template deleted"}


# ============== Command Execution ==============

@router.post("/execute", response_model=CommandResultResponse)
async def execute_command(
    request: ExecuteCommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute a command on a server.
    Used for fetching block data or executing row actions.
    """
    result = await execute_dashboard_command(
        db=db,
        server_id=request.server_id,
        command=request.command,
        variables=request.variables,
        parser=request.parser,
        row=request.row,
    )

    return CommandResultResponse(
        success=result.success,
        output=result.output,
        error=result.error,
        execution_time=result.execution_time,
    )


@router.post("/execute-action", response_model=CommandResultResponse)
async def execute_action(
    request: ExecuteActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute an action button command.
    Merges user inputs into the command variables.
    """
    # Merge inputs into variables
    variables = dict(request.variables)
    for key, value in request.inputs.items():
        variables[f"input.{key}"] = value

    # Build final command by replacing input placeholders
    command = request.action.command
    for key, value in request.inputs.items():
        command = command.replace(f"{{{{input.{key}}}}}", value)

    result = await execute_dashboard_command(
        db=db,
        server_id=request.server_id,
        command=command,
        variables=variables,
        parser="raw",
    )

    return CommandResultResponse(
        success=result.success,
        output=result.output,
        error=result.error,
        execution_time=result.execution_time,
    )


@router.post("/block-data", response_model=BlockDataResponse)
async def fetch_block_data(
    request: BlockDataRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch data for a specific dashboard block.
    Executes the block's command and returns parsed data.
    """
    from datetime import datetime

    block = request.block
    config = block.config

    command = config.get("command", "")
    parser = config.get("parser", "raw")

    if not command:
        return BlockDataResponse(
            block_id=block.id,
            success=False,
            error="Block has no command configured",
            fetched_at=datetime.now(),
        )

    result = await execute_dashboard_command(
        db=db,
        server_id=request.server_id,
        command=command,
        variables=request.variables,
        parser=parser,
    )

    return BlockDataResponse(
        block_id=block.id,
        success=result.success,
        data=result.output,
        error=result.error,
        fetched_at=datetime.now(),
    )


# ============== Dashboard Tabs ==============

@router.post("/tabs", response_model=dict)
async def create_app_dashboard_tab(
    request: CreateAppDashboardTab,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new app dashboard tab."""
    import re

    # Generate slug from name
    slug = re.sub(r'[^a-z0-9]+', '-', request.name.lower()).strip('-')

    # Ensure unique slug
    base_slug = slug
    counter = 1
    while db.query(Tab).filter(Tab.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Get template blocks if template specified
    blocks = []
    if request.template_id:
        template = db.query(AppTemplate).filter(AppTemplate.id == request.template_id).first()
        if template:
            blocks = template.blocks
    elif request.template_slug:
        template = db.query(AppTemplate).filter(AppTemplate.slug == request.template_slug).first()
        if template:
            blocks = template.blocks

    # Create tab content
    content = AppDashboardContent(
        template_id=request.template_id,
        template_slug=request.template_slug,
        server_id=request.server_id,
        variables=request.variables,
        blocks=blocks,
    ).model_dump()

    # Get next position
    max_pos = db.query(Tab).order_by(Tab.position.desc()).first()
    next_position = (max_pos.position + 1) if max_pos else 0

    # Create tab
    tab = Tab(
        name=request.name,
        slug=slug,
        icon=request.icon or "IconLayoutDashboard",
        position=next_position,
        tab_type="app_dashboard",
        content=content,
        owner_id=current_user.id,
        is_visible=True,
        is_public=False,
    )

    db.add(tab)
    db.commit()
    db.refresh(tab)

    return {
        "id": tab.id,
        "name": tab.name,
        "slug": tab.slug,
        "message": "App dashboard tab created successfully",
    }


@router.put("/tabs/{tab_id}", response_model=dict)
async def update_app_dashboard_tab(
    tab_id: int,
    request: UpdateAppDashboardTab,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an app dashboard tab's configuration."""
    tab = db.query(Tab).filter(Tab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    if tab.tab_type != "app_dashboard":
        raise HTTPException(status_code=400, detail="Tab is not an app dashboard")

    # Check ownership
    if tab.owner_id and tab.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify this tab")

    # Update basic fields
    if request.name:
        tab.name = request.name
    if request.icon:
        tab.icon = request.icon

    # Update content
    content = tab.content or {}
    if request.server_id is not None:
        content["server_id"] = request.server_id
    if request.variables is not None:
        content["variables"] = request.variables
    if request.blocks is not None:
        content["blocks"] = [b.model_dump() if hasattr(b, 'model_dump') else b for b in request.blocks]
    if request.layout is not None:
        content["layout"] = request.layout

    tab.content = content
    # Mark JSON field as modified so SQLAlchemy detects the change
    flag_modified(tab, "content")

    db.commit()
    db.refresh(tab)

    return {
        "id": tab.id,
        "name": tab.name,
        "message": "App dashboard updated successfully",
    }


@router.get("/tabs/{tab_id}/config", response_model=AppDashboardContent)
async def get_app_dashboard_config(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the configuration of an app dashboard tab."""
    # Ensure builtin templates are up to date
    await ensure_builtin_templates(db)

    tab = db.query(Tab).filter(Tab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    if tab.tab_type != "app_dashboard":
        raise HTTPException(status_code=400, detail="Tab is not an app dashboard")

    content = tab.content or {}

    # Always get blocks from template if available (to get latest version)
    template_id = content.get("template_id")
    template_slug = content.get("template_slug")

    if template_id:
        template = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
        if template:
            content["blocks"] = template.blocks
    elif template_slug:
        template = db.query(AppTemplate).filter(AppTemplate.slug == template_slug).first()
        if template:
            content["blocks"] = template.blocks

    # Apply saved layout to blocks if available
    saved_layout = content.get("layout")
    if saved_layout and content.get("blocks"):
        layout_map = {item["i"]: item for item in saved_layout}
        for block in content["blocks"]:
            if block["id"] in layout_map:
                layout_item = layout_map[block["id"]]
                block["position"] = {
                    "x": layout_item.get("x", block["position"]["x"]),
                    "y": layout_item.get("y", block["position"]["y"]),
                    "w": layout_item.get("w", block["position"]["w"]),
                    "h": layout_item.get("h", block["position"]["h"]),
                }

    return AppDashboardContent(**content)


@router.post("/tabs/{tab_id}/sync", response_model=dict)
async def sync_tab_from_template(
    tab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync a tab's blocks from its template (useful after template updates)."""
    # Ensure builtin templates are up to date
    await ensure_builtin_templates(db)

    tab = db.query(Tab).filter(Tab.id == tab_id).first()
    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    if tab.tab_type != "app_dashboard":
        raise HTTPException(status_code=400, detail="Tab is not an app dashboard")

    content = tab.content or {}
    template_id = content.get("template_id")
    template_slug = content.get("template_slug")

    template = None
    if template_id:
        template = db.query(AppTemplate).filter(AppTemplate.id == template_id).first()
    elif template_slug:
        template = db.query(AppTemplate).filter(AppTemplate.slug == template_slug).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found for this tab")

    # Update blocks from template
    content["blocks"] = template.blocks
    tab.content = content

    db.commit()

    return {
        "message": f"Tab synced with template {template.name} v{template.version}",
        "template_version": template.version,
    }


# ============== Helpers ==============

async def ensure_builtin_templates(db: Session):
    """Ensure built-in templates exist in the database and are up to date."""
    for template_data in BUILTIN_TEMPLATES:
        existing = db.query(AppTemplate).filter(
            AppTemplate.slug == template_data["slug"]
        ).first()

        if existing:
            # Update existing built-in template if version changed
            new_version = template_data.get("version", "1.0.0")
            if existing.version != new_version:
                existing.name = template_data["name"]
                existing.description = template_data.get("description", "")
                existing.icon = template_data.get("icon")
                existing.version = new_version
                existing.config_schema = template_data.get("config_schema", {})
                existing.blocks = template_data.get("blocks", [])
        else:
            template = AppTemplate(
                name=template_data["name"],
                slug=template_data["slug"],
                description=template_data.get("description", ""),
                icon=template_data.get("icon"),
                version=template_data.get("version", "1.0.0"),
                author=template_data.get("author", "System"),
                config_schema=template_data.get("config_schema", {}),
                blocks=template_data.get("blocks", []),
                is_builtin=True,
                is_public=True,
            )
            db.add(template)

    db.commit()
