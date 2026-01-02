/**
 * React hook for WebSocket-based real-time widget updates.
 * Combines with HTTP fetching for initial data and cache miss scenarios.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { wsService } from '@/lib/websocket';
import { useAuthStore } from '@/lib/store';

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

interface UseWidgetWebSocketOptions {
  /** Widget ID to subscribe to */
  widgetId?: number;
  /** Widget type to subscribe to (for type-based subscriptions) */
  widgetType?: string;
  /** Called when widget data is received */
  onUpdate?: (data: Record<string, unknown>) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Whether the subscription is enabled */
  enabled?: boolean;
}

interface UseWidgetWebSocketReturn {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Last received data */
  lastData: Record<string, unknown> | null;
  /** Last error message */
  lastError: string | null;
  /** Timestamp of last update */
  lastUpdated: Date | null;
  /** Manually trigger a reconnection */
  reconnect: () => void;
}

/**
 * Hook for subscribing to real-time widget updates via WebSocket.
 *
 * @example
 * ```tsx
 * const { isConnected, lastData, lastError } = useWidgetWebSocket({
 *   widgetId: 5,
 *   onUpdate: (data) => setWidgetData(data),
 *   onError: (error) => console.error(error),
 * });
 * ```
 */
export function useWidgetWebSocket({
  widgetId,
  widgetType,
  onUpdate,
  onError,
  enabled = true,
}: UseWidgetWebSocketOptions): UseWidgetWebSocketReturn {
  const token = useAuthStore((state) => state.token);
  const [isConnected, setIsConnected] = useState(false);
  const [lastData, setLastData] = useState<Record<string, unknown> | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs for callbacks to avoid re-subscriptions
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onErrorRef.current = onError;
  }, [onUpdate, onError]);

  // Connect to WebSocket
  useEffect(() => {
    if (!enabled) return;

    // Set token for authentication
    wsService.setToken(token);

    // Connect
    wsService.connect().catch((error) => {
      console.error('[useWidgetWebSocket] Connection failed:', error);
    });

    // Subscribe to connection changes
    const unsubConnection = wsService.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    // Set initial connection state
    setIsConnected(wsService.isConnected());

    return () => {
      unsubConnection();
    };
  }, [enabled, token]);

  // Subscribe to widget updates
  useEffect(() => {
    if (!enabled || !widgetId) return;

    const handleUpdate = (data: WidgetUpdateData) => {
      setLastData(data.data);
      setLastUpdated(new Date(data.timestamp));
      setLastError(null);
      onUpdateRef.current?.(data.data);
    };

    const handleError = (data: WidgetErrorData) => {
      setLastError(data.error);
      onErrorRef.current?.(data.error);
    };

    const unsubUpdate = wsService.subscribeWidget(widgetId, handleUpdate);
    const unsubError = wsService.subscribeError(widgetId, handleError);

    return () => {
      unsubUpdate();
      unsubError();
    };
  }, [enabled, widgetId]);

  // Subscribe to widget type updates
  useEffect(() => {
    if (!enabled || !widgetType) return;

    const handleTypeUpdate = (data: WidgetUpdateData) => {
      // Only process if we don't have a specific widgetId filter
      // or if the update matches our widgetId
      if (widgetId && data.widget_id !== widgetId) return;

      setLastData(data.data);
      setLastUpdated(new Date(data.timestamp));
      setLastError(null);
      onUpdateRef.current?.(data.data);
    };

    const unsub = wsService.subscribeType(widgetType, handleTypeUpdate);

    return () => {
      unsub();
    };
  }, [enabled, widgetType, widgetId]);

  const reconnect = useCallback(() => {
    wsService.disconnect();
    wsService.setToken(token);
    wsService.connect().catch((error) => {
      console.error('[useWidgetWebSocket] Reconnect failed:', error);
    });
  }, [token]);

  return {
    isConnected,
    lastData,
    lastError,
    lastUpdated,
    reconnect,
  };
}

/**
 * Hook for global WebSocket connection status.
 * Useful for displaying connection indicators in the UI.
 */
export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(wsService.isConnected());
  const [status, setStatus] = useState(wsService.getStatus());

  useEffect(() => {
    const unsub = wsService.onConnectionChange((connected) => {
      setIsConnected(connected);
      setStatus(wsService.getStatus());
    });

    // Initial state
    setIsConnected(wsService.isConnected());
    setStatus(wsService.getStatus());

    return unsub;
  }, []);

  return {
    isConnected,
    subscribedWidgets: status.subscribedWidgets,
    subscribedTypes: status.subscribedTypes,
    reconnectAttempts: status.reconnectAttempts,
  };
}

/**
 * Hook that combines HTTP fetching with WebSocket updates.
 * Fetches initial data via HTTP, then subscribes to WebSocket for updates.
 */
export function useWidgetData<T = Record<string, unknown>>({
  widgetId,
  widgetType,
  fetchFn,
  enabled = true,
  refetchInterval,
}: {
  widgetId?: number;
  widgetType?: string;
  fetchFn: () => Promise<T>;
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Use WebSocket for real-time updates
  const { isConnected, lastData: wsData, lastUpdated: wsUpdated } = useWidgetWebSocket({
    widgetId,
    widgetType,
    enabled: enabled && !!widgetId,
  });

  // Initial fetch
  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      const result = await fetchFn();
      setData(result);
      setLastFetched(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fetchFn]);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update data when WebSocket receives new data
  useEffect(() => {
    if (wsData && wsUpdated) {
      setData(wsData as T);
      setLastFetched(wsUpdated);
    }
  }, [wsData, wsUpdated]);

  // Optional polling as fallback when WebSocket is disconnected
  useEffect(() => {
    if (!refetchInterval || isConnected) return;

    const interval = setInterval(() => {
      fetchData();
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, isConnected, fetchData]);

  return {
    data,
    isLoading,
    error,
    lastFetched,
    isConnected,
    refetch: fetchData,
  };
}
