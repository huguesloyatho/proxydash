'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Tabs,
  Group,
  Badge,
  Text,
  LoadingOverlay,
  Box,
} from '@mantine/core';
import {
  IconBell,
  IconAlertTriangle,
  IconHistory,
  IconSettings,
} from '@tabler/icons-react';
import { useAuthStore } from '@/lib/store';
import { notificationsApi } from '@/lib/api/notifications';
import { NotificationStats } from '@/types';
import { ChannelsTab } from '@/components/notifications/ChannelsTab';
import { RulesTab } from '@/components/notifications/RulesTab';
import { AlertsTab } from '@/components/notifications/AlertsTab';
import { LogsTab } from '@/components/notifications/LogsTab';
import { AdminConfigTab } from '@/components/notifications/AdminConfigTab';

export function NotificationsSettings() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('channels');

  useEffect(() => {
    loadStats();
  }, []);

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

  return (
    <Stack>
      <Group justify="space-between" mb="md">
        <div>
          <Text size="lg" fw={600}>Notifications & Alertes</Text>
          <Text size="sm" c="dimmed">
            Configurez vos canaux de notification et règles d&apos;alertes
          </Text>
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

      <Box pos="relative">
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
            {user?.is_admin && (
              <Tabs.Tab value="admin" leftSection={<IconSettings size={16} />}>
                Configuration
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="channels" pt="md">
            <ChannelsTab onUpdate={loadStats} />
          </Tabs.Panel>

          <Tabs.Panel value="rules" pt="md">
            <RulesTab onUpdate={loadStats} />
          </Tabs.Panel>

          <Tabs.Panel value="alerts" pt="md">
            <AlertsTab onUpdate={loadStats} />
          </Tabs.Panel>

          <Tabs.Panel value="logs" pt="md">
            <LogsTab />
          </Tabs.Panel>

          {user?.is_admin && (
            <Tabs.Panel value="admin" pt="md">
              <AdminConfigTab />
            </Tabs.Panel>
          )}
        </Tabs>
      </Box>
    </Stack>
  );
}
