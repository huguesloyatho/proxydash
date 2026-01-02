'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Title,
  Text,
  Group,
  Button,
  Table,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  Switch,
  MultiSelect,
  Stack,
  CopyButton,
  Tooltip,
  Menu,
  Code,
  Accordion,
  Alert,
  Loader,
  Center,
  Tabs,
  Card,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconDotsVertical,
  IconPlayerPlay,
  IconHistory,
  IconWebhook,
  IconAlertCircle,
  IconInfoCircle,
  IconBrandGithub,
  IconBrandGitlab,
  IconActivity,
  IconBell,
  IconChartBar,
  IconTemplate,
  IconCode,
  IconKey,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import { webhooksApi, Webhook, WebhookWithSecret, WebhookEvent, WebhookTemplate } from '@/lib/api/webhooks';
import { notificationsApi } from '@/lib/api/notifications';

interface NotificationChannel {
  id: number;
  name: string;
  channel_type: string;
}

export function WebhooksSettings() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [templates, setTemplates] = useState<WebhookTemplate[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookWithSecret | null>(null);
  const [eventsModal, setEventsModal] = useState<{ open: boolean; webhookId: number | null }>({
    open: false,
    webhookId: null,
  });
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testLoading, setTestLoading] = useState<number | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      event_types: [] as string[],
      create_alert: true,
      alert_severity: 'info' as 'info' | 'warning' | 'error' | 'success',
      forward_to_channels: [] as string[],
      title_template: '',
      message_template: '',
      is_enabled: true,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [webhooksData, templatesData, channelsData] = await Promise.all([
        webhooksApi.list(),
        webhooksApi.getTemplates(),
        notificationsApi.listChannels(),
      ]);
      setWebhooks(webhooksData);
      setTemplates(templatesData);
      setChannels(channelsData);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les webhooks',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    form.reset();
    setEditingWebhook(null);
    setShowSecret(false);
    setModalOpen(true);
  };

  const openEditModal = async (webhook: Webhook) => {
    try {
      const fullWebhook = await webhooksApi.get(webhook.id);
      setEditingWebhook(fullWebhook);
      form.setValues({
        name: fullWebhook.name,
        description: fullWebhook.description || '',
        event_types: fullWebhook.event_types,
        create_alert: fullWebhook.create_alert,
        alert_severity: fullWebhook.alert_severity,
        forward_to_channels: fullWebhook.forward_to_channels.map(String),
        title_template: fullWebhook.title_template || '',
        message_template: fullWebhook.message_template || '',
        is_enabled: fullWebhook.is_enabled,
      });
      setShowSecret(false);
      setModalOpen(true);
    } catch (error) {
      console.error('Failed to load webhook:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger le webhook',
        color: 'red',
      });
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      if (editingWebhook) {
        await webhooksApi.update(editingWebhook.id, {
          ...values,
          forward_to_channels: values.forward_to_channels.map(Number),
        });
        notifications.show({
          title: 'Succès',
          message: 'Webhook mis à jour',
          color: 'green',
        });
      } else {
        await webhooksApi.create({
          ...values,
          forward_to_channels: values.forward_to_channels.map(Number),
        });
        notifications.show({
          title: 'Succès',
          message: 'Webhook créé',
          color: 'green',
        });
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to save webhook:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de sauvegarder le webhook',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce webhook ?')) return;
    try {
      await webhooksApi.delete(id);
      notifications.show({
        title: 'Succès',
        message: 'Webhook supprimé',
        color: 'green',
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de supprimer le webhook',
        color: 'red',
      });
    }
  };

  const handleToggleEnabled = async (webhook: Webhook) => {
    try {
      await webhooksApi.update(webhook.id, { is_enabled: !webhook.is_enabled });
      loadData();
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  const handleRegenerateToken = async () => {
    if (!editingWebhook) return;
    if (!confirm('Régénérer le token ? L\'ancien token ne fonctionnera plus.')) return;
    try {
      const result = await webhooksApi.regenerateToken(editingWebhook.id);
      setEditingWebhook({ ...editingWebhook, token: result.token });
      notifications.show({
        title: 'Succès',
        message: 'Token régénéré',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to regenerate token:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de régénérer le token',
        color: 'red',
      });
    }
  };

  const handleRegenerateSecret = async () => {
    if (!editingWebhook) return;
    try {
      const result = await webhooksApi.regenerateSecret(editingWebhook.id);
      setEditingWebhook({ ...editingWebhook, secret: result.secret });
      notifications.show({
        title: 'Succès',
        message: 'Secret régénéré',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to regenerate secret:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de régénérer le secret',
        color: 'red',
      });
    }
  };

  const handleTest = async (id: number) => {
    setTestLoading(id);
    try {
      const result = await webhooksApi.test(id);
      notifications.show({
        title: result.success ? 'Test réussi' : 'Test échoué',
        message: result.message,
        color: result.success ? 'green' : 'red',
      });
    } catch (error) {
      console.error('Failed to test webhook:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de tester le webhook',
        color: 'red',
      });
    } finally {
      setTestLoading(null);
    }
  };

  const loadEvents = async (webhookId: number) => {
    setEventsLoading(true);
    try {
      const result = await webhooksApi.getEvents(webhookId, { limit: 50 });
      setEvents(result.events);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setEventsLoading(false);
    }
  };

  const openEventsModal = (webhookId: number) => {
    setEventsModal({ open: true, webhookId });
    loadEvents(webhookId);
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      form.setValues({
        ...form.values,
        event_types: template.event_types,
        title_template: template.title_template,
        message_template: template.message_template,
      });
    }
  };

  const eventTypeOptions = [
    { value: 'github_push', label: 'GitHub Push' },
    { value: 'github_pull_request', label: 'GitHub Pull Request' },
    { value: 'github_issues', label: 'GitHub Issues' },
    { value: 'github_release', label: 'GitHub Release' },
    { value: 'gitlab_push', label: 'GitLab Push' },
    { value: 'gitlab_merge_request', label: 'GitLab Merge Request' },
    { value: 'gitlab_issue', label: 'GitLab Issue' },
    { value: 'uptime_kuma', label: 'Uptime Kuma' },
    { value: 'prometheus', label: 'Prometheus Alertmanager' },
    { value: 'grafana', label: 'Grafana' },
    { value: 'generic', label: 'Générique' },
    { value: 'custom', label: 'Personnalisé' },
  ];

  const severityOptions = [
    { value: 'info', label: 'Info' },
    { value: 'success', label: 'Succès' },
    { value: 'warning', label: 'Avertissement' },
    { value: 'error', label: 'Erreur' },
  ];

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={2}>Webhooks</Title>
          <Text c="dimmed" size="sm">
            Recevez des notifications d'applications externes
          </Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Nouveau Webhook
        </Button>
      </Group>

      {/* Info Card */}
      <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="lg">
        Les webhooks permettent de recevoir des notifications depuis GitHub, GitLab, Uptime Kuma,
        Prometheus, Grafana et d'autres applications. Chaque webhook fournit une URL unique à
        configurer dans l'application source.
      </Alert>

      {/* Templates Quick Start */}
      {webhooks.length === 0 && templates.length > 0 && (
        <Paper withBorder p="md" mb="lg">
          <Title order={4} mb="md">
            <Group gap="xs">
              <IconTemplate size={20} />
              Démarrage rapide
            </Group>
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {templates.slice(0, 6).map((template) => {
              const getTemplateIcon = () => {
                switch (template.id) {
                  case 'github': return <IconBrandGithub size={20} />;
                  case 'gitlab': return <IconBrandGitlab size={20} />;
                  case 'uptime_kuma': return <IconActivity size={20} />;
                  case 'prometheus': return <IconChartBar size={20} />;
                  case 'grafana': return <IconChartBar size={20} />;
                  default: return <IconWebhook size={20} />;
                }
              };
              return (
                <Card key={template.id} withBorder padding="sm">
                  <Group gap="sm" mb="xs">
                    {getTemplateIcon()}
                    <Text fw={500}>{template.name}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    {template.description}
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    fullWidth
                    onClick={() => {
                      openCreateModal();
                      setTimeout(() => applyTemplate(template.id), 100);
                    }}
                  >
                    Utiliser ce template
                  </Button>
                </Card>
              );
            })}
          </SimpleGrid>
        </Paper>
      )}

      {/* Webhooks Table */}
      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>URL</Table.Th>
              <Table.Th>Types</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={120}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {webhooks.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Center py="xl">
                    <Stack align="center" gap="xs">
                      <IconWebhook size={48} color="gray" />
                      <Text c="dimmed">Aucun webhook configuré</Text>
                    </Stack>
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : (
              webhooks.map((webhook) => (
                <Table.Tr key={webhook.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text fw={500}>{webhook.name}</Text>
                      {!webhook.is_enabled && (
                        <Badge size="xs" color="gray">
                          Désactivé
                        </Badge>
                      )}
                    </Group>
                    {webhook.description && (
                      <Text size="xs" c="dimmed">
                        {webhook.description}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Code style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {webhook.url.replace(/^https?:\/\//, '')}
                      </Code>
                      <CopyButton value={webhook.url}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? 'Copié!' : 'Copier l\'URL'}>
                            <ActionIcon variant="subtle" size="sm" onClick={copy}>
                              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {webhook.event_types.slice(0, 2).map((type) => (
                        <Badge key={type} size="xs" variant="light">
                          {type}
                        </Badge>
                      ))}
                      {webhook.event_types.length > 2 && (
                        <Badge size="xs" variant="light" color="gray">
                          +{webhook.event_types.length - 2}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      size="sm"
                      checked={webhook.is_enabled}
                      onChange={() => handleToggleEnabled(webhook)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Tester">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => handleTest(webhook.id)}
                          loading={testLoading === webhook.id}
                        >
                          <IconPlayerPlay size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="subtle" size="sm">
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            onClick={() => openEditModal(webhook)}
                          >
                            Modifier
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconHistory size={14} />}
                            onClick={() => openEventsModal(webhook.id)}
                          >
                            Historique
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => handleDelete(webhook.id)}
                          >
                            Supprimer
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWebhook ? 'Modifier le webhook' : 'Nouveau webhook'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Tabs defaultValue="general">
            <Tabs.List mb="md">
              <Tabs.Tab value="general">Général</Tabs.Tab>
              <Tabs.Tab value="templates">Templates</Tabs.Tab>
              {editingWebhook && <Tabs.Tab value="credentials">Credentials</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="general">
              <Stack gap="md">
                <TextInput
                  label="Nom"
                  placeholder="GitHub Notifications"
                  required
                  {...form.getInputProps('name')}
                />

                <Textarea
                  label="Description"
                  placeholder="Notifications des événements GitHub"
                  {...form.getInputProps('description')}
                />

                <MultiSelect
                  label="Types d'événements"
                  placeholder="Sélectionner les types"
                  data={eventTypeOptions}
                  searchable
                  {...form.getInputProps('event_types')}
                />

                <Switch
                  label="Créer une alerte pour chaque événement"
                  {...form.getInputProps('create_alert', { type: 'checkbox' })}
                />

                {form.values.create_alert && (
                  <Select
                    label="Sévérité de l'alerte"
                    data={severityOptions}
                    {...form.getInputProps('alert_severity')}
                  />
                )}

                <MultiSelect
                  label="Transférer aux canaux"
                  placeholder="Sélectionner les canaux"
                  data={channels.map((c) => ({ value: String(c.id), label: c.name }))}
                  {...form.getInputProps('forward_to_channels')}
                />

                <Switch
                  label="Webhook actif"
                  {...form.getInputProps('is_enabled', { type: 'checkbox' })}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="templates">
              <Stack gap="md">
                <Alert icon={<IconInfoCircle size={16} />} color="blue">
                  Utilisez des templates pour formatter les notifications. Variables disponibles:{' '}
                  <Code>{'{{event_type}}'}</Code>, <Code>{'{{payload.xxx}}'}</Code>,{' '}
                  <Code>{'{{timestamp}}'}</Code>
                </Alert>

                {templates.length > 0 && (
                  <Select
                    label="Appliquer un template"
                    placeholder="Choisir un template..."
                    data={templates.filter((t) => t.id).map((t) => ({ value: t.id, label: t.name }))}
                    onChange={(value) => value && applyTemplate(value)}
                    clearable
                  />
                )}

                <TextInput
                  label="Template de titre"
                  placeholder="{{event_type}}: {{payload.repository.name}}"
                  {...form.getInputProps('title_template')}
                />

                <Textarea
                  label="Template de message"
                  placeholder="Événement reçu de {{payload.sender.login}}"
                  minRows={4}
                  {...form.getInputProps('message_template')}
                />
              </Stack>
            </Tabs.Panel>

            {editingWebhook && (
              <Tabs.Panel value="credentials">
                <Stack gap="md">
                  <Box>
                    <Text size="sm" fw={500} mb="xs">
                      URL du webhook
                    </Text>
                    <Group gap="xs">
                      <Code style={{ flex: 1, padding: '8px 12px' }}>
                        {editingWebhook.url}
                      </Code>
                      <CopyButton value={editingWebhook.url || ''}>
                        {({ copied, copy }) => (
                          <Button
                            variant="light"
                            size="xs"
                            leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            onClick={copy}
                          >
                            {copied ? 'Copié!' : 'Copier'}
                          </Button>
                        )}
                      </CopyButton>
                    </Group>
                    <Button
                      variant="subtle"
                      size="xs"
                      color="orange"
                      mt="xs"
                      leftSection={<IconRefresh size={14} />}
                      onClick={handleRegenerateToken}
                    >
                      Régénérer le token
                    </Button>
                  </Box>

                  <Divider />

                  <Box>
                    <Text size="sm" fw={500} mb="xs">
                      Secret (pour signature HMAC)
                    </Text>
                    <Group gap="xs">
                      <Code style={{ flex: 1, padding: '8px 12px' }}>
                        {showSecret
                          ? editingWebhook.secret || '(non défini)'
                          : '••••••••••••••••'}
                      </Code>
                      <ActionIcon
                        variant="subtle"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </ActionIcon>
                      {editingWebhook.secret && (
                        <CopyButton value={editingWebhook.secret}>
                          {({ copied, copy }) => (
                            <ActionIcon variant="subtle" onClick={copy}>
                              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                            </ActionIcon>
                          )}
                        </CopyButton>
                      )}
                    </Group>
                    <Button
                      variant="subtle"
                      size="xs"
                      color="orange"
                      mt="xs"
                      leftSection={<IconKey size={14} />}
                      onClick={handleRegenerateSecret}
                    >
                      {editingWebhook.secret ? 'Régénérer le secret' : 'Générer un secret'}
                    </Button>
                    <Text size="xs" c="dimmed" mt="xs">
                      Le secret est utilisé pour vérifier la signature HMAC des requêtes (header
                      X-Hub-Signature-256).
                    </Text>
                  </Box>
                </Stack>
              </Tabs.Panel>
            )}
          </Tabs>

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">{editingWebhook ? 'Enregistrer' : 'Créer'}</Button>
          </Group>
        </form>
      </Modal>

      {/* Events History Modal */}
      <Modal
        opened={eventsModal.open}
        onClose={() => setEventsModal({ open: false, webhookId: null })}
        title="Historique des événements"
        size="xl"
      >
        {eventsLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : events.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconHistory size={48} color="gray" />
              <Text c="dimmed">Aucun événement reçu</Text>
            </Stack>
          </Center>
        ) : (
          <Accordion>
            {events.map((event) => (
              <Accordion.Item key={event.id} value={String(event.id)}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Badge
                        size="sm"
                        color={event.processed ? 'green' : event.error_message ? 'red' : 'gray'}
                      >
                        {event.event_type}
                      </Badge>
                      <Text size="sm">
                        {new Date(event.created_at).toLocaleString()}
                      </Text>
                    </Group>
                    {event.error_message && (
                      <Badge size="xs" color="red">
                        Erreur
                      </Badge>
                    )}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {event.error_message && (
                      <Alert color="red" icon={<IconAlertCircle size={16} />}>
                        {event.error_message}
                      </Alert>
                    )}
                    <Text size="sm" fw={500}>
                      Payload:
                    </Text>
                    <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(event.payload, null, 2)}
                    </Code>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Modal>
    </Box>
  );
}
