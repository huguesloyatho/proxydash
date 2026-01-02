'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Text,
  Stack,
  Group,
  Loader,
  Center,
  Badge,
  Box,
  ScrollArea,
  ActionIcon,
  Tooltip,
  TextInput,
  Code,
  Select,
} from '@mantine/core';
import {
  IconFileText,
  IconRefresh,
  IconSearch,
  IconX,
  IconPlayerPause,
  IconPlayerPlay,
  IconArrowDown,
  IconContainer,
} from '@tabler/icons-react';
import { logsApi } from '@/lib/api';
import { LogsWidgetSkeleton } from './WidgetSkeleton';

interface LogEntry {
  raw: string;
  message: string;
  timestamp?: string;
  level: 'error' | 'warning' | 'info' | 'debug' | 'default';
}

interface LogsData {
  success: boolean;
  container: string;
  host: string;
  logs: LogEntry[];
  line_count: number;
  max_lines: number;
  fetched_at: string;
  error?: string;
}

interface ContainerInfo {
  name: string;
  state: string;
  status?: string;
}

interface LogsWidgetProps {
  widgetId?: number;
  config?: {
    host?: string;
    ssh_port?: number;
    ssh_user?: string;
    ssh_key?: string;
    ssh_password?: string;
    container_name?: string;
    max_lines?: number;
    auto_scroll?: boolean;
    show_timestamps?: boolean;
    filter_pattern?: string;
    refresh_interval?: number;
  };
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  onDataReady?: (data: LogsData) => void;
}

const levelColors: Record<string, string> = {
  error: 'red',
  warning: 'yellow',
  info: 'blue',
  debug: 'gray',
  default: 'dark',
};

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp.substring(11, 19); // Extract time from ISO format
  }
}

