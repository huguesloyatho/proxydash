'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Group,
  Stack,
  Badge,
  Progress,
  Tabs,
  ScrollArea,
  Loader,
  Center,
  Tooltip,
  ActionIcon,
  Table,
  ThemeIcon,
  Paper,
  SimpleGrid,
  RingProgress,
} from '@mantine/core';
import {
  IconShield,
  IconShieldOff,
  IconAlertTriangle,
  IconBan,
  IconRefresh,
  IconWorld,
  IconFlag,
  IconActivity,
  IconCloudLock,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { widgetsApi } from '@/lib/api';
import { CrowdSecWidgetSkeleton } from './WidgetSkeleton';

interface CrowdSecWidgetProps {
  widgetId?: number;
  config: {
    api_url?: string;
    api_key?: string;
    max_decisions?: number;
    max_alerts?: number;
    show_metrics?: boolean;
    show_decisions?: boolean;
    show_alerts?: boolean;
    show_countries?: boolean;
    refresh_interval?: number;
  };
  size?: 'small' | 'medium' | 'large';
  onDataReady?: (data: CrowdSecData) => void;
}

interface Decision {
  id: number;
  origin: string;
  scope: string;
  value: string;
  type: string;
  duration: string;
  scenario: string;
}

interface Alert {
  id: number;
  scenario: string;
  message: string;
  ip: string;
  country: string;
  as_name: string;
  created_at: string;
  events_count: number;
}

interface Metrics {
  total_decisions: number;
  total_alerts: number;
  by_origin: Record<string, number>;
  by_action: Record<string, number>;
  by_country: Record<string, number>;
  by_scenario: Record<string, number>;
}

interface CrowdSecData {
  decisions: Decision[];
  decisions_count: number;
  alerts: Alert[];
  alerts_count: number;
  metrics: Metrics;
  error?: string;
  fetched_at: string;
}

// Country code to flag emoji
function countryToFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'unknown' || countryCode.length !== 2) {
    return '';
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Format duration string (4h0m0s -> 4h)
function formatDuration(duration: string): string {
  if (!duration) return '-';
  // Remove zero values
  return duration
    .replace(/0h/g, '')
    .replace(/0m/g, '')
    .replace(/0s/g, '')
    .trim() || '-';
}

// Format date
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// Origin colors
function getOriginColor(origin: string): string {
  switch (origin.toLowerCase()) {
    case 'crowdsec':
      return 'blue';
    case 'capi':
      return 'violet';
    case 'console':
      return 'cyan';
    default:
      return 'gray';
  }
}

// Scenario to short name
function shortScenario(scenario: string): string {
  if (!scenario) return 'unknown';
  // Remove common prefixes
  return scenario
    .replace('crowdsecurity/', '')
    .replace('LePresidente/', '')
    .replace('-', ' ')
    .slice(0, 30);
}

export function CrowdSecWidget({ widgetId, config, size = 'medium', onDataReady }: CrowdSecWidgetProps) {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const refreshInterval = (config.refresh_interval || 60) * 1000;
  const hasValidWidgetId = !!(widgetId && widgetId > 0 && Number.isFinite(widgetId));

  const { data, isLoading, error, refetch, isFetching } = useQuery<CrowdSecData>({
    queryKey: ['crowdsec-widget', widgetId],
    queryFn: async () => {
      if (!widgetId) {
        throw new Error('Widget ID manquant');
      }
      const response = await widgetsApi.getData(widgetId);
      // Notify parent about data for export
      if (response.data && !response.data.error) {
        onDataReady?.(response.data);
      }
      return response.data;
    },
    refetchInterval: refreshInterval,
    enabled: hasValidWidgetId,
  });

  if (!hasValidWidgetId) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconShield size={24} className="text-gray-400" />
          <Text size="sm" c="dimmed">Widget ID manquant - veuillez reconfigurer</Text>
        </Stack>
      </Center>
    );
  }

  if (!config.api_url || !config.api_key) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconShieldOff size={32} className="text-gray-400" />
          <Text size="sm" c="dimmed">Configuration CrowdSec requise</Text>
        </Stack>
      </Center>
    );
  }

  if (isLoading) {
    return <CrowdSecWidgetSkeleton />;
  }

  if (error || data?.error) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconAlertTriangle size={32} className="text-red-400" />
          <Text size="sm" c="red">{data?.error || 'Erreur de connexion'}</Text>
        </Stack>
      </Center>
    );
  }

  const metrics = data?.metrics || {
    total_decisions: 0,
    total_alerts: 0,
    by_origin: {},
    by_action: {},
    by_country: {},
    by_scenario: {},
  };

  const decisions = data?.decisions || [];
  const alerts = data?.alerts || [];

  // Calculate origin percentages
  const totalOrigins = Object.values(metrics.by_origin).reduce((a, b) => a + b, 0);
  const crowdsecCount = metrics.by_origin['crowdsec'] || 0;
  const capiCount = metrics.by_origin['CAPI'] || 0;
  const crowdsecPercent = totalOrigins > 0 ? Math.round((crowdsecCount / totalOrigins) * 100) : 0;
  const capiPercent = totalOrigins > 0 ? Math.round((capiCount / totalOrigins) * 100) : 0;

  return (
    <Box h="100%" className="flex flex-col">
      {/* Header */}
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconShield size={14} />
          </ThemeIcon>
          <Text size="sm" fw={500}>CrowdSec</Text>
        </Group>
        <Group gap="xs">
          {isFetching && <Loader size="xs" />}
          <Tooltip label="Rafraîchir">
            <ActionIcon variant="subtle" size="xs" onClick={() => refetch()}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} className="flex-1 flex flex-col" variant="pills" radius="sm">
        <Tabs.List mb="xs">
          <Tabs.Tab value="overview" leftSection={<IconActivity size={12} />} size="xs">
            Vue
          </Tabs.Tab>
          <Tabs.Tab value="decisions" leftSection={<IconBan size={12} />} size="xs">
            Bans ({data?.decisions_count || 0})
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={12} />} size="xs">
            Alertes
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" className="flex-1">
          <ScrollArea h={size === 'small' ? 150 : size === 'large' ? 350 : 250}>
            <Stack gap="sm">
              {/* Stats cards */}
              <SimpleGrid cols={2} spacing="xs">
                <Paper withBorder p="xs" radius="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="red">
                      <IconBan size={12} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed">Décisions actives</Text>
                      <Text size="lg" fw={700}>{metrics.total_decisions}</Text>
                    </div>
                  </Group>
                </Paper>
                <Paper withBorder p="xs" radius="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="orange">
                      <IconAlertTriangle size={12} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed">Alertes totales</Text>
                      <Text size="lg" fw={700}>{metrics.total_alerts}</Text>
                    </div>
                  </Group>
                </Paper>
              </SimpleGrid>

              {/* Origin breakdown */}
              <Paper withBorder p="xs" radius="sm">
                <Text size="xs" c="dimmed" mb="xs">Source des décisions</Text>
                <Group gap="xs" wrap="nowrap">
                  <RingProgress
                    size={60}
                    thickness={6}
                    roundCaps
                    sections={[
                      { value: crowdsecPercent, color: 'blue' },
                      { value: capiPercent, color: 'violet' },
                    ]}
                    label={
                      <Center>
                        <IconCloudLock size={16} />
                      </Center>
                    }
                  />
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Badge size="xs" color="blue" variant="dot">Local</Badge>
                      <Text size="xs">{crowdsecCount} ({crowdsecPercent}%)</Text>
                    </Group>
                    <Group gap="xs">
                      <Badge size="xs" color="violet" variant="dot">CAPI</Badge>
                      <Text size="xs">{capiCount} ({capiPercent}%)</Text>
                    </Group>
                  </Stack>
                </Group>
              </Paper>

              {/* Top countries */}
              {config.show_countries && Object.keys(metrics.by_country).length > 0 && (
                <Paper withBorder p="xs" radius="sm">
                  <Group gap="xs" mb="xs">
                    <IconFlag size={12} />
                    <Text size="xs" c="dimmed">Top pays bloqués</Text>
                  </Group>
                  <Group gap="xs">
                    {Object.entries(metrics.by_country).slice(0, 5).map(([country, count]) => (
                      <Tooltip key={country} label={`${country}: ${count} alertes`}>
                        <Badge size="sm" variant="light" leftSection={countryToFlag(country)}>
                          {count}
                        </Badge>
                      </Tooltip>
                    ))}
                  </Group>
                </Paper>
              )}

              {/* Top scenarios */}
              {Object.keys(metrics.by_scenario).length > 0 && (
                <Paper withBorder p="xs" radius="sm">
                  <Text size="xs" c="dimmed" mb="xs">Top scénarios détectés</Text>
                  <Stack gap={4}>
                    {Object.entries(metrics.by_scenario).slice(0, 5).map(([scenario, count]) => (
                      <Group key={scenario} gap="xs" justify="space-between">
                        <Text size="xs" lineClamp={1} style={{ maxWidth: '70%' }}>
                          {shortScenario(scenario)}
                        </Text>
                        <Badge size="xs" variant="light">{count}</Badge>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        {/* Decisions Tab */}
        <Tabs.Panel value="decisions" className="flex-1">
          <ScrollArea h={size === 'small' ? 150 : size === 'large' ? 350 : 250}>
            {decisions.length === 0 ? (
              <Center h={100}>
                <Stack align="center" gap="xs">
                  <IconShield size={24} className="text-green-400" />
                  <Text size="sm" c="dimmed">Aucune décision active</Text>
                </Stack>
              </Center>
            ) : (
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ fontSize: '11px' }}>IP</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }}>Type</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }}>Source</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }}>Durée</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {decisions.map((dec) => (
                    <Table.Tr key={dec.id}>
                      <Table.Td>
                        <Text size="xs" ff="monospace">{dec.value}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color="red" variant="light">{dec.type}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={getOriginColor(dec.origin)} variant="dot">
                          {dec.origin}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{formatDuration(dec.duration)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </ScrollArea>
        </Tabs.Panel>

        {/* Alerts Tab */}
        <Tabs.Panel value="alerts" className="flex-1">
          <ScrollArea h={size === 'small' ? 150 : size === 'large' ? 350 : 250}>
            {alerts.length === 0 ? (
              <Center h={100}>
                <Stack align="center" gap="xs">
                  <IconShield size={24} className="text-green-400" />
                  <Text size="sm" c="dimmed">Aucune alerte récente</Text>
                </Stack>
              </Center>
            ) : (
              <Stack gap="xs">
                {alerts.map((alert) => (
                  <Paper key={alert.id} withBorder p="xs" radius="sm">
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        {alert.country && (
                          <Text size="sm">{countryToFlag(alert.country)}</Text>
                        )}
                        <Text size="xs" ff="monospace" fw={500}>{alert.ip || 'N/A'}</Text>
                      </Group>
                      <Text size="xs" c="dimmed">{formatDate(alert.created_at)}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {shortScenario(alert.scenario)}
                    </Text>
                    {alert.as_name && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        AS: {alert.as_name}
                      </Text>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
