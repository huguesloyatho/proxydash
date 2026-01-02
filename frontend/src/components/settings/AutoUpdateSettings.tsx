'use client';

import { useState } from 'react';
import {
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Card,
  Timeline,
  Code,
  Accordion,
  Progress,
  ThemeIcon,
  Tooltip,
  ActionIcon,
  Alert,
  Box,
  Divider,
  Loader,
  ScrollArea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconRefresh,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconInfoCircle,
  IconClock,
  IconDatabase,
  IconRss,
  IconBrandGithub,
  IconSearch,
  IconDownload,
  IconPlayerPlay,
  IconCalendarEvent,
} from '@tabler/icons-react';
import { autoUpdateApi, UpdateLogEntry } from '@/lib/api';

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Jamais';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function LogLevelIcon({ level }: { level: string }) {
  switch (level) {
    case 'success':
      return <IconCheck size={14} />;
    case 'error':
      return <IconX size={14} />;
    case 'warning':
      return <IconAlertTriangle size={14} />;
    default:
      return <IconInfoCircle size={14} />;
  }
}

function LogLevelColor(level: string): string {
  switch (level) {
    case 'success':
      return 'green';
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'blue';
  }
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;

  const colors: Record<string, string> = {
    'selfhst': 'violet',
    'awesome-selfhosted': 'orange',
    'system': 'gray',
  };

  const icons: Record<string, React.ReactNode> = {
    'selfhst': <IconRss size={12} />,
    'awesome-selfhosted': <IconBrandGithub size={12} />,
    'system': <IconDatabase size={12} />,
  };

  return (
    <Badge
      size="xs"
      color={colors[source] || 'gray'}
      variant="light"
      leftSection={icons[source]}
    >
      {source}
    </Badge>
  );
}

