'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  Table,
  ScrollArea,
  Loader,
  ActionIcon,
  Tooltip,
  TextInput,
  Badge,
  Center,
  Modal,
  Button,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconRefresh,
  IconAlertCircle,
  IconSearch,
  IconLockOpen,
  IconTrash,
  IconBan,
  IconEdit,
  IconCheck,
  IconX,
  IconClock,
} from '@tabler/icons-react';
import { DashboardBlock, RowAction } from '@/types';
import { appDashboardApi } from '@/lib/api';
import { notifications } from '@mantine/notifications';

interface TableBlockProps {
  block: DashboardBlock;
  serverId: number;
  variables: Record<string, string>;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  IconLockOpen,
  IconTrash,
  IconBan,
  IconEdit,
  IconCheck,
  IconX,
  IconClock,
};

export function TableBlock({ block, serverId, variables }: TableBlockProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Action confirmation modal
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [pendingAction, setPendingAction] = useState<{
    action: RowAction;
    row: Record<string, unknown>;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const config = block.config;
  const columns = config.columns || [];
  const rowActions = config.row_actions || [];
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
        const parsedData = Array.isArray(result.data) ? result.data : [];
        // Debug: log first item structure
        if (parsedData.length > 0) {
          console.log(`[TableBlock ${blockId}] First row keys:`, Object.keys(parsedData[0]));
          console.log(`[TableBlock ${blockId}] First row data:`, JSON.stringify(parsedData[0], null, 2));
        }
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

  const handleRowAction = async (action: RowAction, row: Record<string, unknown>) => {
    if (action.confirm) {
      setPendingAction({ action, row });
      openConfirm();
    } else {
      await executeRowAction(action, row);
    }
  };

  const executeRowAction = async (action: RowAction, row: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const result = await appDashboardApi.executeCommand(
        serverId,
        action.command,
        variables,
        'raw',
        row
      );

      if (result.success) {
        notifications.show({
          title: 'Action exécutée',
          message: action.label + ' effectué avec succès',
          color: 'green',
        });
        // Refresh data after action
        fetchData();
      } else {
        notifications.show({
          title: 'Erreur',
          message: result.error || 'Échec de l\'action',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Erreur de connexion',
        color: 'red',
      });
    } finally {
      setActionLoading(false);
      closeConfirm();
      setPendingAction(null);
    }
  };

  // Get nested value from object using dot notation (e.g., "source.ip" or "decisions.0.value")
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    const keys = path.split('.');
    let value: unknown = obj;
    for (const key of keys) {
      if (value === null || value === undefined) return undefined;
      if (Array.isArray(value)) {
        // Handle array index access (e.g., "decisions.0")
        const index = parseInt(key, 10);
        if (!isNaN(index)) {
          value = value[index];
        } else {
          return undefined;
        }
      } else if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  };

  const formatCellValue = (value: unknown, format?: string): string => {
    if (value === null || value === undefined) return '—';

    if (format === 'datetime' && typeof value === 'string') {
      try {
        return new Date(value).toLocaleString('fr-FR');
      } catch {
        return String(value);
      }
    }

    if (format === 'number' && typeof value === 'number') {
      return value.toLocaleString('fr-FR');
    }

    if (format === 'boolean') {
      return value ? 'Oui' : 'Non';
    }

    return String(value);
  };

  // Filter data by search
  const filteredData = data.filter((row) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return columns.some((col) => {
      const value = getNestedValue(row, col.key);
      return String(value).toLowerCase().includes(searchLower);
    });
  });

  const renderActionIcon = (action: RowAction) => {
    const IconComp = action.icon ? ACTION_ICONS[action.icon] : null;
    if (IconComp) return <IconComp size={16} />;
    return null;
  };

  return (
    <Paper p="md" radius="md" withBorder h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <Text size="sm" fw={600}>
            {block.title}
          </Text>
          {data.length > 0 && (
            <Badge size="sm" variant="light" color="gray">
              {filteredData.length} / {data.length}
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          <TextInput
            placeholder="Rechercher..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 150 }}
          />
          <Tooltip label="Actualiser">
            <ActionIcon
              variant="subtle"
              size="sm"
              loading={loading}
              onClick={() => fetchData()}
            >
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
      ) : filteredData.length === 0 ? (
        <Center style={{ flex: 1 }}>
          <Text size="sm" c="dimmed">
            {search ? 'Aucun résultat' : 'Aucune donnée'}
          </Text>
        </Center>
      ) : (
        <ScrollArea style={{ flex: 1 }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                {columns.map((col) => (
                  <Table.Th key={col.key} style={{ width: col.width }}>
                    {col.label}
                  </Table.Th>
                ))}
                {rowActions.length > 0 && <Table.Th style={{ width: 80 }}>Actions</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredData.map((row, index) => (
                <Table.Tr key={index}>
                  {columns.map((col) => (
                    <Table.Td key={col.key}>
                      <Text size="xs" truncate>
                        {formatCellValue(getNestedValue(row, col.key), col.format)}
                      </Text>
                    </Table.Td>
                  ))}
                  {rowActions.length > 0 && (
                    <Table.Td>
                      <Group gap={4}>
                        {rowActions.map((action) => (
                          <Tooltip key={action.id} label={action.label}>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color={action.color || 'gray'}
                              onClick={() => handleRowAction(action, row)}
                              loading={actionLoading && pendingAction?.row === row}
                            >
                              {renderActionIcon(action)}
                            </ActionIcon>
                          </Tooltip>
                        ))}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Footer */}
      <Text size="xs" c="dimmed" mt="xs">
        {lastRefresh
          ? `Màj: ${lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          : ''}
      </Text>

      {/* Confirmation Modal */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title="Confirmer l'action"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            {pendingAction?.action.confirm_message ||
              `Êtes-vous sûr de vouloir effectuer "${pendingAction?.action.label}" ?`}
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={closeConfirm}>
              Annuler
            </Button>
            <Button
              color={pendingAction?.action.color || 'blue'}
              loading={actionLoading}
              onClick={() =>
                pendingAction && executeRowAction(pendingAction.action, pendingAction.row)
              }
            >
              Confirmer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
