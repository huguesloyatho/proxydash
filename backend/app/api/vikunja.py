"""
Vikunja API routes - CRUD operations for tasks.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import httpx

from app.core.database import get_db

# Disable SSL verification for self-signed certificates
# Using verify=False instead of custom SSL context for httpx compatibility
SSL_VERIFY = False
from app.models import Widget
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vikunja", tags=["Vikunja"])


async def get_vikunja_config(db: Session) -> Dict[str, Any]:
    """Get Vikunja configuration from the first vikunja widget."""
    widget = db.query(Widget).filter(
        Widget.widget_type == "vikunja",
        Widget.is_visible == True
    ).first()

    if not widget:
        # Try hidden widgets too
        widget = db.query(Widget).filter(Widget.widget_type == "vikunja").first()

    if not widget or not widget.config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun widget Vikunja configuré"
        )

    config = widget.config
    api_url = config.get("api_url", "").rstrip("/")
    api_token = config.get("api_token", "")

    if not api_url or not api_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configuration Vikunja incomplète (api_url ou api_token manquant)"
        )

    return {
        "api_url": api_url,
        "api_token": api_token,
        "widget_id": widget.id,
        "project_id": config.get("project_id", 0),
    }


def get_headers(api_token: str) -> Dict[str, str]:
    """Get headers for Vikunja API requests."""
    return {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }


@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """List all available Vikunja users (from teams)."""
    config = await get_vikunja_config(db)

    try:
        users_map: Dict[int, Dict] = {}

        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            # Get all teams
            teams_response = await client.get(
                f"{config['api_url']}/api/v1/teams",
                headers=get_headers(config["api_token"])
            )
            teams_response.raise_for_status()
            teams = teams_response.json() or []

            # Get members from each team
            for team in teams:
                team_id = team.get("id")
                if team_id:
                    team_detail_response = await client.get(
                        f"{config['api_url']}/api/v1/teams/{team_id}",
                        headers=get_headers(config["api_token"])
                    )
                    if team_detail_response.status_code == 200:
                        team_detail = team_detail_response.json()
                        members = team_detail.get("members") or []
                        for member in members:
                            user_id = member.get("id")
                            if user_id and user_id not in users_map:
                                users_map[user_id] = {
                                    "id": user_id,
                                    "name": member.get("name", ""),
                                    "username": member.get("username", ""),
                                }

            return list(users_map.values())
    except httpx.HTTPStatusError as e:
        logger.error(f"List users error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur API: {e.response.status_code}")
    except Exception as e:
        logger.error(f"List users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects")
async def list_projects(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """List all accessible Vikunja projects."""
    config = await get_vikunja_config(db)

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            response = await client.get(
                f"{config['api_url']}/api/v1/projects",
                headers=get_headers(config["api_token"])
            )
            response.raise_for_status()
            projects = response.json()

            return [
                {
                    "id": p.get("id"),
                    "title": p.get("title", "Sans titre"),
                    "description": p.get("description", ""),
                    "hex_color": p.get("hex_color", ""),
                    "is_archived": p.get("is_archived", False),
                }
                for p in projects
                if not p.get("is_archived", False)
            ]
    except httpx.HTTPStatusError as e:
        logger.error(f"Vikunja API error: {e}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Erreur API Vikunja: {e.response.status_code}"
        )
    except Exception as e:
        logger.error(f"Vikunja projects error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/labels")
async def list_labels(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """List all available labels."""
    config = await get_vikunja_config(db)

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            response = await client.get(
                f"{config['api_url']}/api/v1/labels",
                headers=get_headers(config["api_token"])
            )
            response.raise_for_status()
            labels = response.json()

            return [
                {
                    "id": l.get("id"),
                    "title": l.get("title", ""),
                    "hex_color": l.get("hex_color", "#000000"),
                }
                for l in labels
            ]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur API: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/upcoming")
async def get_upcoming_tasks(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get upcoming tasks (not done, with due_date >= today) sorted by due date."""
    from zoneinfo import ZoneInfo

    config = await get_vikunja_config(db)
    local_tz = ZoneInfo("Europe/Paris")
    today = datetime.now(local_tz).date()

    try:
        all_tasks = []
        page = 1
        per_page = 50

        async with httpx.AsyncClient(timeout=30.0, verify=SSL_VERIFY) as client:
            while True:
                response = await client.get(
                    f"{config['api_url']}/api/v1/tasks/all",
                    params={"per_page": per_page, "page": page},
                    headers=get_headers(config["api_token"])
                )
                response.raise_for_status()
                tasks = response.json()

                if not tasks:
                    break

                all_tasks.extend(tasks)
                page += 1

                if len(tasks) < per_page:
                    break

        # Filter tasks: not done AND due_date >= today
        upcoming_tasks = []
        for task in all_tasks:
            if task.get("done"):
                continue

            due_date_str = task.get("due_date")
            if not due_date_str or "0001" in due_date_str:
                continue

            try:
                due_utc = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                due_local = due_utc.astimezone(local_tz)
                if due_local.date() >= today:
                    upcoming_tasks.append({
                        "id": task.get("id"),
                        "title": task.get("title", ""),
                        "description": task.get("description", ""),
                        "done": task.get("done", False),
                        "priority": task.get("priority", 0),
                        "due_date": due_date_str,
                        "due_date_local": due_local.isoformat(),
                        "project_id": task.get("project_id"),
                        "labels": task.get("labels") or [],
                        "assignees": task.get("assignees") or [],
                    })
            except Exception:
                continue

        # Sort by due_date, then by priority (higher first)
        upcoming_tasks.sort(key=lambda t: (
            t.get("due_date_local", "9999"),
            -t.get("priority", 0)
        ))

        # Limit results
        limited_tasks = upcoming_tasks[:limit]

        return {
            "tasks": limited_tasks,
            "count": len(limited_tasks),
            "total_upcoming": len(upcoming_tasks),
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"Vikunja API error: {e}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Erreur API Vikunja: {e.response.status_code}"
        )
    except Exception as e:
        logger.error(f"Get upcoming tasks error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get a single task with full details."""
    config = await get_vikunja_config(db)

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            response = await client.get(
                f"{config['api_url']}/api/v1/tasks/{task_id}",
                headers=get_headers(config["api_token"])
            )
            response.raise_for_status()
            task = response.json()

            # Get attachments separately
            attachments_response = await client.get(
                f"{config['api_url']}/api/v1/tasks/{task_id}/attachments",
                headers=get_headers(config["api_token"])
            )
            attachments = []
            if attachments_response.status_code == 200:
                attachments_data = attachments_response.json()
                if attachments_data:
                    attachments = [
                        {
                            "id": a.get("id"),
                            "file_name": a.get("file", {}).get("name", "Fichier"),
                            "file_size": a.get("file", {}).get("size", 0),
                            "created": a.get("created"),
                        }
                        for a in attachments_data
                    ]

            # Parse labels
            labels_data = task.get("labels") or []
            labels = [
                {
                    "id": l.get("id"),
                    "title": l.get("title", ""),
                    "hex_color": l.get("hex_color", "#000000"),
                }
                for l in labels_data
                if l and isinstance(l, dict)
            ]

            # Parse due_date
            due_date = task.get("due_date")
            if due_date == "0001-01-01T00:00:00Z":
                due_date = None

            # Parse assignees
            assignees_data = task.get("assignees") or []
            assignees = [
                {
                    "id": a.get("id"),
                    "name": a.get("name", ""),
                    "username": a.get("username", ""),
                }
                for a in assignees_data
                if a and isinstance(a, dict)
            ]

            return {
                "id": task.get("id"),
                "title": task.get("title", ""),
                "description": task.get("description", ""),
                "done": task.get("done", False),
                "priority": task.get("priority", 0),
                "due_date": due_date,
                "project_id": task.get("project_id"),
                "labels": labels,
                "assignees": assignees,
                "attachments": attachments,
                "created": task.get("created"),
                "updated": task.get("updated"),
                "percent_done": task.get("percent_done", 0),
                "start_date": task.get("start_date"),
                "end_date": task.get("end_date"),
                "repeat_after": task.get("repeat_after", 0),
                "repeat_mode": task.get("repeat_mode", 0),
            }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Tâche non trouvée")
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur API: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Get task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks")
async def create_task(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a new task in Vikunja."""
    config = await get_vikunja_config(db)

    project_id = data.get("project_id") or config.get("project_id")
    if not project_id or project_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id est requis"
        )

    # Build task payload for Vikunja
    task_payload = {
        "title": data.get("title", "Nouvelle tâche"),
        "description": data.get("description", ""),
        "priority": data.get("priority", 0),
        "done": data.get("done", False),
    }

    # Handle due_date
    if data.get("due_date"):
        task_payload["due_date"] = data["due_date"]

    # Handle labels (list of label IDs)
    if data.get("labels"):
        task_payload["labels"] = [{"id": lid} for lid in data["labels"]]

    logger.info(f"Creating task with payload: {task_payload} in project {project_id}")

    try:
        async with httpx.AsyncClient(timeout=30.0, verify=SSL_VERIFY) as client:
            response = await client.put(
                f"{config['api_url']}/api/v1/projects/{project_id}/tasks",
                headers=get_headers(config["api_token"]),
                json=task_payload
            )
            response.raise_for_status()
            created_task = response.json()
            task_id = created_task.get("id")
            logger.info(f"Task created with ID: {task_id}")

            # Handle assignees separately after task creation
            if data.get("assignees") and task_id:
                for user_id in data["assignees"]:
                    try:
                        await client.put(
                            f"{config['api_url']}/api/v1/tasks/{task_id}/assignees",
                            headers=get_headers(config["api_token"]),
                            json={"user_id": user_id}
                        )
                        logger.info(f"Added assignee {user_id} to task {task_id}")
                    except Exception as e:
                        logger.warning(f"Failed to add assignee {user_id}: {e}")

                # Refetch to get updated assignees
                final_response = await client.get(
                    f"{config['api_url']}/api/v1/tasks/{task_id}",
                    headers=get_headers(config["api_token"])
                )
                if final_response.status_code == 200:
                    created_task = final_response.json()

            return created_task
    except httpx.HTTPStatusError as e:
        logger.error(f"Create task HTTP error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur création: {e.response.text}")
    except Exception as e:
        logger.error(f"Create task error: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e) or 'Unknown error'}")


@router.put("/tasks/{task_id}")
async def update_task(
    task_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update an existing task."""
    config = await get_vikunja_config(db)

    logger.info(f"Update task {task_id} with data: {data}")

    try:
        async with httpx.AsyncClient(timeout=30.0, verify=SSL_VERIFY) as client:
            # First, get the current task to have all required fields
            get_response = await client.get(
                f"{config['api_url']}/api/v1/tasks/{task_id}",
                headers=get_headers(config["api_token"])
            )
            get_response.raise_for_status()
            existing_task = get_response.json()

            # Build update payload starting from existing task
            task_payload: Dict[str, Any] = {
                "id": task_id,
                "title": existing_task.get("title", ""),  # title is required
            }

            # Apply updates from request data (excluding labels - handled separately)
            if "title" in data:
                task_payload["title"] = data["title"]
            if "description" in data:
                task_payload["description"] = data["description"]
            if "priority" in data:
                task_payload["priority"] = data["priority"]
            if "done" in data:
                task_payload["done"] = data["done"]
            if "due_date" in data:
                task_payload["due_date"] = data["due_date"] if data["due_date"] else "0001-01-01T00:00:00Z"
            if "project_id" in data:
                task_payload["project_id"] = data["project_id"]

            logger.info(f"Sending payload to Vikunja: {task_payload}")

            # Send task update
            response = await client.post(
                f"{config['api_url']}/api/v1/tasks/{task_id}",
                headers=get_headers(config["api_token"]),
                json=task_payload
            )
            response.raise_for_status()
            updated_task = response.json()

            # Handle labels separately - Vikunja requires dedicated endpoint
            if "labels" in data:
                labels_list = data["labels"]
                # Convert to list of label IDs
                new_label_ids = set()
                if labels_list:
                    for l in labels_list:
                        if isinstance(l, int):
                            new_label_ids.add(l)
                        elif isinstance(l, dict) and "id" in l:
                            new_label_ids.add(l["id"])
                        elif isinstance(l, str):
                            new_label_ids.add(int(l))

                # Get current labels
                current_labels = existing_task.get("labels") or []
                current_label_ids = {l["id"] for l in current_labels if isinstance(l, dict) and "id" in l}

                # Remove labels no longer in list
                for label_id in current_label_ids - new_label_ids:
                    try:
                        await client.delete(
                            f"{config['api_url']}/api/v1/tasks/{task_id}/labels/{label_id}",
                            headers=get_headers(config["api_token"])
                        )
                        logger.info(f"Removed label {label_id} from task {task_id}")
                    except Exception as e:
                        logger.warning(f"Failed to remove label {label_id}: {e}")

                # Add new labels
                for label_id in new_label_ids - current_label_ids:
                    try:
                        await client.put(
                            f"{config['api_url']}/api/v1/tasks/{task_id}/labels",
                            headers=get_headers(config["api_token"]),
                            json={"label_id": label_id}
                        )
                        logger.info(f"Added label {label_id} to task {task_id}")
                    except Exception as e:
                        logger.warning(f"Failed to add label {label_id}: {e}")

            # Handle assignees separately - Vikunja requires dedicated endpoint
            if "assignees" in data:
                assignees_list = data["assignees"]
                # Convert to list of user IDs
                new_assignee_ids = set()
                if assignees_list:
                    for a in assignees_list:
                        if isinstance(a, int):
                            new_assignee_ids.add(a)
                        elif isinstance(a, dict) and "id" in a:
                            new_assignee_ids.add(a["id"])
                        elif isinstance(a, str):
                            new_assignee_ids.add(int(a))

                # Get current assignees
                current_assignees = existing_task.get("assignees") or []
                current_assignee_ids = {a["id"] for a in current_assignees if isinstance(a, dict) and "id" in a}

                # Remove assignees no longer in list
                for user_id in current_assignee_ids - new_assignee_ids:
                    try:
                        await client.delete(
                            f"{config['api_url']}/api/v1/tasks/{task_id}/assignees/{user_id}",
                            headers=get_headers(config["api_token"])
                        )
                        logger.info(f"Removed assignee {user_id} from task {task_id}")
                    except Exception as e:
                        logger.warning(f"Failed to remove assignee {user_id}: {e}")

                # Add new assignees
                for user_id in new_assignee_ids - current_assignee_ids:
                    try:
                        await client.put(
                            f"{config['api_url']}/api/v1/tasks/{task_id}/assignees",
                            headers=get_headers(config["api_token"]),
                            json={"user_id": user_id}
                        )
                        logger.info(f"Added assignee {user_id} to task {task_id}")
                    except Exception as e:
                        logger.warning(f"Failed to add assignee {user_id}: {e}")

            # Refetch task to get updated data (labels and assignees)
            if "labels" in data or "assignees" in data:
                final_response = await client.get(
                    f"{config['api_url']}/api/v1/tasks/{task_id}",
                    headers=get_headers(config["api_token"])
                )
                if final_response.status_code == 200:
                    updated_task = final_response.json()

            return updated_task
    except httpx.HTTPStatusError as e:
        logger.error(f"Update task HTTP error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur mise à jour: {e.response.text}")
    except Exception as e:
        logger.error(f"Update task error: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Delete a task."""
    config = await get_vikunja_config(db)

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            response = await client.delete(
                f"{config['api_url']}/api/v1/tasks/{task_id}",
                headers=get_headers(config["api_token"])
            )
            response.raise_for_status()
            return {"message": "Tâche supprimée"}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Tâche non trouvée")
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur suppression: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/done")
async def toggle_task_done(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Toggle task completion status."""
    config = await get_vikunja_config(db)

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            # First get current task state
            get_response = await client.get(
                f"{config['api_url']}/api/v1/tasks/{task_id}",
                headers=get_headers(config["api_token"])
            )
            get_response.raise_for_status()
            task = get_response.json()

            # Toggle done status
            new_done = not task.get("done", False)

            response = await client.post(
                f"{config['api_url']}/api/v1/tasks/{task_id}",
                headers=get_headers(config["api_token"]),
                json={"id": task_id, "done": new_done}
            )
            response.raise_for_status()

            return {"done": new_done, "task": response.json()}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/by-date/{date}")
async def get_tasks_by_date(
    date: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get all tasks for a specific date (due_date matches the given date in local timezone)."""
    config = await get_vikunja_config(db)

    try:
        # Parse the date
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez YYYY-MM-DD")

    # Get local timezone (Europe/Paris)
    try:
        from zoneinfo import ZoneInfo
        local_tz = ZoneInfo("Europe/Paris")
    except ImportError:
        import pytz
        local_tz = pytz.timezone("Europe/Paris")

    try:
        async with httpx.AsyncClient(timeout=30.0, verify=SSL_VERIFY) as client:
            # Fetch all tasks with pagination - Vikunja limits per_page to 50
            all_tasks = []
            page = 1
            while True:
                response = await client.get(
                    f"{config['api_url']}/api/v1/tasks/all",
                    headers=get_headers(config["api_token"]),
                    params={"per_page": 50, "page": page}
                )
                response.raise_for_status()
                page_tasks = response.json()
                if not page_tasks:
                    break
                all_tasks.extend(page_tasks)
                if len(page_tasks) < 50:
                    break
                page += 1

            # Filter tasks by due_date (converted to local timezone)
            tasks = []
            logger.info(f"Filtering {len(all_tasks)} tasks for date {target_date}")
            for task in all_tasks:
                due_date_str = task.get("due_date")
                if due_date_str and due_date_str != "0001-01-01T00:00:00Z":
                    try:
                        due_date_utc = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                        # Convert to local timezone
                        due_date_local = due_date_utc.astimezone(local_tz)
                        if due_date_local.date() == target_date:
                            labels_data = task.get("labels") or []
                            labels = [
                                {"id": l.get("id"), "title": l.get("title", ""), "hex_color": l.get("hex_color", "#000000")}
                                for l in labels_data if l and isinstance(l, dict)
                            ]
                            tasks.append({
                                "id": task.get("id"),
                                "title": task.get("title", "Sans titre"),
                                "description": task.get("description", ""),
                                "done": task.get("done", False),
                                "priority": task.get("priority", 0),
                                "due_date": due_date_local.isoformat(),
                                "project_id": task.get("project_id"),
                                "labels": labels,
                            })
                    except Exception:
                        pass

            # Sort by priority (desc) then time
            tasks.sort(key=lambda x: (-x.get("priority", 0), x.get("due_date") or ""))

            return {"date": date, "tasks": tasks, "count": len(tasks)}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur API: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Get tasks by date error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/attachments")
async def add_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Upload an attachment to a task."""
    config = await get_vikunja_config(db)

    try:
        file_content = await file.read()

        async with httpx.AsyncClient(timeout=30.0, verify=SSL_VERIFY) as client:
            # Vikunja expects multipart form data
            files = {
                "files": (file.filename, file_content, file.content_type or "application/octet-stream")
            }

            response = await client.put(
                f"{config['api_url']}/api/v1/tasks/{task_id}/attachments",
                headers={"Authorization": f"Bearer {config['api_token']}"},
                files=files
            )
            response.raise_for_status()

            result = response.json()
            return {
                "message": "Pièce jointe ajoutée",
                "attachment": result
            }
    except httpx.HTTPStatusError as e:
        logger.error(f"Upload attachment error: {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur upload: {e.response.text}")
    except Exception as e:
        logger.error(f"Upload attachment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}/attachments/{attachment_id}")
async def delete_attachment(
    task_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Delete an attachment from a task."""
    config = await get_vikunja_config(db)

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=SSL_VERIFY) as client:
            response = await client.delete(
                f"{config['api_url']}/api/v1/tasks/{task_id}/attachments/{attachment_id}",
                headers=get_headers(config["api_token"])
            )
            response.raise_for_status()
            return {"message": "Pièce jointe supprimée"}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Erreur: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}/attachments/{attachment_id}/download")
async def download_attachment(
    task_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get attachment download URL."""
    config = await get_vikunja_config(db)

    # Return the Vikunja URL for direct download
    return {
        "url": f"{config['api_url']}/api/v1/tasks/{task_id}/attachments/{attachment_id}",
        "token": config["api_token"]
    }


