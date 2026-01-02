'use client';

import { useEffect, useState } from 'react';
import { Text, Stack, Group, Loader, Center, Progress, Badge, Tooltip, RingProgress } from '@mantine/core';
import {
  IconServer,
  IconCpu,
  IconDeviceDesktop,
  IconBox,
  IconPlayerPlay,
  IconPlayerStop,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { widgetsApi } from '@/lib/api';

interface NodeData {
  node: string;
  status: string;
  uptime: number;
  cpu: number;
  memory: { used: number; total: number };
  disk: { used: number; total: number };
}

interface VMData {
  vmid: number;
  name: string;
  status: string;
  type: string;
  cpu: number;
  memory: { used: number; total: number };
  uptime: number;
  node: string;
}

interface SummaryData {
  total_vms: number;
  running_vms: number;
  stopped_vms: number;
  total_containers: number;
  running_containers: number;
  stopped_containers: number;
  nodes: { online: number; total: number };
}

interface ProxmoxWidgetProps {
  widgetId?: number;  // Optional - if not provided, uses config directly
  widgetType: 'proxmox_node' | 'proxmox_vm' | 'proxmox_summary';
  config?: {
    proxmox_host?: string;
    proxmox_token_id?: string;
    proxmox_token_secret?: string;
    node_name?: string;
    vm_id?: number;
  };
  size?: 'small' | 'medium' | 'large';
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}j ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function NodeWidget({ data, size }: { data: NodeData; size: string }) {
  const memPercent = (data.memory.used / data.memory.total) * 100;
  const diskPercent = (data.disk.used / data.disk.total) * 100;

  return (
    <Stack gap="xs" h="100%">
      <Group justify="space-between">
        <Group gap="xs">
          <IconServer size={18} className="text-green-500" />
          <Text fw={600} size="sm">{data.node}</Text>
        </Group>
        <Badge size="xs" color={data.status === 'online' ? 'green' : 'red'}>
          {data.status}
        </Badge>
      </Group>

      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">CPU</Text>
          <Text size="xs">{(data.cpu * 100).toFixed(1)}%</Text>
        </Group>
        <Progress value={data.cpu * 100} size="sm" color={data.cpu > 0.8 ? 'red' : 'blue'} />
      </Stack>

      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Mémoire</Text>
          <Text size="xs">{formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}</Text>
        </Group>
        <Progress value={memPercent} size="sm" color={memPercent > 80 ? 'red' : 'teal'} />
      </Stack>

      {size !== 'small' && (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Disque</Text>
            <Text size="xs">{formatBytes(data.disk.used)} / {formatBytes(data.disk.total)}</Text>
          </Group>
          <Progress value={diskPercent} size="sm" color={diskPercent > 80 ? 'red' : 'grape'} />
        </Stack>
      )}

      {size === 'large' && (
        <Text size="xs" c="dimmed" ta="center">
          Uptime: {formatUptime(data.uptime)}
        </Text>
      )}
    </Stack>
  );
}

function VMWidget({ data, size }: { data: VMData; size: string }) {
  const isRunning = data.status === 'running';
  const memPercent = data.memory.total > 0 ? (data.memory.used / data.memory.total) * 100 : 0;

  return (
    <Stack gap="xs" h="100%">
      <Group justify="space-between">
        <Group gap="xs">
          {data.type === 'qemu' ? (
            <IconDeviceDesktop size={18} className="text-blue-500" />
          ) : (
            <IconBox size={18} className="text-orange-500" />
          )}
          <Text fw={600} size="sm" lineClamp={1}>{data.name}</Text>
        </Group>
        <Badge
          size="xs"
          color={isRunning ? 'green' : 'gray'}
          leftSection={isRunning ? <IconPlayerPlay size={10} /> : <IconPlayerStop size={10} />}
        >
          {data.status}
        </Badge>
      </Group>

      {isRunning && (
        <>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">CPU</Text>
              <Text size="xs">{(data.cpu * 100).toFixed(1)}%</Text>
            </Group>
            <Progress value={data.cpu * 100} size="sm" color="blue" />
          </Stack>

          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Mémoire</Text>
              <Text size="xs">{memPercent.toFixed(0)}%</Text>
            </Group>
            <Progress value={memPercent} size="sm" color="teal" />
          </Stack>

          {size !== 'small' && (
            <Text size="xs" c="dimmed" ta="center">
              Uptime: {formatUptime(data.uptime)}
            </Text>
          )}
        </>
      )}

      {!isRunning && (
        <Center flex={1}>
          <Text size="sm" c="dimmed">VM arrêtée</Text>
        </Center>
      )}
    </Stack>
  );
}

function SummaryWidget({ data, size }: { data: SummaryData; size: string }) {
  const totalRunning = data.running_vms + data.running_containers;
  const totalStopped = data.stopped_vms + data.stopped_containers;
  const total = totalRunning + totalStopped;

  return (
    <Stack gap="md" align="center" justify="center" h="100%">
      <Group gap="xl">
        <Tooltip label="Noeuds en ligne">
          <Stack gap={0} align="center">
            <RingProgress
              size={size === 'small' ? 50 : 70}
              thickness={size === 'small' ? 4 : 6}
              sections={[
                { value: (data.nodes.online / data.nodes.total) * 100, color: 'green' },
              ]}
              label={
                <Center>
                  <IconServer size={size === 'small' ? 16 : 20} />
                </Center>
              }
            />
            <Text size="xs" c="dimmed">{data.nodes.online}/{data.nodes.total}</Text>
          </Stack>
        </Tooltip>

        <Tooltip label="VMs en cours d'exécution">
          <Stack gap={0} align="center">
            <RingProgress
              size={size === 'small' ? 50 : 70}
              thickness={size === 'small' ? 4 : 6}
              sections={[
                { value: data.total_vms > 0 ? (data.running_vms / data.total_vms) * 100 : 0, color: 'blue' },
              ]}
              label={
                <Center>
                  <IconDeviceDesktop size={size === 'small' ? 16 : 20} />
                </Center>
              }
            />
            <Text size="xs" c="dimmed">{data.running_vms}/{data.total_vms}</Text>
          </Stack>
        </Tooltip>

        <Tooltip label="Conteneurs en cours d'exécution">
          <Stack gap={0} align="center">
            <RingProgress
              size={size === 'small' ? 50 : 70}
              thickness={size === 'small' ? 4 : 6}
              sections={[
                { value: data.total_containers > 0 ? (data.running_containers / data.total_containers) * 100 : 0, color: 'orange' },
              ]}
              label={
                <Center>
                  <IconBox size={size === 'small' ? 16 : 20} />
                </Center>
              }
            />
            <Text size="xs" c="dimmed">{data.running_containers}/{data.total_containers}</Text>
          </Stack>
        </Tooltip>
      </Group>

      {size !== 'small' && (
        <Group gap="md">
          <Badge color="green" variant="light" leftSection={<IconPlayerPlay size={12} />}>
            {totalRunning} en cours
          </Badge>
          {totalStopped > 0 && (
            <Badge color="gray" variant="light" leftSection={<IconPlayerStop size={12} />}>
              {totalStopped} arrêtés
            </Badge>
          )}
        </Group>
      )}
    </Stack>
  );
}

export function ProxmoxWidget({ widgetId, widgetType, config = {}, size = 'medium' }: ProxmoxWidgetProps) {
  const [data, setData] = useState<NodeData | VMData | SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!hasValidWidgetId) {
          setError('Widget ID manquant - veuillez reconfigurer le widget');
          setLoading(false);
          return;
        }

        if (!data) setLoading(true);
        const response = await widgetsApi.getData(widgetId!);

        if (response.success !== false && response.data) {
          setData(response.data);
          setError(null);
        } else {
          setError(response.error || 'Erreur de chargement');
        }
      } catch {
        setError('Impossible de charger les données Proxmox');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30 * 1000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, hasValidWidgetId]);

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconAlertTriangle size={24} className="text-orange-500" />
          <Text size="xs" c="dimmed" ta="center">
            {error}
          </Text>
        </Stack>
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

  switch (widgetType) {
    case 'proxmox_node':
      return <NodeWidget data={data as NodeData} size={size} />;
    case 'proxmox_vm':
      return <VMWidget data={data as VMData} size={size} />;
    case 'proxmox_summary':
      return <SummaryWidget data={data as SummaryData} size={size} />;
    default:
      return null;
  }
}
