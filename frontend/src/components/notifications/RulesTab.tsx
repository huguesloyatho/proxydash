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
  Textarea,
  Select,
  Switch,
  NumberInput,
  MultiSelect,
  LoadingOverlay,
  Menu,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDots,
  IconPlayerPlay,
  IconPlayerPause,
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { notificationsApi } from '@/lib/api/notifications';
import { serversApi } from '@/lib/api';
import type {
  AlertRuleListItem,
  AlertRule,
  NotificationChannelListItem,
  RuleTypeInfo,
  AlertSeverity,
  Server,
} from '@/types';

interface RulesTabProps {
  onUpdate: () => void;
}

const severityColors: Record<AlertSeverity, string> = {
  info: 'blue',
  warning: 'yellow',
  error: 'orange',
  critical: 'red',
};

export function RulesTab({ onUpdate }: RulesTabProps) {
  const [rules, setRules] = useState<AlertRuleListItem[]>([]);
  const [ruleTypes, setRuleTypes] = useState<RuleTypeInfo[]>([]);
  const [channels, setChannels] = useState<NotificationChannelListItem[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      is_enabled: true,
      rule_type: '',
      server_id: '' as string | number,
      severity: 'warning' as AlertSeverity,
      cooldown_minutes: 15,
      channel_ids: [] as string[],
      title_template: '',
      message_template: '',
      // Dynamic config fields
      container_name: '',
      metric: 'cpu',
      condition: '>',
      threshold: '80',
      command: '',
      parser: 'text',
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rulesData, typesData, channelsData, serversData] = await Promise.all([
        notificationsApi.listRules(),
        notificationsApi.getRuleTypes(),
        notificationsApi.listChannels(),
        serversApi.list(),
      ]);
      setRules(rulesData);
      setRuleTypes(typesData);
      setChannels(channelsData);
      setServers(serversData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRuleType = ruleTypes.find((t) => t.key === form.values.rule_type);

  const handleOpenCreate = () => {
    form.reset();
    setEditingRule(null);
    setModalOpen(true);
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const rule = await notificationsApi.getRule(id);
      setEditingRule(rule);
      form.setValues({
        name: rule.name,
        description: rule.description || '',
        is_enabled: rule.is_enabled,
        rule_type: rule.rule_type,
        server_id: rule.server_id?.toString() || '',
        severity: rule.severity,
        cooldown_minutes: rule.cooldown_minutes,
        channel_ids: rule.channel_ids.map(String),
        title_template: rule.title_template || '',
        message_template: rule.message_template || '',
        container_name: (rule.source_config?.container_name as string) || '',
        metric: (rule.source_config?.metric as string) || 'cpu',
        condition: (rule.source_config?.condition as string) || '>',
        threshold: rule.source_config?.threshold?.toString() || '80',
        command: (rule.source_config?.command as string) || '',
        parser: (rule.source_config?.parser as string) || 'text',
      });
      setModalOpen(true);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger la règle',
        color: 'red',
      });
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      // Build source_config based on rule type
      const source_config: Record<string, unknown> = {};

      if (values.rule_type === 'crowdsec_ban' || values.rule_type === 'container_down') {
        source_config.container_name = values.container_name;
      } else if (values.rule_type === 'threshold') {
        source_config.metric = values.metric;
        source_config.condition = values.condition;
        source_config.threshold = parseFloat(values.threshold);
      } else if (values.rule_type === 'custom_command') {
        source_config.command = values.command;
        source_config.parser = values.parser;
        source_config.condition = values.condition;
        source_config.threshold = values.threshold;
      }

      const data = {
        name: values.name,
        description: values.description || undefined,
        is_enabled: values.is_enabled,
        rule_type: values.rule_type,
        server_id: values.server_id ? Number(values.server_id) : undefined,
        source_config,
        severity: values.severity,
        cooldown_minutes: values.cooldown_minutes,
        channel_ids: values.channel_ids.map(Number),
        title_template: values.title_template || undefined,
        message_template: values.message_template || undefined,
      };

      if (editingRule) {
        await notificationsApi.updateRule(editingRule.id, data);
        notifications.show({
          title: 'Succès',
          message: 'Règle mise à jour',
          color: 'green',
        });
      } else {
        await notificationsApi.createRule(data);
        notifications.show({
          title: 'Succès',
          message: 'Règle créée',
          color: 'green',
        });
      }

      setModalOpen(false);
      loadData();
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
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) return;

    try {
      await notificationsApi.deleteRule(id);
      notifications.show({
        title: 'Succès',
        message: 'Règle supprimée',
        color: 'green',
      });
      loadData();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de supprimer',
        color: 'red',
      });
    }
  };

  const handleToggleEnabled = async (rule: AlertRuleListItem) => {
    try {
      await notificationsApi.updateRule(rule.id, {
        is_enabled: !rule.is_enabled,
      });
      loadData();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier la règle',
        color: 'red',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={loading} />

      <Group justify="space-between">
        <Text c="dimmed">
          Définissez les conditions qui déclenchent des alertes.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
          Ajouter une règle
        </Button>
      </Group>

      {rules.length === 0 && !loading ? (
        <Text c="dimmed" ta="center" py="xl">
          Aucune règle configurée. Créez votre première règle d&apos;alerte.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Sévérité</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Déclenchements</Table.Th>
              <Table.Th>Dernier</Table.Th>
              <Table.Th w={100}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rules.map((rule) => (
              <Table.Tr key={rule.id}>
                <Table.Td>{rule.name}</Table.Td>
                <Table.Td>
                  <Badge variant="light">
                    {ruleTypes.find((t) => t.key === rule.rule_type)?.name || rule.rule_type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={severityColors[rule.severity]} variant="light">
                    {rule.severity}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={rule.is_enabled}
                    onChange={() => handleToggleEnabled(rule)}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <Badge color="gray" variant="light">
                    {rule.trigger_count}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(rule.last_triggered_at as string | null)}
                  </Text>
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
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleOpenEdit(rule.id)}
                      >
                        Modifier
                      </Menu.Item>
                      <Menu.Item
                        leftSection={
                          rule.is_enabled ? (
                            <IconPlayerPause size={14} />
                          ) : (
                            <IconPlayerPlay size={14} />
                          )
                        }
                        onClick={() => handleToggleEnabled(rule)}
                      >
                        {rule.is_enabled ? 'Désactiver' : 'Activer'}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => handleDelete(rule.id)}
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
        title={editingRule ? 'Modifier la règle' : 'Nouvelle règle'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Nom"
              placeholder="Alerte CrowdSec - Production"
              required
              {...form.getInputProps('name')}
            />

            <Textarea
              label="Description"
              placeholder="Détecteur de bans CrowdSec sur le serveur de production"
              {...form.getInputProps('description')}
            />

            <Select
              label="Type de règle"
              placeholder="Sélectionnez un type"
              data={ruleTypes.map((t) => ({
                value: t.key,
                label: t.name,
              }))}
              required
              disabled={!!editingRule}
              {...form.getInputProps('rule_type')}
            />

            {selectedRuleType && (
              <Text size="sm" c="dimmed">
                {selectedRuleType.description}
              </Text>
            )}

            <Select
              label="Serveur"
              placeholder="Sélectionnez un serveur"
              data={servers.map((s) => ({
                value: s.id.toString(),
                label: s.name,
              }))}
              clearable
              {...form.getInputProps('server_id')}
            />

            {/* Dynamic config fields based on rule type */}
            {(form.values.rule_type === 'crowdsec_ban' ||
              form.values.rule_type === 'container_down') && (
              <TextInput
                label="Nom du conteneur"
                placeholder="crowdsec"
                required
                {...form.getInputProps('container_name')}
              />
            )}

            {form.values.rule_type === 'threshold' && (
              <Group grow>
                <Select
                  label="Métrique"
                  data={[
                    { value: 'cpu', label: 'CPU' },
                    { value: 'memory', label: 'Mémoire' },
                    { value: 'disk', label: 'Disque' },
                  ]}
                  {...form.getInputProps('metric')}
                />
                <Select
                  label="Condition"
                  data={[
                    { value: '>', label: '>' },
                    { value: '>=', label: '>=' },
                    { value: '<', label: '<' },
                    { value: '<=', label: '<=' },
                    { value: '==', label: '==' },
                  ]}
                  {...form.getInputProps('condition')}
                />
                <TextInput
                  label="Seuil (%)"
                  placeholder="80"
                  {...form.getInputProps('threshold')}
                />
              </Group>
            )}

            {form.values.rule_type === 'custom_command' && (
              <>
                <Textarea
                  label="Commande"
                  placeholder="docker ps -q | wc -l"
                  required
                  {...form.getInputProps('command')}
                />
                <Group grow>
                  <Select
                    label="Parser"
                    data={[
                      { value: 'number', label: 'Nombre' },
                      { value: 'boolean', label: 'Booléen' },
                      { value: 'text', label: 'Texte' },
                    ]}
                    {...form.getInputProps('parser')}
                  />
                  <Select
                    label="Condition"
                    data={[
                      { value: '>', label: '>' },
                      { value: '>=', label: '>=' },
                      { value: '<', label: '<' },
                      { value: '<=', label: '<=' },
                      { value: '==', label: '==' },
                      { value: 'contains', label: 'Contient' },
                      { value: 'not_contains', label: 'Ne contient pas' },
                    ]}
                    {...form.getInputProps('condition')}
                  />
                  <TextInput
                    label="Valeur attendue"
                    placeholder="0"
                    {...form.getInputProps('threshold')}
                  />
                </Group>
              </>
            )}

            <Select
              label="Sévérité"
              data={[
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'error', label: 'Error' },
                { value: 'critical', label: 'Critical' },
              ]}
              {...form.getInputProps('severity')}
            />

            <NumberInput
              label="Cooldown (minutes)"
              description="Temps minimum entre deux alertes de cette règle"
              min={1}
              max={1440}
              {...form.getInputProps('cooldown_minutes')}
            />

            <MultiSelect
              label="Canaux de notification"
              placeholder="Sélectionnez les canaux"
              data={channels.map((c) => ({
                value: c.id.toString(),
                label: `${c.name} (${c.channel_type})`,
              }))}
              {...form.getInputProps('channel_ids')}
            />

            <TextInput
              label="Template du titre (optionnel)"
              placeholder="⚠️ {{server_name}} - IP bannie"
              description="Variables disponibles: {{server_name}}, {{ip}}, {{reason}}, etc."
              {...form.getInputProps('title_template')}
            />

            <Textarea
              label="Template du message (optionnel)"
              placeholder="L'IP {{ip}} a été bannie pour: {{reason}}"
              {...form.getInputProps('message_template')}
            />

            <Switch
              label="Règle active"
              {...form.getInputProps('is_enabled', { type: 'checkbox' })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editingRule ? 'Mettre à jour' : 'Créer'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
