'use client';

import { Tooltip, Badge, Group, Text } from '@mantine/core';
import { IconPlugConnected, IconPlugConnectedX, IconRefresh } from '@tabler/icons-react';
import { useWebSocketStatus } from '@/hooks/useWidgetWebSocket';
import { wsService } from '@/lib/websocket';

interface WebSocketIndicatorProps {
  showDetails?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Indicator component showing WebSocket connection status.
 * Shows green when connected, red when disconnected.
 */
export function WebSocketIndicator({
  showDetails = false,
  size = 'xs',
}: WebSocketIndicatorProps) {
  const { isConnected, subscribedWidgets, reconnectAttempts } = useWebSocketStatus();

  const handleReconnect = () => {
    wsService.disconnect();
    wsService.connect().catch(console.error);
  };

  if (showDetails) {
    return (
      <Group gap="xs">
        <Tooltip
          label={
            isConnected
              ? `Connecté - ${subscribedWidgets.length} widget(s) abonné(s)`
              : `Déconnecté - Tentative ${reconnectAttempts}/5`
          }
        >
          <Badge
            size={size}
            color={isConnected ? 'green' : 'red'}
            variant="dot"
            leftSection={
              isConnected ? (
                <IconPlugConnected size={12} />
              ) : (
                <IconPlugConnectedX size={12} />
              )
            }
          >
            {isConnected ? 'Live' : 'Offline'}
          </Badge>
        </Tooltip>
        {!isConnected && (
          <Tooltip label="Reconnecter">
            <IconRefresh
              size={14}
              style={{ cursor: 'pointer' }}
              onClick={handleReconnect}
            />
          </Tooltip>
        )}
      </Group>
    );
  }

  return (
    <Tooltip
      label={
        isConnected
          ? `WebSocket connecté - ${subscribedWidgets.length} widget(s)`
          : `WebSocket déconnecté`
      }
    >
      <Badge
        size={size}
        color={isConnected ? 'green' : 'red'}
        variant="dot"
        style={{ cursor: 'pointer' }}
        onClick={!isConnected ? handleReconnect : undefined}
      >
        {isConnected ? 'WS' : '!WS'}
      </Badge>
    </Tooltip>
  );
}
