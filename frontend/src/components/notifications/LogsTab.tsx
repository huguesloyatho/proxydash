'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Group,
  Table,
  Badge,
  Text,
  Select,
  LoadingOverlay,
  Button,
  Tooltip,
} from '@mantine/core';
import {
  IconRefresh,
  IconCheck,
  IconX,
  IconMail,
  IconBrandTelegram,
  IconBell,
  IconWebhook,
} from '@tabler/icons-react';
import { notificationsApi } from '@/lib/api/notifications';
import type { NotificationLog, NotificationChannelListItem, ChannelType } from '@/types';

const channelTypeIcons: Record<ChannelType, React.ReactNode> = {
  email: <IconMail size={16} />,
  telegram: <IconBrandTelegram size={16} />,
  push: <IconBell size={16} />,
  webhook: <IconWebhook size={16} />,
};

export function LogsTab() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [channels, setChannels] = useState<NotificationChannelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [filterSuccess, setFilterSuccess] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [filterChannel, filterSuccess]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, channelsData] = await Promise.all([
        notificationsApi.listLogs({
          channel_id: filterChannel ? parseInt(filterChannel) : undefined,
          success: filterSuccess === '' ? undefined : filterSuccess === 'true',
          limit: 100,
        }),
        notificationsApi.listChannels(),
      ]);
      setLogs(logsData);
      setChannels(channelsData);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getChannelName = (channelId: number | null) => {
    if (!channelId) return '-';
    const channel = channels.find((c) => c.id === channelId);
    return channel?.name || `#${channelId}`;
  };

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={loading} />

      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Canal"
            clearable
            data={channels.map((c) => ({
              value: c.id.toString(),
              label: c.name,
            }))}
            value={filterChannel}
            onChange={(v) => setFilterChannel(v || '')}
            w={200}
          />
          <Select
            placeholder="Statut"
            clearable
            data={[
              { value: 'true', label: 'Succès' },
              { value: 'false', label: 'Échec' },
            ]}
            value={filterSuccess}
            onChange={(v) => setFilterSuccess(v || '')}
            w={150}
          />
        </Group>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={loadData}
        >
          Actualiser
        </Button>
      </Group>

      {logs.length === 0 && !loading ? (
        <Text c="dimmed" ta="center" py="xl">
          Aucun log de notification trouvé.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Canal</Table.Th>
              <Table.Th>Destinataire</Table.Th>
              <Table.Th>Titre</Table.Th>
              <Table.Th>Statut</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logs.map((log) => (
              <Table.Tr key={log.id}>
                <Table.Td>
                  <Text size="sm">{formatDate(log.sent_at)}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {channelTypeIcons[log.channel_type]}
                    <Text size="sm">{log.channel_type}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{getChannelName(log.channel_id)}</Text>
                </Table.Td>
                <Table.Td>
                  <Tooltip label={log.recipient}>
                    <Text size="sm" lineClamp={1} maw={150}>
                      {log.recipient}
                    </Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Tooltip label={log.title}>
                    <Text size="sm" lineClamp={1} maw={200}>
                      {log.title}
                    </Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  {log.success ? (
                    <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                      Succès
                    </Badge>
                  ) : (
                    <Tooltip label={log.error_message || 'Erreur inconnue'}>
                      <Badge color="red" variant="light" leftSection={<IconX size={12} />}>
                        Échec
                      </Badge>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
