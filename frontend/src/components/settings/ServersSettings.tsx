'use client';

import { useState } from 'react';
import {
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
  Textarea,
  PasswordInput,
  Loader,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconPlugConnected,
  IconServer,
  IconCheck,
  IconX,
  IconBrandDocker,
} from '@tabler/icons-react';
import { serversApi, Server } from '@/lib/api';

export function ServersSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Server | null>(null);

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
  });

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      host: '',
      ssh_port: 22,
      ssh_user: 'root',
      ssh_key: '',
      ssh_password: '',
      has_docker: false,
      has_proxmox: false,
    },
    validate: {
      name: (value) => (!value ? 'Nom requis' : null),
      host: (value) => (!value ? 'Hôte requis' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: serversApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      notifications.show({
        title: 'Succès',
        message: 'Serveur créé',
        color: 'green',
      });
      setModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de créer le serveur',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof serversApi.update>[1] }) =>
      serversApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      notifications.show({
        title: 'Succès',
        message: 'Serveur mis à jour',
        color: 'green',
      });
      setModalOpen(false);
      setEditingServer(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de mettre à jour le serveur',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: serversApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      notifications.show({
        title: 'Succès',
        message: 'Serveur supprimé',
        color: 'green',
      });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de supprimer le serveur',
        color: 'red',
      });
    },
  });

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    try {
      const result = await serversApi.test(id);
      if (result.success) {
        const dockerMsg = result.has_docker ? ` - Docker: ${result.docker_version}` : '';
        notifications.show({
          title: 'Connexion réussie',
          message: `${result.message}${dockerMsg}`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Échec de connexion',
          message: result.message,
          color: 'red',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de tester la connexion',
        color: 'red',
      });
    } finally {
      setTestingId(null);
    }
  };

  const openCreateModal = () => {
    setEditingServer(null);
    form.reset();
    setModalOpen(true);
  };

  const openEditModal = (server: Server) => {
    setEditingServer(server);
    form.setValues({
      name: server.name,
      description: server.description || '',
      host: server.host,
      ssh_port: server.ssh_port,
      ssh_user: server.ssh_user,
      ssh_key: '',
      ssh_password: '',
      has_docker: server.has_docker,
      has_proxmox: server.has_proxmox,
    });
    setModalOpen(true);
  };

  const handleSubmit = (values: typeof form.values) => {
    const data = {
      name: values.name,
      description: values.description || undefined,
      host: values.host,
      ssh_port: values.ssh_port,
      ssh_user: values.ssh_user,
      ssh_key: values.ssh_key || undefined,
      ssh_password: values.ssh_password || undefined,
      has_docker: values.has_docker,
      has_proxmox: values.has_proxmox,
    };

    if (editingServer) {
      updateMutation.mutate({ id: editingServer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <div>
          <Text size="lg" fw={600}>Serveurs</Text>
          <Text size="sm" c="dimmed">
            {servers.length} serveur{servers.length > 1 ? 's' : ''} configuré{servers.length > 1 ? 's' : ''}
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Ajouter un serveur
        </Button>
      </Group>

      {servers.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text c="dimmed" ta="center">
            Aucun serveur configuré. Les serveurs permettent de centraliser les connexions SSH utilisées par les widgets.
          </Text>
        </Paper>
      ) : (
        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nom</Table.Th>
                <Table.Th>Hôte</Table.Th>
                <Table.Th>Connexion SSH</Table.Th>
                <Table.Th>Features</Table.Th>
                <Table.Th>Statut</Table.Th>
                <Table.Th>Dernier test</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {servers.map((server) => (
                <Table.Tr key={server.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <IconServer size={18} className="text-blue-500" />
                      <div>
                        <Text fw={500}>{server.name}</Text>
                        {server.description && (
                          <Text size="xs" c="dimmed">{server.description}</Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{server.host}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {server.ssh_user}@:{server.ssh_port}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {server.has_docker && (
                        <Tooltip label="Docker disponible">
                          <Badge size="sm" color="blue" leftSection={<IconBrandDocker size={12} />}>
                            Docker
                          </Badge>
                        </Tooltip>
                      )}
                      {server.has_proxmox && (
                        <Badge size="sm" color="orange">Proxmox</Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {server.is_online ? (
                      <Badge color="green" leftSection={<IconCheck size={12} />}>
                        En ligne
                      </Badge>
                    ) : (
                      <Tooltip label={server.last_error || 'Hors ligne'}>
                        <Badge color="red" leftSection={<IconX size={12} />}>
                          Hors ligne
                        </Badge>
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatDate(server.last_check)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Tester la connexion">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleTestConnection(server.id)}
                          loading={testingId === server.id}
                        >
                          <IconPlugConnected size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Modifier">
                        <ActionIcon
                          variant="subtle"
                          color="yellow"
                          onClick={() => openEditModal(server)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteConfirm(server)}
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
        title={editingServer ? 'Modifier le serveur' : 'Nouveau serveur'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Nom"
              placeholder="docker-one, vps-ovh..."
              required
              {...form.getInputProps('name')}
            />

            <Textarea
              label="Description"
              placeholder="Description optionnelle"
              rows={2}
              {...form.getInputProps('description')}
            />

            <Group grow>
              <TextInput
                label="Hôte"
                placeholder="192.168.1.x ou hostname"
                required
                {...form.getInputProps('host')}
              />
              <NumberInput
                label="Port SSH"
                min={1}
                max={65535}
                {...form.getInputProps('ssh_port')}
              />
            </Group>

            <TextInput
              label="Utilisateur SSH"
              placeholder="root"
              {...form.getInputProps('ssh_user')}
            />

            <Textarea
              label="Clé SSH privée"
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
              description="Collez votre clé privée ou laissez vide pour utiliser un mot de passe"
              rows={4}
              {...form.getInputProps('ssh_key')}
            />

            <PasswordInput
              label="Mot de passe SSH"
              placeholder={editingServer ? 'Laisser vide pour ne pas changer' : 'Si pas de clé SSH'}
              {...form.getInputProps('ssh_password')}
            />

            <Group>
              <Switch
                label="Docker installé"
                description="Activer les fonctionnalités Docker"
                {...form.getInputProps('has_docker', { type: 'checkbox' })}
              />
              <Switch
                label="Proxmox"
                description="Serveur Proxmox"
                {...form.getInputProps('has_proxmox', { type: 'checkbox' })}
              />
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingServer ? 'Mettre à jour' : 'Créer'}
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
          Êtes-vous sûr de vouloir supprimer le serveur <strong>{deleteConfirm?.name}</strong> ?
          Les widgets utilisant ce serveur devront être reconfigurés.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteConfirm(null)}>
            Annuler
          </Button>
          <Button
            color="red"
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            loading={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
