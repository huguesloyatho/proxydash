'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Tabs,
  Group,
  Badge,
  Anchor,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBell,
  IconAlertTriangle,
  IconHistory,
  IconSettings,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { notificationsApi } from '@/lib/api/notifications';
import { NotificationStats } from '@/types';
import { ChannelsTab } from '@/components/notifications/ChannelsTab';
import { RulesTab } from '@/components/notifications/RulesTab';
import { AlertsTab } from '@/components/notifications/AlertsTab';
import { LogsTab } from '@/components/notifications/LogsTab';
import { AdminConfigTab } from '@/components/notifications/AdminConfigTab';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('channels');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadStats();
  }, [isAuthenticated]);

  const loadStats = async () => {
    try {
      const data = await notificationsApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Container size="xl" py="xl">
      <Group mb="xl">
        <Anchor href="/settings" c="dimmed">
          <Group gap="xs">
            <IconArrowLeft size={18} />
            Retour aux paramètres
          </Group>
        </Anchor>
      </Group>

      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1}>Notifications & Alertes</Title>
          <Text c="dimmed">Configurez vos canaux de notification et règles d&apos;alertes</Text>
        </div>
        {stats && (
          <Group>
            <Badge color="blue" size="lg" variant="light">
              {stats.enabled_channels} canaux actifs
            </Badge>
            <Badge color="green" size="lg" variant="light">
              {stats.enabled_rules} règles actives
            </Badge>
            {stats.active_alerts > 0 && (
              <Badge color="red" size="lg" variant="filled">
                {stats.active_alerts} alertes actives
              </Badge>
            )}
          </Group>
        )}
      </Group>

      <Paper withBorder pos="relative">
        <LoadingOverlay visible={loading} />

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="channels" leftSection={<IconBell size={16} />}>
              Canaux
              {stats && stats.total_channels > 0 && (
                <Badge ml="xs" size="sm" variant="light">
                  {stats.total_channels}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="rules" leftSection={<IconSettings size={16} />}>
              Règles
              {stats && stats.total_rules > 0 && (
                <Badge ml="xs" size="sm" variant="light">
                  {stats.total_rules}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={16} />}>
              Alertes
              {stats && stats.active_alerts > 0 && (
                <Badge ml="xs" size="sm" color="red" variant="filled">
                  {stats.active_alerts}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="logs" leftSection={<IconHistory size={16} />}>
              Historique
            </Tabs.Tab>
            {user.is_admin && (
              <Tabs.Tab value="admin" leftSection={<IconSettings size={16} />}>
                Configuration
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="channels" p="md">
            <ChannelsTab onUpdate={loadStats} />
          </Tabs.Panel>

          <Tabs.Panel value="rules" p="md">
            <RulesTab onUpdate={loadStats} />
          </Tabs.Panel>

          <Tabs.Panel value="alerts" p="md">
            <AlertsTab onUpdate={loadStats} />
          </Tabs.Panel>

          <Tabs.Panel value="logs" p="md">
            <LogsTab />
          </Tabs.Panel>

          {user.is_admin && (
            <Tabs.Panel value="admin" p="md">
              <AdminConfigTab />
            </Tabs.Panel>
          )}
        </Tabs>
      </Paper>
    </Container>
  );
}
