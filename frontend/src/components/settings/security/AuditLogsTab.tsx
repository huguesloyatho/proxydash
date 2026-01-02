'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Group,
  Table,
  Badge,
  Text,
  Select,
  TextInput,
  LoadingOverlay,
  Button,
  Paper,
  SimpleGrid,
  Tooltip,
  Pagination,
  Code,
  Modal,
} from '@mantine/core';
import {
  IconRefresh,
  IconSearch,
  IconUser,
  IconCalendar,
  IconEye,
} from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { securityApi, AuditLog, AuditStats, AuditAction } from '@/lib/api/security';

const ACTION_COLORS: Record<string, string> = {
  login: 'green',
  login_failed: 'red',
  logout: 'gray',
  password_change: 'yellow',
  '2fa_enabled': 'teal',
  '2fa_disabled': 'orange',
  user_created: 'blue',
  user_deleted: 'red',
  config_exported: 'violet',
  config_imported: 'violet',
  session_revoked: 'orange',
};

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [actions, setActions] = useState<AuditAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    loadActions();
    loadStats();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, filterAction, startDate, endDate]);

  const loadActions = async () => {
    try {
      const data = await securityApi.getAuditActions();
      setActions(data);
    } catch (error) {
      console.error('Failed to load actions:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await securityApi.getAuditStats();
      setStats(data);
      setTotalPages(Math.ceil(data.total_entries / ITEMS_PER_PAGE));
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await securityApi.listAuditLogs({
        action: filterAction || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      });
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action] || 'gray';
  };

  return (
    <Stack>
      {/* Stats */}
      {stats && (
        <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
          <Paper withBorder p="md" ta="center">
            <Text size="xl" fw={700}>{stats.total_entries}</Text>
            <Text size="sm" c="dimmed">Total des entrées</Text>
          </Paper>
          <Paper withBorder p="md" ta="center">
            <Text size="xl" fw={700}>{stats.entries_today}</Text>
            <Text size="sm" c="dimmed">Aujourd&apos;hui</Text>
          </Paper>
          <Paper withBorder p="md" ta="center">
            <Text size="xl" fw={700}>{stats.entries_this_week}</Text>
            <Text size="sm" c="dimmed">Cette semaine</Text>
          </Paper>
          <Paper withBorder p="md" ta="center">
            <Text size="xl" fw={700}>{stats.top_users.length}</Text>
            <Text size="sm" c="dimmed">Utilisateurs actifs</Text>
          </Paper>
        </SimpleGrid>
      )}

      {/* Filters */}
      <Group>
        <Select
          placeholder="Filtrer par action"
          data={actions.map((a) => ({ value: a.value, label: a.label }))}
          value={filterAction}
          onChange={setFilterAction}
          clearable
          leftSection={<IconSearch size={16} />}
          w={200}
        />
        <DatePickerInput
          placeholder="Date début"
          value={startDate}
          onChange={setStartDate}
          clearable
          leftSection={<IconCalendar size={16} />}
          w={180}
        />
        <DatePickerInput
          placeholder="Date fin"
          value={endDate}
          onChange={setEndDate}
          clearable
          leftSection={<IconCalendar size={16} />}
          w={180}
        />
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => {
            loadLogs();
            loadStats();
          }}
        >
          Actualiser
        </Button>
      </Group>

      {/* Table */}
      <Paper withBorder pos="relative">
        <LoadingOverlay visible={loading} />

        {logs.length === 0 && !loading ? (
          <Text c="dimmed" ta="center" py="xl">
            Aucun log d&apos;audit trouvé
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Utilisateur</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Ressource</Table.Th>
                <Table.Th>IP</Table.Th>
                <Table.Th w={80}>Détails</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {logs.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>
                    <Text size="sm">{formatDate(log.created_at)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconUser size={14} />
                      <Text size="sm">{log.username || 'Système'}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getActionColor(log.action)} variant="light">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {log.resource_type && (
                      <Text size="sm">
                        {log.resource_type}
                        {log.resource_name && `: ${log.resource_name}`}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={log.user_agent || 'N/A'}>
                      <Text size="sm" c="dimmed">
                        {log.ip_address || 'N/A'}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    {log.details && (
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => setSelectedLog(log)}
                      >
                        <IconEye size={14} />
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            value={page}
            onChange={setPage}
            total={totalPages}
          />
        </Group>
      )}

      {/* Details Modal */}
      <Modal
        opened={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Détails du log"
        size="lg"
      >
        {selectedLog && (
          <Stack>
            <Group>
              <Text fw={500}>Action:</Text>
              <Badge color={getActionColor(selectedLog.action)}>
                {selectedLog.action}
              </Badge>
            </Group>
            <Group>
              <Text fw={500}>Utilisateur:</Text>
              <Text>{selectedLog.username || 'Système'}</Text>
            </Group>
            <Group>
              <Text fw={500}>Date:</Text>
              <Text>{formatDate(selectedLog.created_at)}</Text>
            </Group>
            {selectedLog.ip_address && (
              <Group>
                <Text fw={500}>IP:</Text>
                <Text>{selectedLog.ip_address}</Text>
              </Group>
            )}
            {selectedLog.user_agent && (
              <>
                <Text fw={500}>User Agent:</Text>
                <Text size="sm" c="dimmed">{selectedLog.user_agent}</Text>
              </>
            )}
            {selectedLog.details && (
              <>
                <Text fw={500}>Détails:</Text>
                <Code block>{JSON.stringify(selectedLog.details, null, 2)}</Code>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
