/**
 * WebSocket service for real-time widget updates.
 * Handles connection, reconnection, and message handling.
 */

type MessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'ping'
  | 'widget_update'
  | 'widget_error'
  | 'subscribed'
  | 'unsubscribed'
  | 'pong'
  | 'error'
  | 'connected'
  | 'heartbeat';

interface WebSocketMessage {
  type: MessageType;
  data?: Record<string, unknown>;
}

interface WidgetUpdateData {
  widget_id: number;
  widget_type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface WidgetErrorData {
  widget_id: number;
  widget_type: string;
  error: string;
  timestamp: string;
}

type WidgetUpdateCallback = (data: WidgetUpdateData) => void;
type WidgetErrorCallback = (data: WidgetErrorData) => void;
type ConnectionCallback = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  // Callbacks
  private widgetUpdateCallbacks: Map<number, Set<WidgetUpdateCallback>> = new Map();
  private widgetTypeCallbacks: Map<string, Set<WidgetUpdateCallback>> = new Map();
  private widgetErrorCallbacks: Map<number, Set<WidgetErrorCallback>> = new Map();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();

  // Subscriptions to restore on reconnect
  private subscribedWidgets: Set<number> = new Set();
  private subscribedTypes: Set<string> = new Set();

  constructor() {
    // Construct WebSocket URL from current location
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const port = '8000'; // Backend port
    this.url = `${protocol}//${host}:${port}/api/ws/widgets`;
  }

  /**
   * Set the authentication token for WebSocket connection.
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        const url = this.token ? `${this.url}?token=${this.token}` : this.url;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);

          // Restore subscriptions
          this.subscribedWidgets.forEach((widgetId) => {
            this.sendMessage({ type: 'subscribe', widget_id: widgetId } as any);
          });
          this.subscribedTypes.forEach((type) => {
            this.sendMessage({ type: 'subscribe', widget_type: type } as any);
          });

          // Start ping interval
          this.startPingInterval();

          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Disconnected:', event.code, event.reason);
          this.cleanup();
          this.notifyConnectionChange(false);
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to updates for a specific widget.
   */
  subscribeWidget(widgetId: number, callback: WidgetUpdateCallback) {
    // Add callback
    if (!this.widgetUpdateCallbacks.has(widgetId)) {
      this.widgetUpdateCallbacks.set(widgetId, new Set());
    }
    this.widgetUpdateCallbacks.get(widgetId)!.add(callback);

    // Track subscription
    this.subscribedWidgets.add(widgetId);

    // Send subscribe message
    if (this.isConnected()) {
      this.sendMessage({ type: 'subscribe', widget_id: widgetId } as any);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribeWidget(widgetId, callback);
    };
  }

  /**
   * Unsubscribe from widget updates.
   */
  unsubscribeWidget(widgetId: number, callback?: WidgetUpdateCallback) {
    const callbacks = this.widgetUpdateCallbacks.get(widgetId);
    if (callbacks) {
      if (callback) {
        callbacks.delete(callback);
      }
      if (!callback || callbacks.size === 0) {
        this.widgetUpdateCallbacks.delete(widgetId);
        this.subscribedWidgets.delete(widgetId);
        if (this.isConnected()) {
          this.sendMessage({ type: 'unsubscribe', widget_id: widgetId } as any);
        }
      }
    }
  }

  /**
   * Subscribe to updates for all widgets of a specific type.
   */
  subscribeType(widgetType: string, callback: WidgetUpdateCallback) {
    if (!this.widgetTypeCallbacks.has(widgetType)) {
      this.widgetTypeCallbacks.set(widgetType, new Set());
    }
    this.widgetTypeCallbacks.get(widgetType)!.add(callback);

    this.subscribedTypes.add(widgetType);

    if (this.isConnected()) {
      this.sendMessage({ type: 'subscribe', widget_type: widgetType } as any);
    }

    return () => {
      this.unsubscribeType(widgetType, callback);
    };
  }

  /**
   * Unsubscribe from widget type updates.
   */
  unsubscribeType(widgetType: string, callback?: WidgetUpdateCallback) {
    const callbacks = this.widgetTypeCallbacks.get(widgetType);
    if (callbacks) {
      if (callback) {
        callbacks.delete(callback);
      }
      if (!callback || callbacks.size === 0) {
        this.widgetTypeCallbacks.delete(widgetType);
        this.subscribedTypes.delete(widgetType);
      }
    }
  }

  /**
   * Subscribe to widget errors.
   */
  subscribeError(widgetId: number, callback: WidgetErrorCallback) {
    if (!this.widgetErrorCallbacks.has(widgetId)) {
      this.widgetErrorCallbacks.set(widgetId, new Set());
    }
    this.widgetErrorCallbacks.get(widgetId)!.add(callback);

    return () => {
      const callbacks = this.widgetErrorCallbacks.get(widgetId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.widgetErrorCallbacks.delete(widgetId);
        }
      }
    };
  }

  /**
   * Subscribe to connection status changes.
   */
  onConnectionChange(callback: ConnectionCallback) {
    this.connectionCallbacks.add(callback);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Check if WebSocket is connected.
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status.
   */
  getStatus() {
    return {
      connected: this.isConnected(),
      subscribedWidgets: Array.from(this.subscribedWidgets),
      subscribedTypes: Array.from(this.subscribedTypes),
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private handleMessage(rawData: string) {
    try {
      const message: WebSocketMessage = JSON.parse(rawData);

      switch (message.type) {
        case 'widget_update':
          this.handleWidgetUpdate(message.data as unknown as WidgetUpdateData);
          break;

        case 'widget_error':
          this.handleWidgetError(message.data as unknown as WidgetErrorData);
          break;

        case 'heartbeat':
        case 'pong':
          // Reset heartbeat timeout
          break;

        case 'connected':
          console.log('[WS] Server acknowledged connection:', message.data);
          break;

        case 'subscribed':
          console.log('[WS] Subscribed:', message.data);
          break;

        case 'unsubscribed':
          console.log('[WS] Unsubscribed:', message.data);
          break;

        case 'error':
          console.error('[WS] Server error:', message.data);
          break;

        default:
          console.log('[WS] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
    }
  }

  private handleWidgetUpdate(data: WidgetUpdateData) {
    // Notify widget-specific callbacks
    const widgetCallbacks = this.widgetUpdateCallbacks.get(data.widget_id);
    if (widgetCallbacks) {
      widgetCallbacks.forEach((callback) => callback(data));
    }

    // Notify type callbacks
    const typeCallbacks = this.widgetTypeCallbacks.get(data.widget_type);
    if (typeCallbacks) {
      typeCallbacks.forEach((callback) => callback(data));
    }
  }

  private handleWidgetError(data: WidgetErrorData) {
    const callbacks = this.widgetErrorCallbacks.get(data.widget_id);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionCallbacks.forEach((callback) => callback(connected));
  }

  private sendMessage(message: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startPingInterval() {
    // Send ping every 25 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'ping' });
      }
    }, 25000);
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WS] Reconnect failed:', error);
      });
    }, delay);
  }
}

// Singleton instance
export const wsService = new WebSocketService();

// React hook for using WebSocket in components
export function useWebSocket() {
  return wsService;
}
