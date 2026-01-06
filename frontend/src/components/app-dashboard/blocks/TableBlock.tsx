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
  Select,
  PasswordInput,
  NumberInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
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
  IconPlus,
  IconEye,
  IconShieldCheck,
  IconShieldPlus,
} from '@tabler/icons-react';
import { DashboardBlock, RowAction, ActionInput, HeaderAction } from '@/types';
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
  IconPlus,
  IconEye,
  IconShieldCheck,
  IconShieldPlus,
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
    action: RowAction | HeaderAction;
    row: Record<string, unknown>;
    isHeaderAction?: boolean;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Output modal for show_output actions
  const [outputOpened, { open: openOutput, close: closeOutput }] = useDisclosure(false);
  const [actionOutput, setActionOutput] = useState<string>('');

  // Form for inputs
  const form = useForm<Record<string, string>>({
    initialValues: {},
  });

  const config = block.config;
  const columns = config.columns || [];
  const rowActions = config.row_actions || [];
  const headerAction = config.header_action;
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
    // If action has inputs, open modal to collect them
    if (action.inputs && action.inputs.length > 0) {
      // Set default values
      const initialValues: Record<string, string> = {};
      action.inputs.forEach((input: ActionInput) => {
        initialValues[input.id] = input.default || '';
      });
      form.setValues(initialValues);
      setPendingAction({ action, row });
      openConfirm();
    } else if (action.confirm) {
      setPendingAction({ action, row });
      openConfirm();
    } else {
      await executeRowAction(action, row, {});
    }
  };

  const handleHeaderAction = async (action: HeaderAction) => {
    // Header actions always have inputs or confirmation
    if (action.inputs && action.inputs.length > 0) {
      const initialValues: Record<string, string> = {};
      action.inputs.forEach((input: ActionInput) => {
        initialValues[input.id] = input.default || '';
      });
      form.setValues(initialValues);
      setPendingAction({ action, row: {}, isHeaderAction: true });
      openConfirm();
    } else if (action.confirm) {
      setPendingAction({ action, row: {}, isHeaderAction: true });
      openConfirm();
    } else {
      await executeHeaderAction(action, {});
    }
  };

  const executeHeaderAction = async (
    action: HeaderAction,
    inputs: Record<string, string> = {}
  ) => {
    setActionLoading(true);
    try {
      const rowWithInputs = { input: inputs };

      const result = await appDashboardApi.executeCommand(
        serverId,
        action.command,
        variables,
        'raw',
        rowWithInputs
      );

      if (result.success) {
        notifications.show({
          title: 'Action exécutée',
          message: action.label + ' effectué avec succès',
          color: 'green',
        });
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

  const executeRowAction = async (
    action: RowAction,
    row: Record<string, unknown>,
    inputs: Record<string, string> = {}
  ) => {
    setActionLoading(true);
    try {
      // Merge row data with inputs for command interpolation
      const rowWithInputs = { ...row, input: inputs };

      const result = await appDashboardApi.executeCommand(
        serverId,
        action.command,
        variables,
        'raw',
        rowWithInputs
      );

      if (result.success) {
        // If show_output is true, display the output in a modal
        if (action.show_output) {
          const output = typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output, null, 2);
          setActionOutput(output);
          openOutput();
        } else {
          notifications.show({
            title: 'Action exécutée',
            message: action.label + ' effectué avec succès',
            color: 'green',
          });
        }
        // Refresh data after action (unless it's just viewing output)
        if (!action.show_output) {
          fetchData();
        }
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

  const handleSubmitAction = () => {
    if (pendingAction) {
      if (pendingAction.isHeaderAction) {
        executeHeaderAction(pendingAction.action as HeaderAction, form.values);
      } else {
        executeRowAction(pendingAction.action as RowAction, pendingAction.row, form.values);
      }
    }
  };

  const renderInput = (input: ActionInput) => {
    switch (input.type) {
      case 'select':
        return (
          <Select
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            data={input.options || []}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
      case 'password':
        return (
          <PasswordInput
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
      case 'number':
        return (
          <NumberInput
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
      default:
        return (
          <TextInput
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
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

  const renderActionIcon = (action: RowAction | HeaderAction, size: number = 16) => {
    const IconComp = action.icon ? ACTION_ICONS[action.icon] : null;
    if (IconComp) return <IconComp size={size} />;
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
          {headerAction && (
            <Tooltip label={headerAction.label}>
              <ActionIcon
                variant="light"
                size="sm"
                color={headerAction.color || 'green'}
                onClick={() => handleHeaderAction(headerAction)}
              >
                {renderActionIcon(headerAction) || <IconPlus size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
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

      {/* Action Modal (with or without inputs) */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={pendingAction?.action.label || "Confirmer l'action"}
        centered
        size="sm"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSubmitAction(); }}>
          <Stack gap="md">
            {pendingAction?.action.inputs && pendingAction.action.inputs.length > 0 ? (
              <>
                {pendingAction.action.inputs.map(renderInput)}
                <Group justify="flex-end" mt="md">
                  <Button variant="light" onClick={closeConfirm}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    color={pendingAction.action.color || 'blue'}
                    loading={actionLoading}
                  >
                    Exécuter
                  </Button>
                </Group>
              </>
            ) : (
              <>
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
                    onClick={handleSubmitAction}
                  >
                    Confirmer
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </form>
      </Modal>

      {/* Output Modal */}
      <Modal
        opened={outputOpened}
        onClose={closeOutput}
        title="Résultat de la commande"
        centered
        size="lg"
      >
        <ScrollArea h={400}>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '12px',
            backgroundColor: 'var(--mantine-color-dark-7)',
            padding: '12px',
            borderRadius: '4px',
          }}>
            {actionOutput}
          </pre>
        </ScrollArea>
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={closeOutput}>
            Fermer
          </Button>
        </Group>
      </Modal>
    </Paper>
  );
}
