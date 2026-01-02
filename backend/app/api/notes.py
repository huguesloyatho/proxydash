"""
Notes API endpoints for the Notes/Memo widget.
Supports both local notes and Nextcloud Notes integration.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.widget import Widget
from app.models.note import Note
from app.services.notes_service import NotesService, NextcloudNotesService

router = APIRouter(prefix="/notes", tags=["notes"])


# ============ Pydantic Schemas ============

class NoteBase(BaseModel):
    title: str
    content: str = ""
    color: Optional[str] = None
    is_pinned: bool = False


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    position: Optional[int] = None


class NoteResponse(BaseModel):
    id: int
    widget_id: int
    title: str
    content: str
    color: Optional[str]
    is_pinned: bool
    is_archived: bool
    position: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotesCountResponse(BaseModel):
    total: int
    archived: int
    active: int
    pinned: int


class ReorderRequest(BaseModel):
    note_ids: List[int]


# Nextcloud schemas
class NextcloudTestRequest(BaseModel):
    nextcloud_url: str
    username: str
    password: str


class NextcloudTestResponse(BaseModel):
    success: bool
    notes_count: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None


class NextcloudNoteResponse(BaseModel):
    id: int
    title: str
    content: str
    category: Optional[str] = None
    favorite: bool = False
    modified: Optional[int] = None
    readonly: bool = False


class NextcloudNoteCreate(BaseModel):
    title: str
    content: str = ""
    category: Optional[str] = None


class NextcloudNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    favorite: Optional[bool] = None


# ============ Local Notes Endpoints ============

@router.get("/widget/{widget_id}", response_model=List[NoteResponse])
async def get_notes(
    widget_id: int,
    include_archived: bool = Query(False),
    pinned_first: bool = Query(True),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all notes for a widget."""
    # Verify widget exists
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    notes = NotesService.get_notes(
        db=db,
        widget_id=widget_id,
        include_archived=include_archived,
        pinned_first=pinned_first,
        limit=limit,
        offset=offset
    )
    return notes


