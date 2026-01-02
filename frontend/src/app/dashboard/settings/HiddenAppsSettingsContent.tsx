'use client';

import { useState } from 'react';
import {
  Box,
  Text,
  Loader,
  Center,
  Table,
  ActionIcon,
  Group,
  Badge,
  Tooltip,
  Image,
  TextInput,
  Switch,
  Paper,
} from '@mantine/core';
import {
  IconEye,
  IconEyeOff,
  IconSearch,
  IconExternalLink,
  IconWorld,
  IconTrash,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { applicationsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Application } from '@/types';

export default function HiddenAppsSettingsContent() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showHiddenOnly, setShowHiddenOnly] = useState(true);

  // Fetch ALL applications (including hidden)
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications', 'all'],
    queryFn: () => applicationsApi.list(undefined, false), // visible_only = false
    enabled: user?.is_admin,
  });

  // Toggle visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, isVisible }: { id: number; isVisible: boolean }) =>
      applicationsApi.update(id, { is_visible: isVisible }),
    onSuccess: (_, { isVisible }) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      notifications.show({
        title: isVisible ? 'Application affichée' : 'Application masquée',
        message: isVisible
          ? 'L\'application est maintenant visible'
          : 'L\'application a été masquée',
        color: isVisible ? 'green' : 'blue',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier la visibilité',
        color: 'red',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => applicationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      notifications.show({
        title: 'Application supprimée',
        message: 'L\'application a été supprimée définitivement',
        color: 'red',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de supprimer l\'application',
        color: 'red',
      });
    },
  });

  // Filter applications
  const filteredApps = applications.filter((app: Application) => {
    // Filter by visibility
    if (showHiddenOnly && app.is_visible) return false;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        app.name.toLowerCase().includes(query) ||
        app.url.toLowerCase().includes(query) ||
        app.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Count hidden apps
  const hiddenCount = applications.filter((app: Application) => !app.is_visible).length;

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
          <Text size="lg" fw={600}>Applications masquées</Text>
          <Text c="dimmed" size="sm">
            {hiddenCount} application{hiddenCount > 1 ? 's' : ''} masquée{hiddenCount > 1 ? 's' : ''}
          </Text>
        </div>
      </Group>

      {/* Filters */}
      <Group mb="lg" justify="space-between">
        <Group>
          <TextInput
            placeholder="Rechercher..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            w={300}
          />
          <Switch
            label="Masquées uniquement"
            checked={showHiddenOnly}
            onChange={(e) => setShowHiddenOnly(e.currentTarget.checked)}
          />
        </Group>
        <Text size="sm" c="dimmed">
          {filteredApps.length} application{filteredApps.length > 1 ? 's' : ''}
        </Text>
      </Group>

      {/* Content */}
      {filteredApps.length === 0 ? (
        <Paper p="xl" withBorder>
          <Center py="xl">
            <Box ta="center">
              <IconEye size={48} className="text-gray-400 mb-4" />
              <Text size="lg" fw={500} mb="sm">
                {showHiddenOnly ? 'Aucune application masquée' : 'Aucune application trouvée'}
              </Text>
              <Text c="dimmed" size="sm">
                {showHiddenOnly
                  ? 'Toutes les applications sont visibles'
                  : 'Essayez une autre recherche'}
              </Text>
            </Box>
          </Center>
        </Paper>
      ) : (
        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Application</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Catégorie</Table.Th>
                <Table.Th>Statut</Table.Th>
                <Table.Th w={150}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredApps.map((app: Application) => (
                <Table.Tr key={app.id} style={{ opacity: app.is_visible ? 1 : 0.7 }}>
                  <Table.Td>
                    <Group gap="sm">
                      {app.icon ? (
                        <Image
                          src={app.icon}
                          alt={app.name}
                          w={32}
                          h={32}
                          fit="contain"
                          fallbackSrc="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/default.svg"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                          <IconExternalLink size={16} className="text-gray-500" />
                        </div>
                      )}
                      <div>
                        <Text fw={500} size="sm">{app.name}</Text>
                        {app.description && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {app.description}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {app.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {app.category ? (
                      <Badge variant="light">{app.category.name}</Badge>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {!app.is_visible && (
                        <Badge color="gray" variant="light" leftSection={<IconEyeOff size={10} />}>
                          Masquée
                        </Badge>
                      )}
                      {app.is_public && (
                        <Badge color="green" variant="light" leftSection={<IconWorld size={10} />}>
                          Public
                        </Badge>
                      )}
                      {app.is_manual && (
                        <Badge color="grape" variant="light">
                          Manuel
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label={app.is_visible ? 'Masquer' : 'Afficher'}>
                        <ActionIcon
                          variant={app.is_visible ? 'subtle' : 'filled'}
                          color={app.is_visible ? 'gray' : 'green'}
                          onClick={() =>
                            toggleVisibilityMutation.mutate({
                              id: app.id,
                              isVisible: !app.is_visible,
                            })
                          }
                          loading={toggleVisibilityMutation.isPending}
                        >
                          {app.is_visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Ouvrir">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => window.open(app.url, '_blank')}
                        >
                          <IconExternalLink size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {app.is_manual && (
                        <Tooltip label="Supprimer">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              if (confirm(`Supprimer définitivement "${app.name}" ?`)) {
                                deleteMutation.mutate(app.id);
                              }
                            }}
                            loading={deleteMutation.isPending}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
