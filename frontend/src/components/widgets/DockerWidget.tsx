'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Text,
  Stack,
  Group,
  Loader,
  Center,
  Badge,
  Box,
  Progress,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Modal,
  Code,
  Menu,
  TextInput,
} from '@mantine/core';
import {
  IconBrandDocker,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconDotsVertical,
  IconFileText,
  IconCheck,
  IconX,
  IconSearch,
  IconPlugConnected,
} from '@tabler/icons-react';
import { dockerApi } from '@/lib/api';
import { notifications } from '@mantine/notifications';
import { useWidgetWebSocket } from '@/hooks/useWidgetWebSocket';
import { DockerWidgetSkeleton } from './WidgetSkeleton';

interface ContainerData {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string[];
  created: string;
  cpu_percent?: number;
  memory_usage?: number;
  memory_limit?: number;
  memory_percent?: number;
}

interface DockerData {
  containers: ContainerData[];
  summary: {
    total: number;
    running: number;
    stopped: number;
    paused: number;
  };
  host: string;
  fetched_at: string;
  error?: string;
}

interface DockerWidgetProps {
  widgetId?: number;
  config?: {
    host?: string;
    ssh_port?: number;
    ssh_user?: string;
    ssh_key?: string;
    ssh_password?: string;
    containers?: string;
    show_stats?: boolean;
    show_actions?: boolean;
    refresh_interval?: number;
  };
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  onDataReady?: (data: DockerData) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function DockerWidget({ widgetId, config = {}, size = 'medium', rowSpan = 1, onDataReady }: DockerWidgetProps) {
  const [data, setData] = useState<DockerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logsData, setLogsData] = useState<{ container: string; logs: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);
  const showActions = config.show_actions !== false;
  const refreshInterval = (config.refresh_interval || 30) * 1000;

  // WebSocket for real-time updates
  const { isConnected: wsConnected } = useWidgetWebSocket({
    widgetId: hasValidWidgetId ? widgetId : undefined,
    widgetType: 'docker',
    enabled: !!hasValidWidgetId,
    onUpdate: useCallback((wsData: Record<string, unknown>) => {
      setData(wsData as unknown as DockerData);
      setError(null);
      onDataReady?.(wsData as unknown as DockerData);
    }, [onDataReady]),
    onError: useCallback((errorMsg: string) => {
      setError(errorMsg);
    }, []),
  });

