'use client';

import { useEffect, useState, useCallback } from 'react';
import { Paper, Text, Group, Stack, ThemeIcon, Loader, Tooltip } from '@mantine/core';
import {
  IconBan,
  IconAlertTriangle,
  IconShield,
  IconShieldCheck,
  IconServer,
  IconRefresh,
  IconAlertCircle,
  IconUsers,
  IconDevices,
  IconWifi,
  IconRoute,
  IconSearch,
  IconShieldOff,
  IconPercentage,
  IconList,
  IconNetwork,
} from '@tabler/icons-react';
import { DashboardBlock } from '@/types';
import { appDashboardApi } from '@/lib/api';

interface CounterBlockProps {
  block: DashboardBlock;
  serverId: number;
  variables: Record<string, string>;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  IconBan,
  IconAlertTriangle,
  IconShield,
  IconShieldCheck,
  IconServer,
  IconUsers,
  IconDevices,
  IconWifi,
  IconRoute,
  IconSearch,
  IconShieldOff,
  IconPercentage,
  IconList,
  IconNetwork,
};

export function CounterBlock({ block, serverId, variables }: CounterBlockProps) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const config = block.config;
  const IconComponent = config.icon ? ICON_MAP[config.icon] || IconServer : IconServer;
  const color = config.color || 'blue';
  const prefix = config.prefix || '';
  const suffix = config.suffix || '';
  const refreshInterval = config.refresh_interval || 30;

  // Stabilize references for useCallback
  const blockId = block.id;
  const command = config.command;
  const variablesJson = JSON.stringify(variables);

  const fetchData = useCallback(async () => {
    if (!command) return;

    setLoading(true);
    setError(null);

    try {
      const vars = JSON.parse(variablesJson);
      const result = await appDashboardApi.fetchBlockData(block, serverId, vars);

      if (result.success) {
        setValue(typeof result.data === 'number' ? result.data : parseFloat(String(result.data)) || 0);
        setLastRefresh(new Date());
      } else {
        setError(result.error || 'Erreur inconnue');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, serverId, variablesJson, command]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return (
    <Paper p="md" radius="md" withBorder h="100%">
      <Stack h="100%" justify="space-between" gap="xs">
        <Group justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed" fw={500}>
            {block.title}
          </Text>
          <ThemeIcon variant="light" color={color} size="lg" radius="md">
            <IconComponent size={20} />
          </ThemeIcon>
        </Group>

        <Group justify="center" align="center" style={{ flex: 1 }}>
          {loading && value === null ? (
            <Loader size="sm" color={color} />
          ) : error ? (
            <Tooltip label={error} withArrow>
              <Group gap="xs">
                <IconAlertCircle size={20} color="var(--mantine-color-red-6)" />
                <Text size="sm" c="red">
                  Erreur
                </Text>
              </Group>
            </Tooltip>
          ) : (
            <Text
              size="2.5rem"
              fw={700}
              c={color}
              style={{ lineHeight: 1 }}
            >
              {prefix}
              {value?.toLocaleString() ?? '—'}
              {suffix}
            </Text>
          )}
        </Group>

        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            {lastRefresh ? `Màj: ${lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Text>
          <Tooltip label="Actualiser">
            <IconRefresh
              size={14}
              style={{ cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
              onClick={() => !loading && fetchData()}
              color="var(--mantine-color-dimmed)"
            />
          </Tooltip>
        </Group>
      </Stack>
    </Paper>
  );
}