export function AutoUpdateSettings() {
  const queryClient = useQueryClient();
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  // Fetch update status
  const { data: statusData, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['autoUpdateStatus'],
    queryFn: autoUpdateApi.getStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch detection stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['detectionStats'],
    queryFn: autoUpdateApi.getStats,
  });

  // Run update mutation
  const runUpdateMutation = useMutation({
    mutationFn: autoUpdateApi.runUpdate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['autoUpdateStatus'] });
      queryClient.invalidateQueries({ queryKey: ['detectionStats'] });
      notifications.show({
        title: 'Mise à jour terminée',
        message: `${data.result.apps_added_to_database} application(s) ajoutée(s)`,
        color: data.result.errors.length > 0 ? 'yellow' : 'green',
        icon: data.result.errors.length > 0 ? <IconAlertTriangle size={16} /> : <IconCheck size={16} />,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Échec de la mise à jour',
        color: 'red',
      });
    },
  });

  // Check updates (dry run) mutation
  const checkUpdatesMutation = useMutation({
    mutationFn: () => autoUpdateApi.checkUpdates(true),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['autoUpdateStatus'] });
      setIsCheckingUpdates(false);
      notifications.show({
        title: 'Vérification terminée',
        message: `${data.result.total_new_apps} nouvelle(s) application(s) détectée(s)`,
        color: 'blue',
        icon: <IconSearch size={16} />,
      });
    },
    onError: (error: Error) => {
      setIsCheckingUpdates(false);
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Échec de la vérification',
        color: 'red',
      });
    },
  });

  // Refresh online DB mutation
  const refreshDbMutation = useMutation({
    mutationFn: autoUpdateApi.refreshOnlineDb,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detectionStats'] });
      notifications.show({
        title: 'Base de données rafraîchie',
        message: 'La base awesome-selfhosted a été mise à jour',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Échec du rafraîchissement',
        color: 'red',
      });
    },
  });

  if (statusLoading || statsLoading) {
    return (
      <Paper withBorder p="xl">
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      </Paper>
    );
  }

  if (statusError) {
    return (
      <Alert color="red" title="Erreur" icon={<IconX size={16} />}>
        Impossible de charger le statut des mises à jour automatiques
      </Alert>
    );
  }

  const status = statusData?.status;
  const autoUpdate = statusData?.auto_update;
  const stats = statsData;
  const lastResult = status?.last_execution_result;
  const logs = status?.last_execution_logs || [];

  return (
    <Stack gap="lg">
      {/* Header */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Mises à jour automatiques</Title>
            <Text size="sm" c="dimmed">
              Le système vérifie automatiquement les nouvelles applications chaque nuit
            </Text>
          </div>
          <Group>
            <Tooltip label="Vérifier les mises à jour (aperçu)">
              <Button
                variant="light"
                leftSection={<IconSearch size={16} />}
                loading={checkUpdatesMutation.isPending}
                onClick={() => {
                  setIsCheckingUpdates(true);
                  checkUpdatesMutation.mutate();
                }}
              >
                Vérifier
              </Button>
            </Tooltip>
            <Tooltip label="Exécuter la mise à jour maintenant">
              <Button
                leftSection={<IconPlayerPlay size={16} />}
                loading={runUpdateMutation.isPending}
                onClick={() => runUpdateMutation.mutate()}
              >
                Mettre à jour
              </Button>
            </Tooltip>
          </Group>
        </Group>

        {/* Auto-update info */}
        <Group gap="xl">
          <Group gap="xs">
            <ThemeIcon size="sm" color={autoUpdate?.enabled ? 'green' : 'gray'} variant="light">
              {autoUpdate?.enabled ? <IconCheck size={14} /> : <IconX size={14} />}
            </ThemeIcon>
            <Text size="sm">
              {autoUpdate?.enabled ? 'Activé' : 'Désactivé'}
            </Text>
          </Group>
          <Group gap="xs">
            <ThemeIcon size="sm" color="blue" variant="light">
              <IconCalendarEvent size={14} />
            </ThemeIcon>
            <Text size="sm">{autoUpdate?.schedule || 'Non planifié'}</Text>
          </Group>
        </Group>
      </Paper>

      {/* Stats cards */}
      <Group grow>
        <Card withBorder p="md">
          <Group>
            <ThemeIcon size="lg" color="blue" variant="light">
              <IconDatabase size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700}>{stats?.local_database.patterns || 0}</Text>
              <Text size="xs" c="dimmed">Patterns de détection</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md">
          <Group>
            <ThemeIcon size="lg" color="green" variant="light">
              <IconSearch size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700}>{stats?.local_database.app_types || 0}</Text>
              <Text size="xs" c="dimmed">Types d'applications</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md">
          <Group>
            <ThemeIcon size="lg" color="orange" variant="light">
              <IconBrandGithub size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700}>{stats?.online_database.app_count || 0}</Text>
              <Text size="xs" c="dimmed">Apps awesome-selfhosted</Text>
            </div>
          </Group>
          <ActionIcon
            variant="subtle"
            size="sm"
            pos="absolute"
            top={8}
            right={8}
            loading={refreshDbMutation.isPending}
            onClick={() => refreshDbMutation.mutate()}
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Card>
        <Card withBorder p="md">
          <Group>
            <ThemeIcon size="lg" color="violet" variant="light">
              <IconDownload size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700}>{status?.known_apps_count || 0}</Text>
              <Text size="xs" c="dimmed">Apps déjà connues</Text>
            </div>
          </Group>
        </Card>
      </Group>

      {/* Sources */}
      <Paper withBorder p="md">
        <Title order={5} mb="md">Sources RSS/Atom</Title>
        <Stack gap="sm">
          {autoUpdate?.sources.map((source, index) => (
            <Group key={index} justify="space-between">
              <Group gap="sm">
                {source.name === 'selfh.st' ? (
                  <ThemeIcon size="sm" color="violet" variant="light">
                    <IconRss size={14} />
                  </ThemeIcon>
                ) : (
                  <ThemeIcon size="sm" color="orange" variant="light">
                    <IconBrandGithub size={14} />
                  </ThemeIcon>
                )}
                <Text size="sm" fw={500}>{source.name}</Text>
              </Group>
              <Code fz="xs">{source.url}</Code>
            </Group>
          ))}
        </Stack>

        <Divider my="md" />

        <Group gap="xl">
          <Group gap="xs">
            <Text size="sm" c="dimmed">Dernière vérification selfh.st:</Text>
            <Text size="sm" fw={500}>{formatDate(status?.last_selfhst_check || null)}</Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">Dernière vérification awesome-selfhosted:</Text>
            <Text size="sm" fw={500}>{formatDate(status?.last_awesome_check || null)}</Text>
          </Group>
        </Group>
      </Paper>

      {/* Last execution result */}
      {lastResult && (
        <Paper withBorder p="md">
          <Group justify="space-between" mb="md">
            <Title order={5}>Dernière exécution</Title>
            <Group gap="xs">
              <Badge color={lastResult.errors.length > 0 ? 'yellow' : 'green'}>
                {lastResult.mode === 'dry_run' ? 'Aperçu' : 'Mise à jour'}
              </Badge>
              <Badge color="gray" variant="light">
                {formatDuration(lastResult.duration_ms)}
              </Badge>
            </Group>
          </Group>

          <Group mb="md" gap="xl">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Démarré:</Text>
              <Text size="sm">{formatDate(lastResult.started_at)}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Nouvelles apps:</Text>
              <Badge color={lastResult.total_new_apps > 0 ? 'green' : 'gray'}>
                {lastResult.total_new_apps}
              </Badge>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Ajoutées:</Text>
              <Badge color={lastResult.apps_added_to_database > 0 ? 'blue' : 'gray'}>
                {lastResult.apps_added_to_database}
              </Badge>
            </Group>
          </Group>

          {/* Feed results */}
          <Stack gap="xs" mb="md">
            {lastResult.feeds_checked.map((feed, index) => (
              <Group key={index} justify="space-between" p="xs" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 4 }}>
                <Group gap="xs">
                  <SourceBadge source={feed.source} />
                  {feed.error ? (
                    <Badge color="red" size="sm" leftSection={<IconX size={10} />}>Erreur</Badge>
                  ) : (
                    <Badge color="green" size="sm" leftSection={<IconCheck size={10} />}>OK</Badge>
                  )}
                </Group>
                <Group gap="xs">
                  {feed.apps.length > 0 && (
                    <Tooltip label={feed.apps.join(', ')}>
                      <Badge color="blue" variant="light" size="sm">
                        {feed.new_apps} app(s)
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>

          {lastResult.errors.length > 0 && (
            <Alert color="yellow" icon={<IconAlertTriangle size={16} />} mb="md">
              {lastResult.errors.join(', ')}
            </Alert>
          )}
        </Paper>
      )}

      {/* Execution logs */}
      {logs.length > 0 && (
        <Paper withBorder p="md">
          <Title order={5} mb="md">Logs d'exécution</Title>
          <ScrollArea h={300} offsetScrollbars>
            <Timeline active={logs.length} bulletSize={24} lineWidth={2}>
              {logs.map((log, index) => (
                <Timeline.Item
                  key={index}
                  bullet={
                    <ThemeIcon size={24} color={LogLevelColor(log.level)} variant="filled" radius="xl">
                      <LogLevelIcon level={log.level} />
                    </ThemeIcon>
                  }
                  title={
                    <Group gap="xs">
                      <Text size="sm" fw={500}>{log.message}</Text>
                    </Group>
                  }
                >
                  <Group gap="xs" mt={4}>
                    <SourceBadge source={log.source} />
                    <Text size="xs" c="dimmed">
                      {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                    </Text>
                  </Group>
                </Timeline.Item>
              ))}
            </Timeline>
          </ScrollArea>
        </Paper>
      )}

      {/* Update history */}
      {status?.recent_history && status.recent_history.length > 0 && (
        <Paper withBorder p="md">
          <Title order={5} mb="md">Historique des mises à jour</Title>
          <Accordion>
            {status.recent_history.slice().reverse().map((entry, index) => (
              <Accordion.Item key={index} value={entry.date}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <Text size="sm">{entry.date}</Text>
                    <Badge color="green" size="sm">
                      +{entry.count} app(s)
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Group gap="xs">
                    {entry.apps_added.map((app, appIndex) => (
                      <Badge key={appIndex} variant="light" size="sm">
                        {app}
                      </Badge>
                    ))}
                  </Group>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Paper>
      )}
    </Stack>
  );
}