export function LogsWidget({ widgetId, config = {}, size = 'medium', rowSpan = 1, onDataReady }: LogsWidgetProps) {
  const [data, setData] = useState<LogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(config.auto_scroll !== false);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(config.container_name || null);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);
  const refreshInterval = (config.refresh_interval || 5) * 1000;
  const showTimestamps = config.show_timestamps !== false;

  // Fetch available containers
  const fetchContainers = useCallback(async () => {
    if (!hasValidWidgetId) return;

    try {
      setLoadingContainers(true);
      const response = await logsApi.getContainers(widgetId!);
      if (response.containers) {
        setContainers(response.containers);
        // Auto-select first container if none selected
        if (!selectedContainer && response.containers.length > 0) {
          setSelectedContainer(response.containers[0].name);
        }
      }
    } catch {
      console.error('Failed to fetch containers');
    } finally {
      setLoadingContainers(false);
    }
  }, [widgetId, hasValidWidgetId, selectedContainer]);

  const fetchData = useCallback(async () => {
    if (!hasValidWidgetId || isPaused) {
      if (!hasValidWidgetId) {
        setError('Widget ID manquant - veuillez reconfigurer le widget');
        setLoading(false);
      }
      return;
    }

    if (!selectedContainer) {
      setLoading(false);
      return;
    }

    try {
      if (!data) setLoading(true);
      const response = await logsApi.getWidgetData(widgetId!, selectedContainer);

      if (response.error || !response.success) {
        setError(response.error || 'Erreur lors de la récupération des logs');
      } else {
        setData(response);
        setError(null);
        // Notify parent about data for export
        onDataReady?.(response);

        // Auto-scroll to bottom
        if (autoScroll && viewportRef.current) {
          setTimeout(() => {
            if (viewportRef.current) {
              viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
            }
          }, 50);
        }
      }
    } catch {
      setError('Impossible de récupérer les logs');
    } finally {
      setLoading(false);
    }
  }, [widgetId, hasValidWidgetId, isPaused, data, autoScroll, selectedContainer]);

  // Fetch containers on mount
  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  // Fetch logs when container changes
  useEffect(() => {
    if (selectedContainer) {
      setData(null);
      setLoading(true);
      fetchData();
    }
  }, [selectedContainer]);

  useEffect(() => {
    if (selectedContainer) {
      fetchData();
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, selectedContainer]);

  const handleManualRefresh = () => {
    setIsPaused(false);
    fetchData();
  };

  const scrollToBottom = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  };

  // Prepare container options for Select
  const containerOptions = containers.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.state})`,
  }));

  // Filter logs based on search query
  const filteredLogs = data?.logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(query) ||
      (log.timestamp && log.timestamp.toLowerCase().includes(query))
    );
  }) || [];

  const showExtended = rowSpan >= 2 || size === 'large';

  // Show container selector if no container selected or loading containers
  if (!selectedContainer || containers.length === 0) {
    return (
      <Stack gap="sm" h="100%" justify="center" align="center">
        <IconContainer size={32} style={{ opacity: 0.5 }} />
        {loadingContainers ? (
          <>
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Chargement des containers...</Text>
          </>
        ) : containers.length === 0 ? (
          <>
            <Text size="sm" c="dimmed">Aucun container trouvé</Text>
            <Text size="xs" c="dimmed">Vérifiez la configuration du serveur</Text>
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">Sélectionnez un container</Text>
            <Select
              placeholder="Choisir un container"
              data={containerOptions}
              value={selectedContainer}
              onChange={setSelectedContainer}
              searchable
              style={{ width: 200 }}
            />
          </>
        )}
      </Stack>
    );
  }

  if (loading && !data) {
    return <LogsWidgetSkeleton />;
  }

  if (error && !data) {
    return (
      <Center h="100%">
        <Text size="sm" c="dimmed">{error}</Text>
      </Center>
    );
  }

  return (
    <Stack gap="xs" h="100%">
      {/* Header with container selector */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <IconFileText size={20} style={{ flexShrink: 0, color: 'var(--mantine-color-green-5)' }} />
          <Select
            size="xs"
            placeholder="Container"
            data={containerOptions}
            value={selectedContainer}
            onChange={setSelectedContainer}
            searchable
            style={{ flex: 1, minWidth: 100, maxWidth: 200 }}
            styles={{
              input: { fontWeight: 600 },
            }}
          />
        </Group>

        <Group gap={4}>
          <Badge size="sm" variant="light" color={data?.success ? 'green' : 'red'}>
            {data?.line_count || 0} lignes
          </Badge>
          <Tooltip label={isPaused ? 'Reprendre' : 'Pause'}>
            <ActionIcon
              size="xs"
              variant={isPaused ? 'filled' : 'subtle'}
              color={isPaused ? 'yellow' : 'gray'}
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Rafraîchir">
            <ActionIcon size="xs" variant="subtle" onClick={handleManualRefresh}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Search input */}
      {showExtended && (
        <TextInput
          placeholder="Filtrer les logs..."
          size="xs"
          leftSection={<IconSearch size={14} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          rightSection={
            searchQuery && (
              <ActionIcon size="xs" variant="subtle" onClick={() => setSearchQuery('')}>
                <IconX size={12} />
              </ActionIcon>
            )
          }
        />
      )}

      {/* Logs content */}
      <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ScrollArea
          ref={scrollAreaRef}
          viewportRef={viewportRef}
          style={{ height: '100%' }}
          scrollbarSize={4}
          type="always"
        >
          <Code
            block
            style={{
              backgroundColor: 'var(--mantine-color-dark-8)',
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              padding: '8px',
            }}
          >
            {filteredLogs.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center">
                {searchQuery ? `Aucun log correspondant à "${searchQuery}"` : 'Aucun log disponible'}
              </Text>
            ) : (
              filteredLogs.map((log, index) => (
                <Box
                  key={index}
                  style={{
                    borderLeft: `2px solid var(--mantine-color-${levelColors[log.level]}-6)`,
                    paddingLeft: 6,
                    marginBottom: 2,
                  }}
                >
                  {showTimestamps && log.timestamp && (
                    <Text
                      component="span"
                      size="xs"
                      c="dimmed"
                      style={{ marginRight: 8, fontFamily: 'monospace' }}
                    >
                      {formatTimestamp(log.timestamp)}
                    </Text>
                  )}
                  <Text
                    component="span"
                    size="xs"
                    c={log.level === 'error' ? 'red' : log.level === 'warning' ? 'yellow' : undefined}
                    style={{ fontFamily: 'monospace' }}
                  >
                    {log.message}
                  </Text>
                </Box>
              ))
            )}
          </Code>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {showExtended && (
          <Tooltip label="Aller en bas">
            <ActionIcon
              size="sm"
              variant="filled"
              color="dark"
              style={{
                position: 'absolute',
                bottom: 8,
                right: 16,
                opacity: 0.8,
              }}
              onClick={scrollToBottom}
            >
              <IconArrowDown size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>

      {/* Footer with last update */}
      {showExtended && data?.fetched_at && (
        <Text size="xs" c="dimmed" ta="right">
          Mis à jour: {new Date(data.fetched_at).toLocaleTimeString('fr-FR')}
        </Text>
      )}
    </Stack>
  );
}
