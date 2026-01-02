'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Group,
  Button,
  Table,
  ActionIcon,
  Badge,
  Text,
  Modal,
  TextInput,
  Select,
  Switch,
  Tooltip,
  Menu,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSend,
  IconDots,
  IconMail,
  IconBrandTelegram,
  IconBell,
  IconWebhook,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { notificationsApi } from '@/lib/api/notifications';
import type { NotificationChannelListItem, NotificationChannel, ChannelType, AlertSeverity } from '@/types';

interface ChannelsTabProps {
  onUpdate: () => void;
}

const channelTypeIcons: Record<ChannelType, React.ReactNode> = {
  email: <IconMail size={18} />,
  telegram: <IconBrandTelegram size={18} />,
  push: <IconBell size={18} />,
  webhook: <IconWebhook size={18} />,
};

const channelTypeLabels: Record<ChannelType, string> = {
  email: 'Email',
  telegram: 'Telegram',
  push: 'Push',
  webhook: 'Webhook',
};

const severityColors: Record<AlertSeverity, string> = {
  info: 'blue',
  warning: 'yellow',
  error: 'orange',
  critical: 'red',
};

export function ChannelsTab({ onUpdate }: ChannelsTabProps) {
  const [channels, setChannels] = useState<NotificationChannelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [testing, setTesting] = useState<number | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      channel_type: 'email' as ChannelType,
      is_enabled: true,
      is_default: false,
      min_severity: 'warning' as AlertSeverity,
      // Email config
      email_address: '',
      // Telegram config
      telegram_chat_id: '',
      telegram_bot_token: '',
      // Webhook config
      webhook_url: '',
      webhook_headers: '',
    },
  });

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const data = await notificationsApi.listChannels();
      setChannels(data);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    form.reset();
    setEditingChannel(null);
    setModalOpen(true);
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const channel = await notificationsApi.getChannel(id);
      setEditingChannel(channel);
      form.setValues({
        name: channel.name,
        channel_type: channel.channel_type,
        is_enabled: channel.is_enabled,
        is_default: channel.is_default,
        min_severity: channel.min_severity,
        email_address: (channel.config?.address as string) || '',
        telegram_chat_id: (channel.config?.chat_id as string) || '',
        telegram_bot_token: (channel.config?.bot_token as string) || '',
        webhook_url: (channel.config?.url as string) || '',
        webhook_headers: channel.config?.headers ? JSON.stringify(channel.config.headers) : '',
      });
      setModalOpen(true);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger le canal',
        color: 'red',
      });
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      const config: Record<string, unknown> = {};

      if (values.channel_type === 'email') {
        config.address = values.email_address;
      } else if (values.channel_type === 'telegram') {
        config.chat_id = values.telegram_chat_id;
        if (values.telegram_bot_token) {
          config.bot_token = values.telegram_bot_token;
        }
      } else if (values.channel_type === 'webhook') {
        config.url = values.webhook_url;
        if (values.webhook_headers) {
          try {
            config.headers = JSON.parse(values.webhook_headers);
          } catch {
            notifications.show({
              title: 'Erreur',
              message: 'Headers JSON invalide',
              color: 'red',
            });
            return;
          }
        }
      }

      const data = {
        name: values.name,
        channel_type: values.channel_type,
        is_enabled: values.is_enabled,
        is_default: values.is_default,
        min_severity: values.min_severity,
        config,
      };

      if (editingChannel) {
        await notificationsApi.updateChannel(editingChannel.id, data);
        notifications.show({
          title: 'Succès',
          message: 'Canal mis à jour',
          color: 'green',
        });
      } else {
        await notificationsApi.createChannel(data);
        notifications.show({
          title: 'Succès',
          message: 'Canal créé',
          color: 'green',
        });
      }

      setModalOpen(false);
      loadChannels();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Une erreur est survenue',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce canal ?')) return;

    try {
      await notificationsApi.deleteChannel(id);
      notifications.show({
        title: 'Succès',
        message: 'Canal supprimé',
        color: 'green',
      });
      loadChannels();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de supprimer',
        color: 'red',
      });
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    try {
      const result = await notificationsApi.testChannel(id);
      if (result.success) {
        notifications.show({
          title: 'Test réussi',
          message: 'Notification de test envoyée avec succès',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
      } else {
        notifications.show({
          title: 'Test échoué',
          message: result.error_message || 'La notification n\'a pas pu être envoyée',
          color: 'red',
          icon: <IconX size={18} />,
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Erreur lors du test',
        color: 'red',
      });
    } finally {
      setTesting(null);
    }
  };

  const handleToggleEnabled = async (channel: NotificationChannelListItem) => {
    try {
      await notificationsApi.updateChannel(channel.id, {
        is_enabled: !channel.is_enabled,
      });
      loadChannels();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier le canal',
        color: 'red',
      });
    }
  };

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={loading} />

      <Group justify="space-between">
        <Text c="dimmed">
          Configurez les canaux par lesquels vous recevrez les notifications.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
          Ajouter un canal
        </Button>
      </Group>

      {channels.length === 0 && !loading ? (
        <Text c="dimmed" ta="center" py="xl">
          Aucun canal configuré. Créez votre premier canal de notification.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Sévérité min.</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Stats</Table.Th>
              <Table.Th w={100}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {channels.map((channel) => (
              <Table.Tr key={channel.id}>
                <Table.Td>
                  <Group gap="xs">
                    {channel.name}
                    {channel.is_default && (
                      <Badge size="xs" color="blue">
                        Défaut
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {channelTypeIcons[channel.channel_type]}
                    {channelTypeLabels[channel.channel_type]}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge color={severityColors[channel.min_severity]} variant="light">
                    {channel.min_severity}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={channel.is_enabled}
                    onChange={() => handleToggleEnabled(channel)}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="Envoyées">
                      <Badge color="green" variant="light" size="sm">
                        {channel.success_count}
                      </Badge>
                    </Tooltip>
                    <Tooltip label="Échecs">
                      <Badge color="red" variant="light" size="sm">
                        {channel.failure_count}
                      </Badge>
                    </Tooltip>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconSend size={14} />}
                        onClick={() => handleTest(channel.id)}
                        disabled={testing === channel.id}
                      >
                        {testing === channel.id ? 'Envoi...' : 'Tester'}
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleOpenEdit(channel.id)}
                      >
                        Modifier
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => handleDelete(channel.id)}
                      >
                        Supprimer
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingChannel ? 'Modifier le canal' : 'Nouveau canal'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Nom"
              placeholder="Mon canal email"
              required
              {...form.getInputProps('name')}
            />

            <Select
              label="Type de canal"
              data={[
                { value: 'email', label: 'Email' },
                { value: 'telegram', label: 'Telegram' },
                { value: 'webhook', label: 'Webhook' },
              ]}
              required
              disabled={!!editingChannel}
              {...form.getInputProps('channel_type')}
            />

            <Select
              label="Sévérité minimum"
              description="Ne recevez que les alertes de ce niveau ou supérieur"
              data={[
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'error', label: 'Error' },
                { value: 'critical', label: 'Critical' },
              ]}
              {...form.getInputProps('min_severity')}
            />

            {/* Email config */}
            {form.values.channel_type === 'email' && (
              <TextInput
                label="Adresse email"
                placeholder="email@example.com"
                required
                {...form.getInputProps('email_address')}
              />
            )}

            {/* Telegram config */}
            {form.values.channel_type === 'telegram' && (
              <>
                <TextInput
                  label="Chat ID"
                  placeholder="123456789"
                  description="Votre ID de chat Telegram (envoyez /start à @userinfobot)"
                  required
                  {...form.getInputProps('telegram_chat_id')}
                />
                <TextInput
                  label="Token du bot (optionnel)"
                  placeholder="123456:ABC-DEF..."
                  description="Laissez vide pour utiliser le bot global"
                  {...form.getInputProps('telegram_bot_token')}
                />
              </>
            )}

            {/* Webhook config */}
            {form.values.channel_type === 'webhook' && (
              <>
                <TextInput
                  label="URL du webhook"
                  placeholder="https://hooks.example.com/webhook"
                  required
                  {...form.getInputProps('webhook_url')}
                />
                <TextInput
                  label="Headers (JSON, optionnel)"
                  placeholder='{"Authorization": "Bearer xxx"}'
                  {...form.getInputProps('webhook_headers')}
                />
              </>
            )}

            <Group>
              <Switch
                label="Actif"
                {...form.getInputProps('is_enabled', { type: 'checkbox' })}
              />
              <Switch
                label="Canal par défaut"
                {...form.getInputProps('is_default', { type: 'checkbox' })}
              />
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editingChannel ? 'Mettre à jour' : 'Créer'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
