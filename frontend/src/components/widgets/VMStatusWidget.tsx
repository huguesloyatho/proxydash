'use client';

import { useEffect, useState, useCallback } from 'react';
import { Text, Stack, Group, Loader, Center, Badge, Image, Tooltip, Box, Progress, ScrollArea } from '@mantine/core';
import { IconServer, IconCheck, IconX, IconNetwork, IconCpu, IconDeviceSdCard, IconBrandDocker, IconPlugConnected } from '@tabler/icons-react';
import { widgetsApi } from '@/lib/api';
import { useWidgetWebSocket } from '@/hooks/useWidgetWebSocket';
import { VMStatusWidgetSkeleton } from './WidgetSkeleton';

interface Container {
  id: string;
  name: string;
  status: string;
  ports: string[];
}

interface VMStatusData {
  name: string;
  host: string;
  is_online: boolean;
  ports: Record<number, boolean>;
  icon_url?: string;
  description?: string;
  checked_at: string;
  // SSH metrics
  ssh_enabled?: boolean;
  ssh_error?: string;
  cpu_percent?: number;
  memory?: {
    total: number;
    used: number;
    percent: number;
  };
  disk?: {
    total: number;
    used: number;
    percent: number;
  };
  containers?: Container[];
}

interface VMStatusWidgetProps {
  widgetId?: number;  // Optional - if not provided or invalid, uses config directly
  config?: {
    name?: string;
    host?: string;
    check_ports?: string;
    icon_url?: string;
    description?: string;
    ssh_enabled?: boolean;
    ssh_port?: number;
    ssh_user?: string;
    ssh_key?: string;
    ssh_password?: string;
    show_docker?: boolean;
  };
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  onDataReady?: (data: VMStatusData) => void;
}