@router.get("/widget/{widget_id}/count", response_model=NotesCountResponse)
async def get_notes_count(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get note counts for a widget."""
    return NotesService.get_note_count(db, widget_id)


@router.post("/widget/{widget_id}", response_model=NoteResponse)
async def create_note(
    widget_id: int,
    note: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new note."""
    # Verify widget exists and is a notes widget
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    if widget.widget_type != "notes":
        raise HTTPException(status_code=400, detail="Widget is not a notes widget")

    return NotesService.create_note(
        db=db,
        widget_id=widget_id,
        title=note.title,
        content=note.content,
        color=note.color,
        is_pinned=note.is_pinned
    )


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific note."""
    note = NotesService.get_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_update: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a note."""
    note = NotesService.update_note(
        db=db,
        note_id=note_id,
        title=note_update.title,
        content=note_update.content,
        color=note_update.color,
        is_pinned=note_update.is_pinned,
        is_archived=note_update.is_archived,
        position=note_update.position
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.delete("/{note_id}")
async def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a note."""
    success = NotesService.delete_note(db, note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "note_id": note_id}


@router.post("/widget/{widget_id}/reorder")
async def reorder_notes(
    widget_id: int,
    request: ReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reorder notes by providing an ordered list of note IDs."""
    success = NotesService.reorder_notes(db, widget_id, request.note_ids)
    return {"success": success}


@router.post("/{note_id}/pin")
async def toggle_pin(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle the pinned status of a note."""
    note = NotesService.get_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    updated = NotesService.update_note(db, note_id, is_pinned=not note.is_pinned)
    return {"success": True, "is_pinned": updated.is_pinned}


@router.post("/{note_id}/archive")
async def toggle_archive(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle the archived status of a note."""
    note = NotesService.get_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    updated = NotesService.update_note(db, note_id, is_archived=not note.is_archived)
    return {"success": True, "is_archived": updated.is_archived}


# ============ Widget Data Endpoint ============

@router.get("/widget/{widget_id}/data")
async def get_widget_data(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notes widget data.
    Returns local notes or Nextcloud notes based on widget config.
    """
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    if widget.widget_type != "notes":
        raise HTTPException(status_code=400, detail="Widget is not a notes widget")

    config = widget.config or {}
    source = config.get("source", "local")

    if source == "nextcloud":
        # Fetch from Nextcloud
        nextcloud_url = config.get("nextcloud_url")
        username = config.get("nextcloud_username")
        password = config.get("nextcloud_password")
        category = config.get("nextcloud_category")

        if not all([nextcloud_url, username, password]):
            return {
                "widget_id": widget_id,
                "widget_type": "notes",
                "source": "nextcloud",
                "data": {
                    "notes": [],
                    "error": "Nextcloud configuration incomplete"
                }
            }

        result = await NextcloudNotesService.get_notes(
            nextcloud_url=nextcloud_url,
            username=username,
            password=password,
            category=category if category else None
        )

        return {
            "widget_id": widget_id,
            "widget_type": "notes",
            "source": "nextcloud",
            "data": {
                "notes": result.get("notes", []),
                "error": result.get("error")
            }
        }
    else:
        # Fetch local notes
        include_archived = config.get("show_archived", False)
        pinned_first = config.get("show_pinned_first", True)
        max_display = config.get("max_notes_display", 50)

        notes = NotesService.get_notes(
            db=db,
            widget_id=widget_id,
            include_archived=include_archived,
            pinned_first=pinned_first,
            limit=max_display
        )
        counts = NotesService.get_note_count(db, widget_id)

        return {
            "widget_id": widget_id,
            "widget_type": "notes",
            "source": "local",
            "data": {
                "notes": [
                    {
                        "id": n.id,
                        "title": n.title,
                        "content": n.content,
                        "color": n.color,
                        "is_pinned": n.is_pinned,
                        "is_archived": n.is_archived,
                        "position": n.position,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                        "updated_at": n.updated_at.isoformat() if n.updated_at else None
                    }
                    for n in notes
                ],
                "counts": counts
            }
        }


# ============ Nextcloud Notes Endpoints ============

@router.post("/nextcloud/test", response_model=NextcloudTestResponse)
async def test_nextcloud_connection(
    request: NextcloudTestRequest,
    current_user: User = Depends(get_current_user)
):
    """Test connection to Nextcloud Notes API."""
    result = await NextcloudNotesService.test_connection(
        nextcloud_url=request.nextcloud_url,
        username=request.username,
        password=request.password
    )
    return NextcloudTestResponse(**result)


@router.get("/nextcloud/widget/{widget_id}", response_model=List[NextcloudNoteResponse])
async def get_nextcloud_notes(
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notes from Nextcloud for a widget."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    config = widget.config or {}
    nextcloud_url = config.get("nextcloud_url")
    username = config.get("nextcloud_username")
    password = config.get("nextcloud_password")
    category = config.get("nextcloud_category")

    if not all([nextcloud_url, username, password]):
        raise HTTPException(status_code=400, detail="Nextcloud configuration incomplete")

    result = await NextcloudNotesService.get_notes(
        nextcloud_url=nextcloud_url,
        username=username,
        password=password,
        category=category if category else None
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to fetch notes"))

    return [NextcloudNoteResponse(**note) for note in result["notes"]]


@router.post("/nextcloud/widget/{widget_id}", response_model=NextcloudNoteResponse)
async def create_nextcloud_note(
    widget_id: int,
    note: NextcloudNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new note in Nextcloud."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    config = widget.config or {}
    nextcloud_url = config.get("nextcloud_url")
    username = config.get("nextcloud_username")
    password = config.get("nextcloud_password")

    if not all([nextcloud_url, username, password]):
        raise HTTPException(status_code=400, detail="Nextcloud configuration incomplete")

    result = await NextcloudNotesService.create_note(
        nextcloud_url=nextcloud_url,
        username=username,
        password=password,
        title=note.title,
        content=note.content,
        category=note.category
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to create note"))

    return NextcloudNoteResponse(**result["note"])


@router.put("/nextcloud/widget/{widget_id}/{note_id}", response_model=NextcloudNoteResponse)
async def update_nextcloud_note(
    widget_id: int,
    note_id: int,
    note: NextcloudNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a note in Nextcloud."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    config = widget.config or {}
    nextcloud_url = config.get("nextcloud_url")
    username = config.get("nextcloud_username")
    password = config.get("nextcloud_password")

    if not all([nextcloud_url, username, password]):
        raise HTTPException(status_code=400, detail="Nextcloud configuration incomplete")

    result = await NextcloudNotesService.update_note(
        nextcloud_url=nextcloud_url,
        username=username,
        password=password,
        note_id=note_id,
        title=note.title,
        content=note.content,
        category=note.category,
        favorite=note.favorite
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to update note"))

    return NextcloudNoteResponse(**result["note"])


@router.delete("/nextcloud/widget/{widget_id}/{note_id}")
async def delete_nextcloud_note(
    widget_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a note from Nextcloud."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    config = widget.config or {}
    nextcloud_url = config.get("nextcloud_url")
    username = config.get("nextcloud_username")
    password = config.get("nextcloud_password")

    if not all([nextcloud_url, username, password]):
        raise HTTPException(status_code=400, detail="Nextcloud configuration incomplete")

    result = await NextcloudNotesService.delete_note(
        nextcloud_url=nextcloud_url,
        username=username,
        password=password,
        note_id=note_id
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to delete note"))

    return {"success": True, "note_id": note_id}
