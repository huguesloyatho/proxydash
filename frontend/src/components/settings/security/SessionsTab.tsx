'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Group,
  Paper,
  Text,
  Badge,
  Button,
  ActionIcon,
  LoadingOverlay,
  Alert,
  Tooltip,
} from '@mantine/core';
import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconTrash,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconMapPin,
  IconClock,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { securityApi, UserSession } from '@/lib/api/security';

export function SessionsTab() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await securityApi.listSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: number) => {
    setRevoking(sessionId);
    try {
      await securityApi.revokeSession(sessionId);
      notifications.show({
        title: 'Succès',
        message: 'Session révoquée',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      loadSessions();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Impossible de révoquer la session';
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter toutes les autres sessions ?')) {
      return;
    }

    try {
      const result = await securityApi.revokeAllSessions(true);
      notifications.show({
        title: 'Succès',
        message: result.message,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      loadSessions();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Impossible de révoquer les sessions';
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
        color: 'red',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} h`;
    return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  };

  const getDeviceIcon = (deviceInfo: string | null) => {
    if (!deviceInfo) return <IconDeviceDesktop size={24} />;
    const lower = deviceInfo.toLowerCase();
    if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) {
      return <IconDeviceMobile size={24} />;
    }
    return <IconDeviceDesktop size={24} />;
  };

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={loading} />

      <Group justify="space-between">
        <Text c="dimmed">
          Gérez vos sessions actives et déconnectez les appareils non reconnus.
        </Text>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={loadSessions}
          >
            Actualiser
          </Button>
          {sessions.filter(s => !s.is_current).length > 0 && (
            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={16} />}
              onClick={handleRevokeAll}
            >
              Déconnecter tout
            </Button>
          )}
        </Group>
      </Group>

      <Alert color="blue" icon={<IconAlertCircle size={18} />}>
        Si vous voyez une session que vous ne reconnaissez pas, déconnectez-la immédiatement
        et changez votre mot de passe.
      </Alert>

      {sessions.length === 0 && !loading ? (
        <Text c="dimmed" ta="center" py="xl">
          Aucune session active
        </Text>
      ) : (
        <Stack>
          {sessions.map((session) => (
            <Paper key={session.id} withBorder p="md">
              <Group justify="space-between" wrap="nowrap">
                <Group wrap="nowrap">
                  {getDeviceIcon(session.device_info)}
                  <div>
                    <Group gap="xs">
                      <Text fw={500}>
                        {session.device_info || 'Appareil inconnu'}
                      </Text>
                      {session.is_current && (
                        <Badge color="green" size="sm">
                          Session actuelle
                        </Badge>
                      )}
                    </Group>
                    <Group gap="lg" mt="xs">
                      {session.ip_address && (
                        <Group gap={4}>
                          <IconMapPin size={14} color="gray" />
                          <Text size="sm" c="dimmed">
                            {session.ip_address}
                          </Text>
                        </Group>
                      )}
                      <Group gap={4}>
                        <IconClock size={14} color="gray" />
                        <Tooltip label={formatDate(session.last_activity)}>
                          <Text size="sm" c="dimmed">
                            {formatRelativeTime(session.last_activity)}
                          </Text>
                        </Tooltip>
                      </Group>
                    </Group>
                  </div>
                </Group>

                {!session.is_current && (
                  <Tooltip label="Révoquer cette session">
                    <ActionIcon
                      color="red"
                      variant="light"
                      onClick={() => handleRevoke(session.id)}
                      loading={revoking === session.id}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
