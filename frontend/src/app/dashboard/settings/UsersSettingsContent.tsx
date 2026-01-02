'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Text,
  Table,
  Badge,
  ActionIcon,
  Group,
  Button,
  Modal,
  TextInput,
  Switch,
  Stack,
  Loader,
  Center,
  Paper,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconTrash, IconPlus, IconCheck } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { User } from '@/types';

export default function UsersSettingsContent() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: currentUser?.is_admin,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({
        title: 'Succes',
        message: 'Utilisateur cree',
        color: 'green',
      });
      setAddModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de creer l\'utilisateur',
        color: 'red',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({
        title: 'Succes',
        message: 'Utilisateur mis a jour',
        color: 'green',
      });
      setEditingUser(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de mettre a jour l\'utilisateur',
        color: 'red',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({
        title: 'Succes',
        message: 'Utilisateur supprime',
        color: 'green',
      });
      setDeleteConfirmUser(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de supprimer l\'utilisateur',
        color: 'red',
      });
    },
  });

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <div>
          <Text size="lg" fw={600}>Gestion des utilisateurs</Text>
          <Text c="dimmed" size="sm">
            {users.length} utilisateur{users.length > 1 ? 's' : ''}
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={() => setAddModalOpen(true)}
        >
          Ajouter
        </Button>
      </Group>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom d'utilisateur</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Approbation</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>2FA</Table.Th>
              <Table.Th>Cree le</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user: User) => (
              <Table.Tr key={user.id} bg={!user.is_approved ? 'yellow.0' : undefined}>
                <Table.Td fw={500}>{user.username}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>
                  <Badge color={user.is_active ? 'green' : 'red'}>
                    {user.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={user.is_approved ? 'green' : 'orange'}>
                    {user.is_approved ? 'Approuve' : 'En attente'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={user.is_admin ? 'blue' : 'gray'}>
                    {user.is_admin ? 'Admin' : 'Utilisateur'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={user.totp_enabled ? 'teal' : 'gray'} variant="light">
                    {user.totp_enabled ? 'Active' : 'Desactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {!user.is_approved && (
                      <ActionIcon
                        variant="filled"
                        color="green"
                        onClick={() => updateMutation.mutate({ id: user.id, data: { is_approved: true } })}
                        loading={updateMutation.isPending}
                        title="Approuver"
                      >
                        <IconCheck size={18} />
                      </ActionIcon>
                    )}
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => setEditingUser(user)}
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                    {user.id !== currentUser?.id && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteConfirmUser(user)}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Add User Modal */}
      <AddUserModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={editingUser}
        currentUserId={currentUser?.id}
        onClose={() => setEditingUser(null)}
        onSubmit={(data) => {
          if (editingUser) {
            updateMutation.mutate({ id: editingUser.id, data });
          }
        }}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
        title="Confirmer la suppression"
      >
        <Text mb="lg">
          Etes-vous sur de vouloir supprimer l'utilisateur{' '}
          <strong>{deleteConfirmUser?.username}</strong> ?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteConfirmUser(null)}>
            Annuler
          </Button>
          <Button
            color="red"
            onClick={() => deleteConfirmUser && deleteMutation.mutate(deleteConfirmUser.id)}
            loading={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

// Add User Modal Component
function AddUserModal({
  opened,
  onClose,
  onSubmit,
  isLoading,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: { email: string; username: string; password: string; is_admin: boolean }) => void;
  isLoading: boolean;
}) {
  const form = useForm({
    initialValues: {
      email: '',
      username: '',
      password: '',
      is_admin: false,
    },
    validate: {
      email: (value) => (!value ? 'Email requis' : null),
      username: (value) => (!value ? 'Nom d\'utilisateur requis' : null),
      password: (value) => (value.length < 6 ? 'Mot de passe trop court (min 6 caracteres)' : null),
    },
  });

  useEffect(() => {
    if (opened) {
      form.reset();
    }
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Ajouter un utilisateur">
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          <TextInput
            label="Nom d'utilisateur"
            placeholder="johndoe"
            required
            {...form.getInputProps('username')}
          />
          <TextInput
            label="Email"
            placeholder="john@example.com"
            type="email"
            required
            {...form.getInputProps('email')}
          />
          <TextInput
            label="Mot de passe"
            placeholder="******"
            type="password"
            required
            {...form.getInputProps('password')}
          />
          <Switch
            label="Administrateur"
            description="Peut gerer les utilisateurs et les parametres"
            {...form.getInputProps('is_admin', { type: 'checkbox' })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={isLoading}>
              Creer
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// Edit User Modal Component
function EditUserModal({
  user,
  currentUserId,
  onClose,
  onSubmit,
  isLoading,
}: {
  user: User | null;
  currentUserId: number | undefined;
  onClose: () => void;
  onSubmit: (data: { email?: string; username?: string; password?: string; is_active?: boolean; is_admin?: boolean; is_approved?: boolean }) => void;
  isLoading: boolean;
}) {
  const form = useForm({
    initialValues: {
      email: '',
      username: '',
      password: '',
      is_active: true,
      is_admin: false,
      is_approved: false,
    },
  });

  useEffect(() => {
    if (user) {
      form.setValues({
        email: user.email,
        username: user.username,
        password: '',
        is_active: user.is_active,
        is_admin: user.is_admin,
        is_approved: user.is_approved,
      });
    }
  }, [user]);

  const handleSubmit = (values: typeof form.values) => {
    const data: any = {};
    if (values.email !== user?.email) data.email = values.email;
    if (values.username !== user?.username) data.username = values.username;
    if (values.password) data.password = values.password;
    if (values.is_active !== user?.is_active) data.is_active = values.is_active;
    if (values.is_admin !== user?.is_admin) data.is_admin = values.is_admin;
    if (values.is_approved !== user?.is_approved) data.is_approved = values.is_approved;
    onSubmit(data);
  };

  const isSelf = user?.id === currentUserId;

  return (
    <Modal opened={!!user} onClose={onClose} title="Modifier l'utilisateur">
      {user && (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Nom d'utilisateur"
              placeholder="johndoe"
              {...form.getInputProps('username')}
            />
            <TextInput
              label="Email"
              placeholder="john@example.com"
              type="email"
              {...form.getInputProps('email')}
            />
            <TextInput
              label="Nouveau mot de passe"
              placeholder="Laisser vide pour ne pas changer"
              type="password"
              {...form.getInputProps('password')}
            />
            <Switch
              label="Compte approuve"
              description="Les comptes non approuves ne peuvent pas se connecter"
              disabled={isSelf}
              {...form.getInputProps('is_approved', { type: 'checkbox' })}
            />
            <Switch
              label="Compte actif"
              description="Les comptes inactifs ne peuvent pas se connecter"
              disabled={isSelf}
              {...form.getInputProps('is_active', { type: 'checkbox' })}
            />
            <Switch
              label="Administrateur"
              description="Peut gerer les utilisateurs et les parametres"
              disabled={isSelf}
              {...form.getInputProps('is_admin', { type: 'checkbox' })}
            />
            {isSelf && (
              <Text size="xs" c="dimmed">
                Vous ne pouvez pas modifier votre propre statut ou role.
              </Text>
            )}
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" loading={isLoading}>
                Enregistrer
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
