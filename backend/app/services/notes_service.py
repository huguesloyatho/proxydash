"""
Notes service for managing local and Nextcloud notes.
"""

import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.models.note import Note, NextcloudNotesConfig


class NotesService:
    """Service for managing local notes stored in database."""

    @staticmethod
    def get_notes(
        db: Session,
        widget_id: int,
        include_archived: bool = False,
        pinned_first: bool = True,
        limit: int = 50,
        offset: int = 0
    ) -> List[Note]:
        """Get notes for a widget."""
        query = db.query(Note).filter(Note.widget_id == widget_id)

        if not include_archived:
            query = query.filter(Note.is_archived == False)

        if pinned_first:
            query = query.order_by(desc(Note.is_pinned), asc(Note.position), desc(Note.updated_at))
        else:
            query = query.order_by(asc(Note.position), desc(Note.updated_at))

        return query.offset(offset).limit(limit).all()

    @staticmethod
    def get_note(db: Session, note_id: int) -> Optional[Note]:
        """Get a specific note by ID."""
        return db.query(Note).filter(Note.id == note_id).first()

    @staticmethod
    def create_note(
        db: Session,
        widget_id: int,
        title: str,
        content: str = "",
        color: Optional[str] = None,
        is_pinned: bool = False
    ) -> Note:
        """Create a new note."""
        # Get the next position
        max_position = db.query(Note).filter(Note.widget_id == widget_id).count()

        note = Note(
            widget_id=widget_id,
            title=title,
            content=content,
            color=color,
            is_pinned=is_pinned,
            position=max_position
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note

    @staticmethod
    def update_note(
        db: Session,
        note_id: int,
        title: Optional[str] = None,
        content: Optional[str] = None,
        color: Optional[str] = None,
        is_pinned: Optional[bool] = None,
        is_archived: Optional[bool] = None,
        position: Optional[int] = None
    ) -> Optional[Note]:
        """Update an existing note."""
        note = db.query(Note).filter(Note.id == note_id).first()
        if not note:
            return None

        if title is not None:
            note.title = title
        if content is not None:
            note.content = content
        if color is not None:
            note.color = color
        if is_pinned is not None:
            note.is_pinned = is_pinned
        if is_archived is not None:
            note.is_archived = is_archived
        if position is not None:
            note.position = position

        db.commit()
        db.refresh(note)
        return note

    @staticmethod
    def delete_note(db: Session, note_id: int) -> bool:
        """Delete a note."""
        note = db.query(Note).filter(Note.id == note_id).first()
        if not note:
            return False

        db.delete(note)
        db.commit()
        return True

    @staticmethod
    def reorder_notes(db: Session, widget_id: int, note_ids: List[int]) -> bool:
        """Reorder notes by updating their positions."""
        for position, note_id in enumerate(note_ids):
            note = db.query(Note).filter(
                Note.id == note_id,
                Note.widget_id == widget_id
            ).first()
            if note:
                note.position = position

        db.commit()
        return True

    @staticmethod
    def get_note_count(db: Session, widget_id: int) -> Dict[str, int]:
        """Get note counts for a widget."""
        total = db.query(Note).filter(Note.widget_id == widget_id).count()
        archived = db.query(Note).filter(
            Note.widget_id == widget_id,
            Note.is_archived == True
        ).count()
        pinned = db.query(Note).filter(
            Note.widget_id == widget_id,
            Note.is_pinned == True,
            Note.is_archived == False
        ).count()

        return {
            "total": total,
            "archived": archived,
            "active": total - archived,
            "pinned": pinned
        }


class NextcloudNotesService:
    """Service for interacting with Nextcloud Notes API."""

    @staticmethod
    async def test_connection(
        nextcloud_url: str,
        username: str,
        password: str
    ) -> Dict[str, Any]:
        """Test connection to Nextcloud Notes API."""
        try:
            api_url = f"{nextcloud_url.rstrip('/')}/index.php/apps/notes/api/v1/notes"

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    api_url,
                    auth=(username, password),
                    headers={"OCS-APIRequest": "true"}
                )

                if response.status_code == 200:
                    notes = response.json()
                    return {
                        "success": True,
                        "notes_count": len(notes),
                        "message": f"Connection successful. Found {len(notes)} notes."
                    }
                elif response.status_code == 401:
                    return {
                        "success": False,
                        "error": "Authentication failed. Check your username and password."
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed with status {response.status_code}: {response.text}"
                    }

        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "Connection timeout. Check if the Nextcloud URL is correct."
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Connection error: {str(e)}"
            }

    @staticmethod
    async def get_notes(
        nextcloud_url: str,
        username: str,
        password: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch notes from Nextcloud."""
        try:
            api_url = f"{nextcloud_url.rstrip('/')}/index.php/apps/notes/api/v1/notes"

            params = {}
            if category:
                params["category"] = category

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    api_url,
                    auth=(username, password),
                    headers={"OCS-APIRequest": "true"},
                    params=params
                )

                if response.status_code == 200:
                    notes = response.json()
                    # Transform to our format
                    transformed = []
                    for note in notes:
                        transformed.append({
                            "id": note.get("id"),
                            "title": note.get("title", ""),
                            "content": note.get("content", ""),
                            "category": note.get("category", ""),
                            "favorite": note.get("favorite", False),
                            "modified": note.get("modified"),
                            "readonly": note.get("readonly", False),
                        })
                    return {
                        "success": True,
                        "notes": transformed
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed with status {response.status_code}",
                        "notes": []
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "notes": []
            }

    @staticmethod
    async def get_note(
        nextcloud_url: str,
        username: str,
        password: str,
        note_id: int
    ) -> Dict[str, Any]:
        """Fetch a specific note from Nextcloud."""
        try:
            api_url = f"{nextcloud_url.rstrip('/')}/index.php/apps/notes/api/v1/notes/{note_id}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    api_url,
                    auth=(username, password),
                    headers={"OCS-APIRequest": "true"}
                )

                if response.status_code == 200:
                    note = response.json()
                    return {
                        "success": True,
                        "note": {
                            "id": note.get("id"),
                            "title": note.get("title", ""),
                            "content": note.get("content", ""),
                            "category": note.get("category", ""),
                            "favorite": note.get("favorite", False),
                            "modified": note.get("modified"),
                            "readonly": note.get("readonly", False),
                        }
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Note not found or access denied"
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def create_note(
        nextcloud_url: str,
        username: str,
        password: str,
        title: str,
        content: str = "",
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new note in Nextcloud."""
        try:
            api_url = f"{nextcloud_url.rstrip('/')}/index.php/apps/notes/api/v1/notes"

            data = {
                "title": title,
                "content": content
            }
            if category:
                data["category"] = category

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    api_url,
                    auth=(username, password),
                    headers={
                        "OCS-APIRequest": "true",
                        "Content-Type": "application/json"
                    },
                    json=data
                )

                if response.status_code in [200, 201]:
                    note = response.json()
                    return {
                        "success": True,
                        "note": {
                            "id": note.get("id"),
                            "title": note.get("title", ""),
                            "content": note.get("content", ""),
                            "category": note.get("category", ""),
                            "favorite": note.get("favorite", False),
                            "modified": note.get("modified"),
                        }
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed to create note: {response.text}"
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def update_note(
        nextcloud_url: str,
        username: str,
        password: str,
        note_id: int,
        title: Optional[str] = None,
        content: Optional[str] = None,
        category: Optional[str] = None,
        favorite: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Update a note in Nextcloud."""
        try:
            api_url = f"{nextcloud_url.rstrip('/')}/index.php/apps/notes/api/v1/notes/{note_id}"

            data = {}
            if title is not None:
                data["title"] = title
            if content is not None:
                data["content"] = content
            if category is not None:
                data["category"] = category
            if favorite is not None:
                data["favorite"] = favorite

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.put(
                    api_url,
                    auth=(username, password),
                    headers={
                        "OCS-APIRequest": "true",
                        "Content-Type": "application/json"
                    },
                    json=data
                )

                if response.status_code == 200:
                    note = response.json()
                    return {
                        "success": True,
                        "note": {
                            "id": note.get("id"),
                            "title": note.get("title", ""),
                            "content": note.get("content", ""),
                            "category": note.get("category", ""),
                            "favorite": note.get("favorite", False),
                            "modified": note.get("modified"),
                        }
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed to update note: {response.text}"
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def delete_note(
        nextcloud_url: str,
        username: str,
        password: str,
        note_id: int
    ) -> Dict[str, Any]:
        """Delete a note from Nextcloud."""
        try:
            api_url = f"{nextcloud_url.rstrip('/')}/index.php/apps/notes/api/v1/notes/{note_id}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(
                    api_url,
                    auth=(username, password),
                    headers={"OCS-APIRequest": "true"}
                )

                if response.status_code in [200, 204]:
                    return {"success": True}
                else:
                    return {
                        "success": False,
                        "error": f"Failed to delete note: {response.text}"
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
