'use client';

import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  Stack,
  Badge,
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
  Button,
  Modal,
  TextInput,
  Select,
  Accordion,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconShield,
  IconShieldOff,
  IconAlertTriangle,
  IconBan,
  IconRefresh,
  IconFlag,
  IconActivity,
  IconCloudLock,
  IconShieldCheck,
  IconTrash,
  IconPlus,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { widgetsApi, api } from '@/lib/api';
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
    show_allowlists?: boolean;
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

interface AllowlistItem {
  cidr: string;
  description: string;
  expiration: string | null;
  created_at: string;
}

interface Allowlist {
  name: string;
  description: string;
  items: AllowlistItem[];
  items_count: number;
  created_at: string;
  updated_at: string;
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
  allowlists: Allowlist[];
  allowlists_count: number;
  allowlist_items_count: number;
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
  return scenario
    .replace('crowdsecurity/', '')
    .replace('LePresidente/', '')
    .replace('-', ' ')
    .slice(0, 30);
}

export function CrowdSecWidget({ widgetId, config, size = 'medium', onDataReady }: CrowdSecWidgetProps) {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [banModalOpened, { open: openBanModal, close: closeBanModal }] = useDisclosure(false);
  const [unbanIp, setUnbanIp] = useState<string | null>(null);
  const [banForm, setBanForm] = useState({ ip: '', duration: '24h', reason: 'manual', type: 'ban' });

  const queryClient = useQueryClient();
  const refreshInterval = (config.refresh_interval || 60) * 1000;
  const hasValidWidgetId = !!(widgetId && widgetId > 0 && Number.isFinite(widgetId));

  const { data, isLoading, error, refetch, isFetching } = useQuery<CrowdSecData>({
    queryKey: ['crowdsec-widget', widgetId],
    queryFn: async () => {
      if (!widgetId) {
        throw new Error('Widget ID manquant');
      }
      const response = await widgetsApi.getData(widgetId);
      if (response.data && !response.data.error) {
        onDataReady?.(response.data);
      }
      return response.data;
    },
    refetchInterval: refreshInterval,
    enabled: hasValidWidgetId,
  });

  // Mutation for creating a ban
  const createBanMutation = useMutation({
    mutationFn: async (data: { value: string; duration: string; reason: string; type: string }) => {
      const response = await api.post('/crowdsec/decisions', data);
      return response.data;
    },
    onSuccess: () => {
      notifications.show({
        title: 'IP bannie',
        message: `${banForm.ip} a été bannie avec succès`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      closeBanModal();
      setBanForm({ ip: '', duration: '24h', reason: 'manual', type: 'ban' });
      refetch();
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Erreur',
        message: err.message || 'Impossible de bannir cette IP',
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  // Mutation for removing a ban (unban)
  const removeBanMutation = useMutation({
    mutationFn: async (ip: string) => {
      const response = await api.delete('/crowdsec/decisions', { params: { ip } });
      return response.data;
    },
    onSuccess: () => {
      notifications.show({
        title: 'IP dé-bannie',
        message: `${unbanIp} a été retirée de la liste noire`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      setUnbanIp(null);
      refetch();
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Erreur',
        message: err.message || 'Impossible de dé-bannir cette IP',
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  const handleBan = () => {
    if (!banForm.ip) return;
    createBanMutation.mutate({
      value: banForm.ip,
      duration: banForm.duration,
      reason: banForm.reason,
      type: banForm.type,
    });
  };

  const handleUnban = (ip: string) => {
    setUnbanIp(ip);
  };

  const confirmUnban = () => {
    if (unbanIp) {
      removeBanMutation.mutate(unbanIp);
    }
  };

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
  const allowlists = data?.allowlists || [];
  const allowlistItemsCount = data?.allowlist_items_count || 0;

  // Calculate origin percentages
  const totalOrigins = Object.values(metrics.by_origin).reduce((a, b) => a + b, 0);
  const crowdsecCount = metrics.by_origin['crowdsec'] || 0;
  const capiCount = metrics.by_origin['CAPI'] || 0;
  const crowdsecPercent = totalOrigins > 0 ? Math.round((crowdsecCount / totalOrigins) * 100) : 0;
  const capiPercent = totalOrigins > 0 ? Math.round((capiCount / totalOrigins) * 100) : 0;

  const scrollHeight = size === 'small' ? 150 : size === 'large' ? 350 : 250;

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
          <Tabs.Tab value="allowlists" leftSection={<IconShieldCheck size={12} />} size="xs">
            Whitelist ({allowlistItemsCount})
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={12} />} size="xs">
            Alertes
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" className="flex-1">
          <ScrollArea h={scrollHeight}>
            <Stack gap="sm">
              {/* Stats cards */}
              <SimpleGrid cols={3} spacing="xs">
                <Paper withBorder p="xs" radius="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="red">
                      <IconBan size={12} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed">Bans actifs</Text>
                      <Text size="lg" fw={700}>{metrics.total_decisions}</Text>
                    </div>
                  </Group>
                </Paper>
                <Paper withBorder p="xs" radius="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="green">
                      <IconShieldCheck size={12} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed">Whitelistées</Text>
                      <Text size="lg" fw={700}>{allowlistItemsCount}</Text>
                    </div>
                  </Group>
                </Paper>
                <Paper withBorder p="xs" radius="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="orange">
                      <IconAlertTriangle size={12} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed">Alertes</Text>
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
              {config.show_countries !== false && Object.keys(metrics.by_country).length > 0 && (
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

        {/* Decisions Tab (Bans/Blacklist) */}
        <Tabs.Panel value="decisions" className="flex-1">
          <Group justify="flex-end" mb="xs">
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconPlus size={12} />}
              onClick={openBanModal}
            >
              Bannir une IP
            </Button>
          </Group>
          <ScrollArea h={scrollHeight - 30}>
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
                    <Table.Th style={{ fontSize: '11px' }}>IP/Range</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }}>Type</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }}>Source</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }}>Durée</Table.Th>
                    <Table.Th style={{ fontSize: '11px', width: 50 }}>Actions</Table.Th>
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
                      <Table.Td>
                        <Tooltip label="Dé-bannir">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="green"
                            onClick={() => handleUnban(dec.value)}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </ScrollArea>
        </Tabs.Panel>

        {/* Allowlists Tab (Whitelist) */}
        <Tabs.Panel value="allowlists" className="flex-1">
          <ScrollArea h={scrollHeight}>
            {allowlists.length === 0 ? (
              <Center h={100}>
                <Stack align="center" gap="xs">
                  <IconShieldCheck size={24} className="text-gray-400" />
                  <Text size="sm" c="dimmed">Aucune allowlist configurée</Text>
                  <Text size="xs" c="dimmed">
                    Utilisez `cscli allowlists create` pour créer une allowlist
                  </Text>
                </Stack>
              </Center>
            ) : (
              <Accordion variant="contained" radius="sm">
                {allowlists.map((allowlist) => (
                  <Accordion.Item key={allowlist.name} value={allowlist.name}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap" pr="md">
                        <Group gap="xs">
                          <ThemeIcon size="sm" variant="light" color="green">
                            <IconShieldCheck size={12} />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>{allowlist.name}</Text>
                            {allowlist.description && (
                              <Text size="xs" c="dimmed">{allowlist.description}</Text>
                            )}
                          </div>
                        </Group>
                        <Badge size="sm" variant="light" color="green">
                          {allowlist.items_count} IP{allowlist.items_count > 1 ? 's' : ''}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {allowlist.items.length === 0 ? (
                        <Text size="xs" c="dimmed">Aucune IP dans cette allowlist</Text>
                      ) : (
                        <Stack gap="xs">
                          {allowlist.items.map((item, idx) => (
                            <Paper key={idx} withBorder p="xs" radius="sm">
                              <Group justify="space-between">
                                <Group gap="xs">
                                  <Text size="xs" ff="monospace" fw={500}>
                                    {item.cidr}
                                  </Text>
                                  {item.description && (
                                    <Text size="xs" c="dimmed">- {item.description}</Text>
                                  )}
                                </Group>
                                {item.expiration && (
                                  <Badge size="xs" variant="outline" color="orange">
                                    Expire: {formatDate(item.expiration)}
                                  </Badge>
                                )}
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </ScrollArea>
        </Tabs.Panel>

        {/* Alerts Tab */}
        <Tabs.Panel value="alerts" className="flex-1">
          <ScrollArea h={scrollHeight}>
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
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">{formatDate(alert.created_at)}</Text>
                        {alert.ip && (
                          <Tooltip label="Bannir cette IP">
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => {
                                setBanForm({ ...banForm, ip: alert.ip });
                                openBanModal();
                              }}
                            >
                              <IconBan size={12} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
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

      {/* Ban Modal */}
      <Modal opened={banModalOpened} onClose={closeBanModal} title="Bannir une IP" size="sm">
        <Stack gap="md">
          <TextInput
            label="IP ou plage CIDR"
            placeholder="192.168.1.1 ou 10.0.0.0/24"
            value={banForm.ip}
            onChange={(e) => setBanForm({ ...banForm, ip: e.target.value })}
            required
          />
          <Select
            label="Durée"
            data={[
              { value: '1h', label: '1 heure' },
              { value: '4h', label: '4 heures' },
              { value: '24h', label: '24 heures' },
              { value: '7d', label: '7 jours' },
              { value: '30d', label: '30 jours' },
              { value: '1y', label: '1 an' },
            ]}
            value={banForm.duration}
            onChange={(v) => setBanForm({ ...banForm, duration: v || '24h' })}
          />
          <TextInput
            label="Raison"
            placeholder="Raison du ban"
            value={banForm.reason}
            onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
          />
          <Select
            label="Type de décision"
            data={[
              { value: 'ban', label: 'Ban (blocage complet)' },
              { value: 'captcha', label: 'Captcha' },
              { value: 'throttle', label: 'Throttle (limitation)' },
            ]}
            value={banForm.type}
            onChange={(v) => setBanForm({ ...banForm, type: v || 'ban' })}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeBanModal}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={handleBan}
              loading={createBanMutation.isPending}
              disabled={!banForm.ip}
            >
              Bannir
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Unban Confirmation Modal */}
      <Modal
        opened={!!unbanIp}
        onClose={() => setUnbanIp(null)}
        title="Confirmer le dé-bannissement"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Êtes-vous sûr de vouloir retirer <Text span fw={700} ff="monospace">{unbanIp}</Text> de la liste noire ?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setUnbanIp(null)}>
              Annuler
            </Button>
            <Button
              color="green"
              onClick={confirmUnban}
              loading={removeBanMutation.isPending}
            >
              Dé-bannir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
