'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  Loader,
  ActionIcon,
  Tooltip,
  Center,
  SegmentedControl,
} from '@mantine/core';
import { IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { DashboardBlock } from '@/types';
import { appDashboardApi } from '@/lib/api';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartBlockProps {
  block: DashboardBlock;
  serverId: number;
  variables: Record<string, string>;
}

const COLORS = [
  '#228be6', // blue
  '#40c057', // green
  '#fa5252', // red
  '#fab005', // yellow
  '#7950f2', // violet
  '#20c997', // teal
  '#fd7e14', // orange
  '#e64980', // pink
  '#15aabf', // cyan
  '#82c91e', // lime
];

type ChartType = 'bar' | 'line' | 'pie' | 'donut';

export function ChartBlock({ block, serverId, variables }: ChartBlockProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const config = block.config;
  const chartType = (config.chart_type as ChartType) || 'bar';
  const dataKey = String(config.data_key || 'value');
  const nameKey = String(config.name_key || 'name');
  const refreshInterval = config.refresh_interval || 60;
  const showLegend = config.show_legend !== false;

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
        const parsedData = Array.isArray(result.data) ? result.data : [];
        setData(parsedData);
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

  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      name: String((item as Record<string, unknown>)[nameKey] || `Item ${index + 1}`),
      value: Number((item as Record<string, unknown>)[dataKey]) || 0,
      ...item,
    }));
  }, [data, dataKey, nameKey]);

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <Center style={{ flex: 1 }}>
          <Text size="sm" c="dimmed">
            Aucune donnée
          </Text>
        </Center>
      );
    }

    switch (chartType) {
      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'donut' ? '40%' : 0}
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              {showLegend && <Legend />}
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" />
              <XAxis
                dataKey="name"
                stroke="var(--mantine-color-dark-2)"
                tick={{ fill: 'var(--mantine-color-dark-1)', fontSize: 12 }}
              />
              <YAxis
                stroke="var(--mantine-color-dark-2)"
                tick={{ fill: 'var(--mantine-color-dark-1)', fontSize: 12 }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '8px',
                }}
              />
              {showLegend && <Legend />}
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLORS[0]}
                strokeWidth={2}
                dot={{ fill: COLORS[0], strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" />
              <XAxis
                dataKey="name"
                stroke="var(--mantine-color-dark-2)"
                tick={{ fill: 'var(--mantine-color-dark-1)', fontSize: 12 }}
              />
              <YAxis
                stroke="var(--mantine-color-dark-2)"
                tick={{ fill: 'var(--mantine-color-dark-1)', fontSize: 12 }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '8px',
                }}
              />
              {showLegend && <Legend />}
              <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Paper p="md" radius="md" withBorder h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={600}>
          {block.title}
        </Text>
        <Group gap="xs">
          <Tooltip label="Actualiser">
            <ActionIcon variant="subtle" size="sm" loading={loading} onClick={() => fetchData()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Content */}
      {loading && data.length === 0 ? (
        <Center style={{ flex: 1 }}>
          <Loader size="sm" />
        </Center>
      ) : error ? (
        <Center style={{ flex: 1 }}>
          <Stack align="center" gap="xs">
            <IconAlertCircle size={24} color="var(--mantine-color-red-6)" />
            <Text size="sm" c="red" ta="center">
              {error}
            </Text>
          </Stack>
        </Center>
      ) : (
        <div style={{ flex: 1, minHeight: 200 }}>{renderChart()}</div>
      )}

      {/* Footer */}
      <Text size="xs" c="dimmed" mt="xs">
        {lastRefresh
          ? `Màj: ${lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          : ''}
      </Text>
    </Paper>
  );
}
