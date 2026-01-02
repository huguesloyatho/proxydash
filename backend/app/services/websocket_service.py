"""
WebSocket service for real-time widget updates.
Manages client connections and broadcasts widget data updates.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any, List
from dataclasses import dataclass, field
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect

from app.core.config import settings

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket message types."""
    # Client -> Server
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    PING = "ping"

    # Server -> Client
    WIDGET_UPDATE = "widget_update"
    WIDGET_ERROR = "widget_error"
    SUBSCRIBED = "subscribed"
    UNSUBSCRIBED = "unsubscribed"
    PONG = "pong"
    ERROR = "error"
    CONNECTED = "connected"


@dataclass
class WebSocketClient:
    """Represents a connected WebSocket client."""
    websocket: WebSocket
    client_id: str
    user_id: Optional[int] = None
    subscribed_widgets: Set[int] = field(default_factory=set)
    subscribed_types: Set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_ping: datetime = field(default_factory=datetime.utcnow)


class WebSocketManager:
    """
    Manages WebSocket connections and broadcasts.
    Supports subscribing to specific widgets or widget types.
    """

    def __init__(self):
        # client_id -> WebSocketClient
        self._clients: Dict[str, WebSocketClient] = {}
        # widget_id -> set of client_ids
        self._widget_subscribers: Dict[int, Set[str]] = {}
        # widget_type -> set of client_ids
        self._type_subscribers: Dict[str, Set[str]] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        # Background task for heartbeat
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        """Start the WebSocket manager and heartbeat task."""
        if not settings.WS_ENABLED:
            logger.info("WebSocket service is disabled via WS_ENABLED setting")
            return

        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info("WebSocket manager started")

    async def stop(self):
        """Stop the WebSocket manager and close all connections."""
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        # Close all client connections
        async with self._lock:
            for client in list(self._clients.values()):
                try:
                    await client.websocket.close()
                except Exception:
                    pass
            self._clients.clear()
            self._widget_subscribers.clear()
            self._type_subscribers.clear()

        logger.info("WebSocket manager stopped")

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        user_id: Optional[int] = None
    ) -> WebSocketClient:
        """
        Accept a new WebSocket connection.

        Args:
            websocket: The WebSocket connection
            client_id: Unique client identifier
            user_id: Optional user ID for authenticated connections

        Returns:
            WebSocketClient instance
        """
        await websocket.accept()

        client = WebSocketClient(
            websocket=websocket,
            client_id=client_id,
            user_id=user_id,
        )

        async with self._lock:
            self._clients[client_id] = client

        logger.info(f"WebSocket client connected: {client_id} (user: {user_id})")

        # Send welcome message
        await self._send_to_client(client, {
            "type": MessageType.CONNECTED,
            "data": {
                "client_id": client_id,
                "server_time": datetime.utcnow().isoformat(),
                "heartbeat_interval": settings.WS_HEARTBEAT_INTERVAL,
            }
        })

        return client

    async def disconnect(self, client_id: str):
        """
        Handle client disconnection.

        Args:
            client_id: The client ID to disconnect
        """
        async with self._lock:
            client = self._clients.pop(client_id, None)
            if client:
                # Remove from widget subscriptions
                for widget_id in client.subscribed_widgets:
                    if widget_id in self._widget_subscribers:
                        self._widget_subscribers[widget_id].discard(client_id)

                # Remove from type subscriptions
                for widget_type in client.subscribed_types:
                    if widget_type in self._type_subscribers:
                        self._type_subscribers[widget_type].discard(client_id)

        logger.info(f"WebSocket client disconnected: {client_id}")

    async def subscribe_widget(self, client_id: str, widget_id: int) -> bool:
        """
        Subscribe a client to widget updates.

        Args:
            client_id: The client ID
            widget_id: The widget ID to subscribe to

        Returns:
            True if subscribed successfully
        """
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return False

            client.subscribed_widgets.add(widget_id)
            if widget_id not in self._widget_subscribers:
                self._widget_subscribers[widget_id] = set()
            self._widget_subscribers[widget_id].add(client_id)

        logger.debug(f"Client {client_id} subscribed to widget {widget_id}")
        await self._send_to_client(client, {
            "type": MessageType.SUBSCRIBED,
            "data": {"widget_id": widget_id}
        })
        return True

    async def unsubscribe_widget(self, client_id: str, widget_id: int) -> bool:
        """
        Unsubscribe a client from widget updates.

        Args:
            client_id: The client ID
            widget_id: The widget ID to unsubscribe from

        Returns:
            True if unsubscribed successfully
        """
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return False

            client.subscribed_widgets.discard(widget_id)
            if widget_id in self._widget_subscribers:
                self._widget_subscribers[widget_id].discard(client_id)

        logger.debug(f"Client {client_id} unsubscribed from widget {widget_id}")
        await self._send_to_client(client, {
            "type": MessageType.UNSUBSCRIBED,
            "data": {"widget_id": widget_id}
        })
        return True

    async def subscribe_type(self, client_id: str, widget_type: str) -> bool:
        """
        Subscribe a client to all widgets of a specific type.

        Args:
            client_id: The client ID
            widget_type: The widget type to subscribe to

        Returns:
            True if subscribed successfully
        """
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return False

            client.subscribed_types.add(widget_type)
            if widget_type not in self._type_subscribers:
                self._type_subscribers[widget_type] = set()
            self._type_subscribers[widget_type].add(client_id)

        logger.debug(f"Client {client_id} subscribed to type {widget_type}")
        await self._send_to_client(client, {
            "type": MessageType.SUBSCRIBED,
            "data": {"widget_type": widget_type}
        })
        return True

    async def broadcast_widget_update(
        self,
        widget_id: int,
        widget_type: str,
        data: Dict[str, Any]
    ):
        """
        Broadcast widget data update to all subscribed clients.

        Args:
            widget_id: The widget ID
            widget_type: The widget type
            data: The widget data to broadcast
        """
        message = {
            "type": MessageType.WIDGET_UPDATE,
            "data": {
                "widget_id": widget_id,
                "widget_type": widget_type,
                "data": data,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

        clients_to_notify: Set[str] = set()

        async with self._lock:
            # Get widget-specific subscribers
            if widget_id in self._widget_subscribers:
                clients_to_notify.update(self._widget_subscribers[widget_id])

            # Get type subscribers
            if widget_type in self._type_subscribers:
                clients_to_notify.update(self._type_subscribers[widget_type])

            # Send to all subscribed clients
            for client_id in clients_to_notify:
                client = self._clients.get(client_id)
                if client:
                    await self._send_to_client(client, message)

        if clients_to_notify:
            logger.debug(
                f"Broadcasted widget {widget_id} update to {len(clients_to_notify)} clients"
            )

    async def broadcast_widget_error(
        self,
        widget_id: int,
        widget_type: str,
        error: str
    ):
        """
        Broadcast widget error to subscribed clients.

        Args:
            widget_id: The widget ID
            widget_type: The widget type
            error: Error message
        """
        message = {
            "type": MessageType.WIDGET_ERROR,
            "data": {
                "widget_id": widget_id,
                "widget_type": widget_type,
                "error": error,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }

        clients_to_notify: Set[str] = set()

        async with self._lock:
            if widget_id in self._widget_subscribers:
                clients_to_notify.update(self._widget_subscribers[widget_id])
            if widget_type in self._type_subscribers:
                clients_to_notify.update(self._type_subscribers[widget_type])

            for client_id in clients_to_notify:
                client = self._clients.get(client_id)
                if client:
                    await self._send_to_client(client, message)

    async def handle_message(self, client_id: str, message: str):
        """
        Handle incoming WebSocket message from a client.

        Args:
            client_id: The client ID
            message: Raw message string
        """
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == MessageType.SUBSCRIBE:
                widget_id = data.get("widget_id")
                widget_type = data.get("widget_type")
                if widget_id:
                    await self.subscribe_widget(client_id, widget_id)
                elif widget_type:
                    await self.subscribe_type(client_id, widget_type)

            elif msg_type == MessageType.UNSUBSCRIBE:
                widget_id = data.get("widget_id")
                if widget_id:
                    await self.unsubscribe_widget(client_id, widget_id)

            elif msg_type == MessageType.PING:
                async with self._lock:
                    client = self._clients.get(client_id)
                    if client:
                        client.last_ping = datetime.utcnow()
                        await self._send_to_client(client, {
                            "type": MessageType.PONG,
                            "data": {"server_time": datetime.utcnow().isoformat()}
                        })

            else:
                logger.warning(f"Unknown message type from {client_id}: {msg_type}")

        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from client {client_id}")
        except Exception as e:
            logger.error(f"Error handling message from {client_id}: {e}")

    async def _send_to_client(self, client: WebSocketClient, message: Dict[str, Any]):
        """Send a message to a specific client."""
        try:
            await client.websocket.send_json(message)
        except Exception as e:
            logger.warning(f"Failed to send to client {client.client_id}: {e}")
            # Schedule disconnection
            asyncio.create_task(self.disconnect(client.client_id))

    async def _heartbeat_loop(self):
        """Background task to send heartbeats and cleanup stale connections."""
        while self._running:
            try:
                await asyncio.sleep(settings.WS_HEARTBEAT_INTERVAL)

                now = datetime.utcnow()
                stale_clients: List[str] = []

                async with self._lock:
                    for client_id, client in self._clients.items():
                        # Check if client hasn't responded in 3 heartbeat intervals
                        time_since_ping = (now - client.last_ping).total_seconds()
                        if time_since_ping > settings.WS_HEARTBEAT_INTERVAL * 3:
                            stale_clients.append(client_id)
                            continue

                        # Send heartbeat
                        try:
                            await client.websocket.send_json({
                                "type": "heartbeat",
                                "data": {"server_time": now.isoformat()}
                            })
                        except Exception:
                            stale_clients.append(client_id)

                # Disconnect stale clients
                for client_id in stale_clients:
                    await self.disconnect(client_id)
                    logger.info(f"Disconnected stale client: {client_id}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Get WebSocket manager statistics."""
        return {
            "enabled": settings.WS_ENABLED,
            "running": self._running,
            "connected_clients": len(self._clients),
            "widget_subscriptions": {
                str(k): len(v) for k, v in self._widget_subscribers.items()
            },
            "type_subscriptions": {
                k: len(v) for k, v in self._type_subscribers.items()
            },
        }


# Global WebSocket manager instance
ws_manager = WebSocketManager()
