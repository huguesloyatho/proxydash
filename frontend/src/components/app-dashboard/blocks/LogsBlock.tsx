'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  ScrollArea,
  Loader,
  ActionIcon,
  Tooltip,
  Code,
  Center,
  Switch,
} from '@mantine/core';
import { IconRefresh, IconAlertCircle, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { DashboardBlock, HighlightPattern } from '@/types';
import { appDashboardApi } from '@/lib/api';

interface LogsBlockProps {
  block: DashboardBlock;
  serverId: number;
  variables: Record<string, string>;
}

export function LogsBlock({ block, serverId, variables }: LogsBlockProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const config = block.config;
  const maxLines = config.max_lines || 100;
  const refreshInterval = config.refresh_interval || 10;
  const highlightPatterns = (config.highlight_patterns as HighlightPattern[]) || [];

  // Stabilize references for useCallback
  const blockId = block.id;
  const command = config.command;
  const variablesJson = JSON.stringify(variables);

  const fetchData = useCallback(async () => {
    if (!command || paused) return;

    setLoading(true);
    setError(null);

    try {
      const vars = JSON.parse(variablesJson);
      const result = await appDashboardApi.fetchBlockData(block, serverId, vars);

      if (result.success) {
        const rawOutput = String(result.data || '');
        const logLines = rawOutput.split('\n').filter((line) => line.trim());
        setLines(logLines.slice(-maxLines));
      } else {
        setError(result.error || 'Erreur inconnue');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, serverId, variablesJson, command, paused, maxLines]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [lines, autoScroll]);

  const highlightLine = (line: string): React.ReactNode => {
    let result: React.ReactNode = line;

    for (const pattern of highlightPatterns) {
      try {
        const regex = new RegExp(`(${pattern.pattern})`, 'gi');
        if (regex.test(line)) {
          return (
            <Text
              component="span"
              c={pattern.color}
              fw={pattern.bold ? 700 : 400}
              style={{ display: 'block' }}
            >
              {line}
            </Text>
          );
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return result;
  };

  return (
    <Paper p="md" radius="md" withBorder h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={600}>
          {block.title}
        </Text>
        <Group gap="xs">
          <Tooltip label={paused ? 'Reprendre' : 'Pause'}>
            <ActionIcon
              variant={paused ? 'filled' : 'subtle'}
              size="sm"
              color={paused ? 'orange' : 'gray'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
            </ActionIcon>
          </Tooltip>
          <Switch
            size="xs"
            label="Auto-scroll"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.currentTarget.checked)}
            styles={{ label: { fontSize: '0.7rem', paddingLeft: 4 } }}
          />
          <Tooltip label="Actualiser">
            <ActionIcon variant="subtle" size="sm" loading={loading} onClick={() => fetchData()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Content */}
      {loading && lines.length === 0 ? (
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
      ) : lines.length === 0 ? (
        <Center style={{ flex: 1 }}>
          <Text size="sm" c="dimmed">
            Aucun log
          </Text>
        </Center>
      ) : (
        <ScrollArea
          ref={scrollRef}
          style={{ flex: 1 }}
          bg="dark.8"
          p="xs"
          type="always"
          offsetScrollbars
          scrollbarSize={8}
          styles={{
            root: { borderRadius: 'var(--mantine-radius-sm)' },
          }}
        >
          <Code block style={{ background: 'transparent', fontSize: '0.75rem', whiteSpace: 'pre', overflowX: 'visible' }}>
            {lines.map((line, index) => (
              <div key={index} style={{ lineHeight: 1.4, whiteSpace: 'pre' }}>
                {highlightLine(line)}
              </div>
            ))}
          </Code>
        </ScrollArea>
      )}

      {/* Footer */}
      <Group justify="space-between" mt="xs">
        <Text size="xs" c="dimmed">
          {lines.length} lignes
        </Text>
        {paused && (
          <Text size="xs" c="orange" fw={500}>
            En pause
          </Text>
        )}
      </Group>
    </Paper>
  );
}