  const fetchData = useCallback(async () => {
    if (!hasValidWidgetId) {
      setError('Widget ID manquant - veuillez reconfigurer le widget');
      setLoading(false);
      return;
    }

    try {
      if (!data) setLoading(true);
      const response = await dockerApi.getWidgetData(widgetId!);

      if (response.error) {
        setError(response.error);
      } else {
        setData(response);
        setError(null);
        // Notify parent about data for export
        onDataReady?.(response);
      }
    } catch {
      setError('Impossible de récupérer les containers');
    } finally {
      setLoading(false);
    }
  }, [widgetId, hasValidWidgetId, data]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Poll slower when WebSocket is connected (it handles updates)
    const pollInterval = wsConnected ? refreshInterval * 2 : refreshInterval;
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, wsConnected]);

  const handleAction = async (action: 'start' | 'stop' | 'restart', containerName: string) => {
    if (!hasValidWidgetId) return;

    setActionLoading(containerName);
    try {
      let result;
      switch (action) {
        case 'start':
          result = await dockerApi.startContainer(widgetId!, containerName);
          break;
        case 'stop':
          result = await dockerApi.stopContainer(widgetId!, containerName);
          break;
        case 'restart':
          result = await dockerApi.restartContainer(widgetId!, containerName);
          break;
      }

      if (result.success) {
        notifications.show({
          title: 'Succès',
          message: `Container ${containerName} ${action === 'start' ? 'démarré' : action === 'stop' ? 'arrêté' : 'redémarré'}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        // Refresh data after action
        await fetchData();
      } else {
        notifications.show({
          title: 'Erreur',
          message: result.error || `Impossible de ${action} le container`,
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch {
      notifications.show({
        title: 'Erreur',
        message: `Impossible de ${action} le container`,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleShowLogs = async (containerName: string) => {
    if (!hasValidWidgetId) return;

    try {
      const result = await dockerApi.getLogs(widgetId!, containerName, 100);
      if (result.success) {
        setLogsData({ container: containerName, logs: result.logs });
        setLogsModalOpen(true);
      } else {
        notifications.show({
          title: 'Erreur',
          message: result.error || 'Impossible de récupérer les logs',
          color: 'red',
        });
      }
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de récupérer les logs',
        color: 'red',
      });
    }
  };

  if (loading && !data) {
    return <DockerWidgetSkeleton />;
  }

  if (error && !data) {
    return (
      <Center h="100%">
        <Text size="sm" c="dimmed">{error}</Text>
      </Center>
    );
  }

  if (!data) {
    return (
      <Center h="100%">
        <Text size="sm" c="dimmed">Configuration requise</Text>
      </Center>
    );
  }

  const showExtended = rowSpan >= 2 || size === 'large';

  // Filter containers based on search query
  const filteredContainers = data.containers.filter((container) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      container.name.toLowerCase().includes(query) ||
      container.image.toLowerCase().includes(query) ||
      container.status.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Stack gap="xs" h="100%">
        {/* Header */}
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <IconBrandDocker size={24} className="text-blue-500" />
            <Box>
              <Text fw={600} size="sm" lineClamp={1}>Docker</Text>
              <Text size="xs" c="dimmed">{data.host}</Text>
            </Box>
          </Group>

          <Group gap={4}>
            {wsConnected && (
              <Tooltip label="Mises à jour en temps réel">
                <IconPlugConnected size={14} className="text-green-500" />
              </Tooltip>
            )}
            <Badge size="sm" variant="light" color="green">
              {data.summary.running} running
            </Badge>
            {data.summary.stopped > 0 && (
              <Badge size="sm" variant="light" color="red">
                {data.summary.stopped} stopped
              </Badge>
            )}
          </Group>
        </Group>

        {/* Search input */}
        <TextInput
          placeholder="Rechercher un container..."
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

        {/* Containers list */}
        <ScrollArea style={{ flex: 1 }} scrollbarSize={4}>
          <Stack gap={6}>
            {filteredContainers.map((container) => {
              const isRunning = container.state === 'running';
              const isLoading = actionLoading === container.name;

              return (
                <Box
                  key={container.id}
                  p="xs"
                  style={{
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    border: '1px solid var(--mantine-color-dark-4)',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" mb={showExtended ? 4 : 0}>
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <Badge
                        size="xs"
                        variant="dot"
                        color={isRunning ? 'green' : 'red'}
                      >
                        {container.name}
                      </Badge>
                      {container.ports.length > 0 && (
                        <Text size="xs" c="dimmed">
                          :{container.ports.join(', :')}
                        </Text>
                      )}
                    </Group>

                    {showActions && (
                      <Group gap={2} wrap="nowrap">
                        {isRunning ? (
                          <>
                            <Tooltip label="Redémarrer">
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="yellow"
                                onClick={() => handleAction('restart', container.name)}
                                loading={isLoading}
                                disabled={!!actionLoading}
                              >
                                <IconRefresh size={14} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Arrêter">
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() => handleAction('stop', container.name)}
                                loading={isLoading}
                                disabled={!!actionLoading}
                              >
                                <IconPlayerStop size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        ) : (
                          <Tooltip label="Démarrer">
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="green"
                              onClick={() => handleAction('start', container.name)}
                              loading={isLoading}
                              disabled={!!actionLoading}
                            >
                              <IconPlayerPlay size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon size="xs" variant="subtle" color="gray">
                              <IconDotsVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconFileText size={14} />}
                              onClick={() => handleShowLogs(container.name)}
                            >
                              Voir les logs
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    )}
                  </Group>

                  {/* Stats */}
                  {showExtended && isRunning && container.cpu_percent !== undefined && (
                    <Stack gap={4} mt={6}>
                      <Group gap="xs" wrap="nowrap">
                        <Text size="xs" c="dimmed" w={40}>CPU</Text>
                        <Box style={{ flex: 1 }}>
                          <Progress
                            size="xs"
                            value={container.cpu_percent}
                            color={container.cpu_percent > 80 ? 'red' : container.cpu_percent > 50 ? 'yellow' : 'blue'}
                          />
                        </Box>
                        <Text size="xs" w={45} ta="right">{container.cpu_percent.toFixed(1)}%</Text>
                      </Group>

                      {container.memory_percent !== undefined && (
                        <Group gap="xs" wrap="nowrap">
                          <Text size="xs" c="dimmed" w={40}>RAM</Text>
                          <Box style={{ flex: 1 }}>
                            <Progress
                              size="xs"
                              value={container.memory_percent}
                              color={container.memory_percent > 80 ? 'red' : container.memory_percent > 50 ? 'yellow' : 'green'}
                            />
                          </Box>
                          <Text size="xs" w={45} ta="right">
                            {container.memory_usage ? formatBytes(container.memory_usage) : `${container.memory_percent.toFixed(1)}%`}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  )}

                  {/* Status for non-extended view */}
                  {!showExtended && (
                    <Text size="xs" c="dimmed" lineClamp={1} mt={2}>
                      {container.status}
                    </Text>
                  )}
                </Box>
              );
            })}

            {filteredContainers.length === 0 && (
              <Center py="md">
                <Text size="sm" c="dimmed">
                  {searchQuery ? `Aucun container correspondant à "${searchQuery}"` : 'Aucun container trouvé'}
                </Text>
              </Center>
            )}
          </Stack>
        </ScrollArea>
      </Stack>

      {/* Logs Modal */}
      <Modal
        opened={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        title={`Logs - ${logsData?.container}`}
        size="xl"
      >
        <ScrollArea h={400}>
          <Code block style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
            {logsData?.logs || 'Aucun log disponible'}
          </Code>
        </ScrollArea>
      </Modal>
    </>
  );
}
