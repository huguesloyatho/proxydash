'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Group,
  Modal,
  TextInput,
  NumberInput,
  Switch,
  ActionIcon,
  Badge,
  Text,
  Tooltip,
  Stack,
  Alert,
  PasswordInput,
  Loader,
  SegmentedControl,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconPlugConnected,
  IconServer,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconDatabase,
  IconApi,
  IconAlertTriangle,
  IconArrowLeft,
} from '@tabler/icons-react';
import Link from 'next/link';
import { npmInstancesApi } from '@/lib/api';

interface NpmInstance {
  id: number;
  name: string;
  connection_mode: 'database' | 'api';
  db_host: string | null;
  db_port: number;
  db_name: string | null;
  db_user: string | null;
  api_url: string | null;
  api_email: string | null;
  priority: number;
  is_active: boolean;
  is_online: boolean;
  is_degraded: boolean;
  last_error: string | null;
  created_at: string;
  last_synced_at: string | null;
}

export default function NpmInstancesPage() {
  const [instances, setInstances] = useState<NpmInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<NpmInstance | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<NpmInstance | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      connection_mode: 'database' as 'database' | 'api',
      // Database fields
      db_host: '',
      db_port: 5432,
      db_name: 'npm',
      db_user: 'npm',
      db_password: '',
      // API fields
      api_url: '',
      api_email: '',
      api_password: '',
      // Common
      priority: 100,
      is_active: true,
    },
    validate: {
      name: (value) => (!value ? 'Nom requis' : null),
      db_host: (value, values) =>
        values.connection_mode === 'database' && !value ? 'Hôte requis' : null,
      db_name: (value, values) =>
        values.connection_mode === 'database' && !value ? 'Base de données requise' : null,
      db_user: (value, values) =>
        values.connection_mode === 'database' && !value ? 'Utilisateur requis' : null,
      api_url: (value, values) =>
        values.connection_mode === 'api' && !value ? 'URL API requise' : null,
      api_email: (value, values) =>
        values.connection_mode === 'api' && !value ? 'Email requis' : null,
    },
  });

  const loadInstances = async () => {
    try {
      const data = await npmInstancesApi.list();
      setInstances(data);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les instances NPM',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const openCreateModal = () => {
    setEditingInstance(null);
    form.reset();
    setModalOpen(true);
  };

  const openEditModal = (instance: NpmInstance) => {
    setEditingInstance(instance);
    form.setValues({
      name: instance.name,
      connection_mode: instance.connection_mode,
      db_host: instance.db_host || '',
      db_port: instance.db_port || 5432,
      db_name: instance.db_name || 'npm',
      db_user: instance.db_user || 'npm',
      db_password: '',
      api_url: instance.api_url || '',
      api_email: instance.api_email || '',
      api_password: '',
      priority: instance.priority,
      is_active: instance.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      // Build data based on connection mode
      const baseData = {
        name: values.name,
        connection_mode: values.connection_mode,
        priority: values.priority,
        is_active: values.is_active,
      };

      let submitData: Record<string, unknown>;

      if (values.connection_mode === 'database') {
        submitData = {
          ...baseData,
          db_host: values.db_host,
          db_port: values.db_port,
          db_name: values.db_name,
          db_user: values.db_user,
          ...(values.db_password ? { db_password: values.db_password } : {}),
        };
      } else {
        submitData = {
          ...baseData,
          api_url: values.api_url,
          api_email: values.api_email,
          ...(values.api_password ? { api_password: values.api_password } : {}),
        };
      }

      if (editingInstance) {
        await npmInstancesApi.update(editingInstance.id, submitData);
        notifications.show({
          title: 'Succès',
          message: 'Instance NPM mise à jour',
          color: 'green',
        });
      } else {
        // For new instances, password is required
        if (values.connection_mode === 'database' && !values.db_password) {
          form.setFieldError('db_password', 'Mot de passe requis');
          return;
        }
        if (values.connection_mode === 'api' && !values.api_password) {
          form.setFieldError('api_password', 'Mot de passe requis');
          return;
        }
        await npmInstancesApi.create(submitData as Parameters<typeof npmInstancesApi.create>[0]);
        notifications.show({
          title: 'Succès',
          message: 'Instance NPM créée',
          color: 'green',
        });
      }
      setModalOpen(false);
      loadInstances();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Une erreur est survenue',
        color: 'red',
      });
    }
  };

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    try {
      const result = await npmInstancesApi.testConnection(id);
      const degradedMsg = result.is_degraded ? ' (mode dégradé)' : '';
      notifications.show({
        title: 'Connexion réussie',
        message: `${result.proxy_hosts_count} proxy hosts trouvés${degradedMsg}`,
        color: result.is_degraded ? 'yellow' : 'green',
      });
      loadInstances();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      notifications.show({
        title: 'Échec de connexion',
        message: err.response?.data?.detail || 'Impossible de se connecter',
        color: 'red',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await npmInstancesApi.delete(deleteConfirm.id);
      notifications.show({
        title: 'Succès',
        message: 'Instance NPM supprimée',
        color: 'green',
      });
      setDeleteConfirm(null);
      loadInstances();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Une erreur est survenue',
        color: 'red',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getConnectionInfo = (instance: NpmInstance) => {
    if (instance.connection_mode === 'api') {
      return instance.api_url || 'API';
    }
    return `${instance.db_user}@${instance.db_host}:${instance.db_port}/${instance.db_name}`;
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <ActionIcon
            component={Link}
            href="/dashboard"
            variant="subtle"
            size="lg"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconServer size={28} />
                Instances NPM
              </Group>
            </Title>
            <Text c="dimmed" size="sm">
              {instances.length} instance{instances.length > 1 ? 's' : ''} configurée{instances.length > 1 ? 's' : ''}
            </Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Ajouter une instance
        </Button>
      </Group>

      <Alert icon={<IconAlertCircle size={16} />} mb="lg" color="blue">
        Les instances NPM sont synchronisées par ordre de priorité. Si un même domaine existe dans plusieurs instances,
        celui de l&apos;instance avec la priorité la plus basse (numéro le plus petit) sera affiché.
      </Alert>

      <Alert icon={<IconAlertTriangle size={16} />} mb="lg" color="yellow">
        <strong>Mode API (dégradé)</strong> : L&apos;accès via l&apos;API NPM ne permet pas de récupérer la configuration nginx avancée.
        La détection de protection Authelia ne sera pas disponible pour ces instances.
      </Alert>

      {instances.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text c="dimmed" ta="center">
            Aucune instance NPM configurée. Ajoutez-en une pour commencer.
          </Text>
        </Paper>
      ) : (
        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nom</Table.Th>
                <Table.Th>Mode</Table.Th>
                <Table.Th>Connexion</Table.Th>
                <Table.Th>Priorité</Table.Th>
                <Table.Th>Statut</Table.Th>
                <Table.Th>Dernière sync</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {instances.map((instance) => (
                <Table.Tr key={instance.id}>
                  <Table.Td>
                    <Text fw={500}>{instance.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={instance.connection_mode === 'api' ? 'Mode dégradé - Authelia non détecté' : 'Mode complet'}>
                      <Badge
                        color={instance.connection_mode === 'api' ? 'yellow' : 'blue'}
                        leftSection={instance.connection_mode === 'api' ? <IconApi size={12} /> : <IconDatabase size={12} />}
                      >
                        {instance.connection_mode === 'api' ? 'API' : 'DB'}
                      </Badge>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {getConnectionInfo(instance)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="outline">{instance.priority}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {instance.is_active ? (
                        <Badge color="blue">Actif</Badge>
                      ) : (
                        <Badge color="gray">Inactif</Badge>
                      )}
                      {instance.is_online ? (
                        <Badge color={instance.is_degraded ? 'yellow' : 'green'} leftSection={<IconCheck size={12} />}>
                          {instance.is_degraded ? 'Dégradé' : 'En ligne'}
                        </Badge>
                      ) : (
                        <Tooltip label={instance.last_error || 'Hors ligne'}>
                          <Badge color="red" leftSection={<IconX size={12} />}>
                            Hors ligne
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatDate(instance.last_synced_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Tester la connexion">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleTestConnection(instance.id)}
                          loading={testingId === instance.id}
                        >
                          <IconPlugConnected size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Modifier">
                        <ActionIcon
                          variant="subtle"
                          color="yellow"
                          onClick={() => openEditModal(instance)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteConfirm(instance)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingInstance ? 'Modifier l\'instance NPM' : 'Nouvelle instance NPM'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Nom"
              placeholder="NPM Maison, NPM OVH..."
              required
              {...form.getInputProps('name')}
            />

            <Box>
              <Text size="sm" fw={500} mb="xs">Mode de connexion</Text>
              <SegmentedControl
                fullWidth
                data={[
                  { label: 'Base de données PostgreSQL', value: 'database' },
                  { label: 'API REST (dégradé)', value: 'api' },
                ]}
                {...form.getInputProps('connection_mode')}
              />
              {form.values.connection_mode === 'api' && (
                <Text size="xs" c="yellow" mt="xs">
                  Le mode API ne permet pas de détecter la protection Authelia.
                </Text>
              )}
            </Box>

            {form.values.connection_mode === 'database' ? (
              <>
                <Group grow>
                  <TextInput
                    label="Hôte PostgreSQL"
                    placeholder="192.168.1.x ou hostname"
                    required
                    {...form.getInputProps('db_host')}
                  />
                  <NumberInput
                    label="Port"
                    min={1}
                    max={65535}
                    {...form.getInputProps('db_port')}
                  />
                </Group>

                <Group grow>
                  <TextInput
                    label="Base de données"
                    placeholder="npm"
                    required
                    {...form.getInputProps('db_name')}
                  />
                  <TextInput
                    label="Utilisateur"
                    placeholder="npm"
                    required
                    {...form.getInputProps('db_user')}
                  />
                </Group>

                <PasswordInput
                  label="Mot de passe"
                  placeholder={editingInstance ? 'Laisser vide pour ne pas changer' : 'Mot de passe'}
                  required={!editingInstance}
                  {...form.getInputProps('db_password')}
                />
              </>
            ) : (
              <>
                <TextInput
                  label="URL de l'API NPM"
                  placeholder="https://npm.example.com"
                  required
                  {...form.getInputProps('api_url')}
                />

                <TextInput
                  label="Email administrateur NPM"
                  placeholder="admin@example.com"
                  required
                  {...form.getInputProps('api_email')}
                />

                <PasswordInput
                  label="Mot de passe NPM"
                  placeholder={editingInstance ? 'Laisser vide pour ne pas changer' : 'Mot de passe'}
                  required={!editingInstance}
                  {...form.getInputProps('api_password')}
                />
              </>
            )}

            <NumberInput
              label="Priorité"
              description="Plus le nombre est bas, plus la priorité est haute"
              min={1}
              max={1000}
              {...form.getInputProps('priority')}
            />

            <Switch
              label="Instance active"
              description="Les instances inactives ne sont pas synchronisées"
              {...form.getInputProps('is_active', { type: 'checkbox' })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editingInstance ? 'Mettre à jour' : 'Créer'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <Text mb="lg">
          Êtes-vous sûr de vouloir supprimer l&apos;instance <strong>{deleteConfirm?.name}</strong> ?
          Les applications associées ne seront pas supprimées mais perdront leur référence à cette instance.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteConfirm(null)}>
            Annuler
          </Button>
          <Button color="red" onClick={handleDelete}>
            Supprimer
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