const portLabels: Record<number, string> = {
  22: 'SSH',
  80: 'HTTP',
  443: 'HTTPS',
  3389: 'RDP',
  5900: 'VNC',
  8080: 'Web',
  3306: 'MySQL',
  5432: 'PostgreSQL',
  27017: 'MongoDB',
  6379: 'Redis',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function VMStatusWidget({ widgetId, config = {}, size = 'medium', rowSpan = 1, onDataReady }: VMStatusWidgetProps) {
  const [data, setData] = useState<VMStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);

  // WebSocket for real-time updates
  const { isConnected: wsConnected } = useWidgetWebSocket({
    widgetId: hasValidWidgetId ? widgetId : undefined,
    widgetType: 'vm_status',
    enabled: !!hasValidWidgetId,
    onUpdate: useCallback((wsData: Record<string, unknown>) => {
      setData(wsData as unknown as VMStatusData);
      setError(null);
      onDataReady?.(wsData as unknown as VMStatusData);
    }, [onDataReady]),
    onError: useCallback((errorMsg: string) => {
      setError(errorMsg);
    }, []),
  });

  // Fetch initial data and poll as fallback when WebSocket is not connected
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!data) setLoading(true);

        if (!hasValidWidgetId) {
          // No valid widget ID - show configuration message
          setError('Widget ID manquant - veuillez reconfigurer le widget');
          setLoading(false);
          return;
        }

        // Always use the widget ID endpoint for DB-backed widgets
        const response = await widgetsApi.getData(widgetId!);

        if (response.data?.error) {
          setError(response.data.error);
        } else {
          setData(response.data);
          setError(null);
          // Notify parent about data for export
          onDataReady?.(response.data);
        }
      } catch {
        setError('Impossible de vérifier le statut');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Poll only when WebSocket is not connected (fallback)
    // When WS is connected, updates come via WebSocket
    const pollInterval = wsConnected ? 60000 : 30000; // Slower poll when WS connected
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, hasValidWidgetId, wsConnected]);

  if (loading && !data) {
    return <VMStatusWidgetSkeleton />;
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

  const ports = Object.entries(data.ports || {});
  const hasSSHMetrics = data.ssh_enabled && !data.ssh_error;
  const showExtended = rowSpan >= 2 || size === 'large';

  return (
    <Stack gap="xs" h="100%">
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          {data.icon_url ? (
            <Image
              src={data.icon_url}
              alt={data.name}
              w={24}
              h={24}
              fit="contain"
              fallbackSrc="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/default.svg"
            />
          ) : (
            <IconServer size={24} className={data.is_online ? 'text-green-500' : 'text-red-500'} />
          )}
          <Box>
            <Text fw={600} size="sm" lineClamp={1}>{data.name}</Text>
            <Text size="xs" c="dimmed">{data.host}</Text>
          </Box>
        </Group>

<Group gap={4}>
          {wsConnected && (
            <Tooltip label="Mises à jour en temps réel">
              <IconPlugConnected size={14} className="text-green-500" />
            </Tooltip>
          )}
          <Badge
            size="lg"
            variant="light"
            color={data.is_online ? 'green' : 'red'}
            leftSection={data.is_online ? <IconCheck size={12} /> : <IconX size={12} />}
          >
            {data.is_online ? 'En ligne' : 'Hors ligne'}
          </Badge>
        </Group>
      </Group>

      {data.description && size !== 'small' && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {data.description}
        </Text>
      )}

      {/* SSH Metrics */}
      {hasSSHMetrics && (
        <Stack gap={6}>
          {/* CPU */}
          {data.cpu_percent !== null && data.cpu_percent !== undefined && (
            <Group gap="xs" wrap="nowrap">
              <IconCpu size={14} className="text-blue-500" />
              <Box style={{ flex: 1 }}>
                <Group justify="space-between" mb={2}>
                  <Text size="xs">CPU</Text>
                  <Text size="xs" fw={500}>{data.cpu_percent}%</Text>
                </Group>
                <Progress
                  size="xs"
                  value={data.cpu_percent}
                  color={data.cpu_percent > 80 ? 'red' : data.cpu_percent > 60 ? 'yellow' : 'blue'}
                />
              </Box>
            </Group>
          )}

          {/* Memory */}
          {data.memory && (
            <Group gap="xs" wrap="nowrap">
              <IconDeviceSdCard size={14} className="text-green-500" />
              <Box style={{ flex: 1 }}>
                <Group justify="space-between" mb={2}>
                  <Text size="xs">RAM</Text>
                  <Text size="xs" fw={500}>
                    {formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}
                  </Text>
                </Group>
                <Progress
                  size="xs"
                  value={data.memory.percent}
                  color={data.memory.percent > 80 ? 'red' : data.memory.percent > 60 ? 'yellow' : 'green'}
                />
              </Box>
            </Group>
          )}

          {/* Disk */}
          {data.disk && showExtended && (
            <Group gap="xs" wrap="nowrap">
              <IconDeviceSdCard size={14} className="text-orange-500" />
              <Box style={{ flex: 1 }}>
                <Group justify="space-between" mb={2}>
                  <Text size="xs">Disque</Text>
                  <Text size="xs" fw={500}>
                    {formatBytes(data.disk.used)} / {formatBytes(data.disk.total)}
                  </Text>
                </Group>
                <Progress
                  size="xs"
                  value={data.disk.percent}
                  color={data.disk.percent > 90 ? 'red' : data.disk.percent > 75 ? 'yellow' : 'orange'}
                />
              </Box>
            </Group>
          )}
        </Stack>
      )}

      {/* SSH Error */}
      {data.ssh_enabled && data.ssh_error && (
        <Text size="xs" c="red" lineClamp={1}>
          {data.ssh_error}
        </Text>
      )}

      {/* Docker Containers */}
      {hasSSHMetrics && data.containers && data.containers.length > 0 && (
        <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Group gap={4} mb={4}>
            <IconBrandDocker size={14} className="text-blue-400" />
            <Text size="xs" fw={500}>
              Containers ({data.containers.filter(c => c.status.includes('Up')).length}/{data.containers.length})
            </Text>
          </Group>
          {showExtended ? (
            <ScrollArea style={{ flex: 1 }} scrollbarSize={4}>
              <Stack gap={4}>
                {data.containers.map((container) => (
                  <Group key={container.id} gap={4} wrap="nowrap">
                    <Badge
                      size="xs"
                      variant="dot"
                      color={container.status.includes('Up') ? 'green' : 'red'}
                    >
                      {container.name}
                    </Badge>
                    {container.ports.length > 0 && (
                      <Text size="xs" c="dimmed">
                        :{container.ports.join(', :')}
                      </Text>
                    )}
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          ) : (
            <Group gap={4} wrap="wrap">
              {data.containers.slice(0, 6).map((container) => (
                <Tooltip key={container.id} label={`${container.name} - ${container.status}`}>
                  <Badge
                    size="xs"
                    variant="dot"
                    color={container.status.includes('Up') ? 'green' : 'red'}
                  >
                    {container.name.length > 10 ? container.name.substring(0, 10) + '...' : container.name}
                  </Badge>
                </Tooltip>
              ))}
              {data.containers.length > 6 && (
                <Badge size="xs" variant="light" color="gray">
                  +{data.containers.length - 6}
                </Badge>
              )}
            </Group>
          )}
        </Box>
      )}

      {/* Port status */}
      {ports.length > 0 && !hasSSHMetrics && size !== 'small' && (
        <Group gap={6} mt="auto">
          <IconNetwork size={14} className="text-gray-400" />
          {ports.map(([port, isOpen]) => (
            <Tooltip
              key={port}
              label={`Port ${port} (${portLabels[Number(port)] || 'Custom'})`}
            >
              <Badge
                size="xs"
                variant="light"
                color={isOpen ? 'green' : 'red'}
              >
                {portLabels[Number(port)] || port}
              </Badge>
            </Tooltip>
          ))}
        </Group>
      )}
    </Stack>
  );
}
