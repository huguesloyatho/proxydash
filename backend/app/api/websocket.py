"""
WebSocket API endpoints for real-time widget updates.
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from jose import jwt, JWTError

from app.core.config import settings
from app.services.websocket_service import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSocket"])


def get_user_id_from_token(token: Optional[str]) -> Optional[int]:
    """
    Extract user ID from JWT token.
    Returns None if token is invalid or not provided.
    """
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        return int(user_id) if user_id else None
    except (JWTError, ValueError):
        return None


@router.websocket("/widgets")
async def websocket_widgets(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for widget updates.

    Query Parameters:
        token: Optional JWT token for authentication

    Message Protocol:
        Client -> Server:
        - {"type": "subscribe", "widget_id": 123}
        - {"type": "subscribe", "widget_type": "docker"}
        - {"type": "unsubscribe", "widget_id": 123}
        - {"type": "ping"}

        Server -> Client:
        - {"type": "connected", "data": {...}}
        - {"type": "subscribed", "data": {"widget_id": 123}}
        - {"type": "widget_update", "data": {"widget_id": 123, "widget_type": "...", "data": {...}}}
        - {"type": "widget_error", "data": {"widget_id": 123, "error": "..."}}
        - {"type": "pong", "data": {"server_time": "..."}}
        - {"type": "heartbeat", "data": {"server_time": "..."}}
    """
    # Generate unique client ID
    client_id = str(uuid.uuid4())

    # Optionally authenticate user
    user_id = get_user_id_from_token(token)

    try:
        # Connect client
        client = await ws_manager.connect(websocket, client_id, user_id)

        # Listen for messages
        while True:
            try:
                message = await websocket.receive_text()
                await ws_manager.handle_message(client_id, message)
            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")

    finally:
        await ws_manager.disconnect(client_id)


@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket manager statistics."""
    return ws_manager.get_stats()
