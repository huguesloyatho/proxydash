'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Group,
  Stack,
  Text,
  Loader,
  Center,
  Button,
  ActionIcon,
  Tooltip,
  Badge,
  Paper,
  Alert,
  Modal,
  TextInput,
  Select,
  Menu,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconRefresh,
  IconSettings,
  IconAlertCircle,
  IconServer,
  IconLayoutDashboard,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { Tab, DashboardBlock, AppDashboardContent } from '@/types';
import { appDashboardApi, serversApi, tabsApi } from '@/lib/api';
import { DashboardBlockGrid } from '../app-dashboard/DashboardBlockGrid';

interface AppDashboardTabProps {
  tab: Tab;
  isAdmin?: boolean;
  onDeleted?: () => void;
}

export function AppDashboardTab({ tab, isAdmin = false, onDeleted }: AppDashboardTabProps) {
  const queryClient = useQueryClient();
  const [editable, setEditable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  // Fetch dashboard config
  const {
    data: config,
    isLoading: configLoading,
    error: configError,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['app-dashboard-config', tab.id],
    queryFn: () => appDashboardApi.getDashboardConfig(tab.id),
    enabled: tab.tab_type === 'app_dashboard',
  });

  // Fetch server info
  const { data: server } = useQuery({
    queryKey: ['server', config?.server_id],
    queryFn: () => serversApi.get(config!.server_id),
    enabled: !!config?.server_id,
  });

  // Fetch all servers for edit modal
  const { data: servers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
    enabled: editModalOpened,
  });

  // Edit form
  const editForm = useForm({
    initialValues: {
      name: tab.name,
      server_id: config?.server_id?.toString() || '',
      variables: JSON.stringify(config?.variables || {}, null, 2),
    },
  });

  // Update form when config loads
  useMemo(() => {
    if (config) {
      editForm.setValues({
        name: tab.name,
        server_id: config.server_id?.toString() || '',
        variables: JSON.stringify(config.variables || {}, null, 2),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, tab.name]);

  // Update dashboard mutation
  const updateDashboardMutation = useMutation({
    mutationFn: (data: { name?: string; server_id?: number; variables?: Record<string, string> }) =>
      appDashboardApi.updateDashboardTab(tab.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['app-dashboard-config', tab.id] });
      notifications.show({
        title: 'Dashboard mis à jour',
        message: 'Les modifications ont été enregistrées',
        color: 'green',
      });
      closeEditModal();
    },
    onError: (error) => {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de mettre à jour le dashboard',
        color: 'red',
      });
    },
  });

  // Delete dashboard mutation
  const deleteDashboardMutation = useMutation({
    mutationFn: () => tabsApi.delete(tab.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      notifications.show({
        title: 'Dashboard supprimé',
        message: 'Le dashboard a été supprimé',
        color: 'green',
      });
      closeDeleteModal();
      onDeleted?.();
    },
    onError: (error) => {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de supprimer le dashboard',
        color: 'red',
      });
    },
  });

  const handleEditSubmit = () => {
    let variables: Record<string, string> = {};
    try {
      variables = JSON.parse(editForm.values.variables);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Format JSON invalide pour les variables',
        color: 'red',
      });
      return;
    }

    updateDashboardMutation.mutate({
      name: editForm.values.name,
      server_id: parseInt(editForm.values.server_id),
      variables,
    });
  };

  // Layout update mutation
  const updateLayoutMutation = useMutation({
    mutationFn: (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) =>
      appDashboardApi.updateDashboardTab(tab.id, { layout }),
    onSuccess: () => {
      setHasUnsavedLayout(false);
      notifications.show({
        title: 'Layout sauvegardé',
        message: 'Les modifications de mise en page ont été enregistrées',
        color: 'green',
        autoClose: 2000,
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de sauvegarder le layout',
        color: 'red',
      });
    },
  });

  // Track unsaved layout changes
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const pendingLayoutRef = useRef<Array<{ i: string; x: number; y: number; w: number; h: number }> | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = useCallback(
    (layout: any[]) => {
      if (editable) {
        pendingLayoutRef.current = layout;
        setHasUnsavedLayout(true);
      }
    },
    [editable]
  );

  const handleSaveLayout = useCallback(() => {
    if (pendingLayoutRef.current) {
      updateLayoutMutation.mutate(pendingLayoutRef.current);
    }
  }, [updateLayoutMutation]);

  const handleRefreshAll = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Get blocks from config - memoize to prevent unnecessary re-renders
  const blocks: DashboardBlock[] = useMemo(() => config?.blocks || [], [config?.blocks]);
  const variables = useMemo(() => config?.variables || {}, [config?.variables]);

  if (configLoading) {
    return (
      <Center h="100%">
        <Stack align="center" gap="sm">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Chargement du dashboard...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (configError) {
    return (
      <Center h="100%">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Erreur de chargement"
          color="red"
          variant="light"
        >
          {configError instanceof Error ? configError.message : 'Impossible de charger le dashboard'}
          <Button size="xs" mt="sm" onClick={() => refetchConfig()}>
            Réessayer
          </Button>
        </Alert>
      </Center>
    );
  }

  if (!config) {
    return (
      <Center h="100%">
        <Stack align="center" gap="md">
          <IconLayoutDashboard size={48} color="var(--mantine-color-dimmed)" />
          <Text size="lg" c="dimmed">
            Dashboard non configuré
          </Text>
          <Text size="sm" c="dimmed">
            Ce dashboard n'a pas encore été configuré.
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!config.server_id) {
    return (
      <Center h="100%">
        <Alert
          icon={<IconServer size={16} />}
          title="Serveur non configuré"
          color="orange"
          variant="light"
        >
          Ce dashboard nécessite un serveur pour exécuter les commandes.
        </Alert>
      </Center>
    );
  }

  if (blocks.length === 0) {
    return (
      <Center h="100%">
        <Stack align="center" gap="md">
          <IconLayoutDashboard size={48} color="var(--mantine-color-dimmed)" />
          <Text size="lg" c="dimmed">
            Aucun bloc configuré
          </Text>
          <Text size="sm" c="dimmed">
            Ajoutez des blocs pour afficher des données.
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box h="100%" style={{ overflow: 'auto' }}>
      {/* Header */}
      <Paper p="sm" mb="md" withBorder radius="md">
        <Group justify="space-between">
          <Group gap="md">
            <Text size="lg" fw={600}>
              {tab.name}
            </Text>
            {server && (
              <Tooltip label="Serveur cible">
                <Badge leftSection={<IconServer size={12} />} variant="light" color="gray">
                  {server.name}
                </Badge>
              </Tooltip>
            )}
            {Object.keys(variables).length > 0 && (
              <Tooltip
                label={Object.entries(variables)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              >
                <Badge variant="light" color="blue">
                  {Object.keys(variables).length} variable(s)
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Group gap="xs">
            {isAdmin && (
              <>
                {editable && hasUnsavedLayout && (
                  <Tooltip label="Sauvegarder le layout">
                    <ActionIcon
                      variant="filled"
                      color="green"
                      onClick={handleSaveLayout}
                      loading={updateLayoutMutation.isPending}
                    >
                      <IconDeviceFloppy size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label={editable ? 'Désactiver édition' : 'Activer édition layout'}>
                  <ActionIcon
                    variant={editable ? 'filled' : 'light'}
                    color={editable ? 'blue' : 'gray'}
                    onClick={() => setEditable(!editable)}
                  >
                    <IconSettings size={18} />
                  </ActionIcon>
                </Tooltip>
                <Menu shadow="md" width={180} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="light" color="gray">
                      <IconDotsVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconEdit size={16} />}
                      onClick={openEditModal}
                    >
                      Modifier
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconTrash size={16} />}
                      color="red"
                      onClick={openDeleteModal}
                    >
                      Supprimer
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            )}
            <Tooltip label="Actualiser tout">
              <ActionIcon variant="light" onClick={handleRefreshAll}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      {/* Dashboard Grid */}
      <DashboardBlockGrid
        key={refreshKey}
        blocks={blocks}
        serverId={config.server_id}
        variables={variables}
        editable={editable}
        onLayoutChange={handleLayoutChange}
        onRefreshAll={handleRefreshAll}
      />

      {/* Edit Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title="Modifier le dashboard"
        size="md"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleEditSubmit(); }}>
          <Stack gap="md">
            <TextInput
              label="Nom du dashboard"
              placeholder="Mon Dashboard CrowdSec"
              required
              {...editForm.getInputProps('name')}
            />

            <Select
              label="Serveur"
              placeholder="Sélectionner un serveur"
              required
              data={servers.map((s: { id: number; name: string }) => ({
                value: s.id.toString(),
                label: s.name,
              }))}
              {...editForm.getInputProps('server_id')}
            />

            <TextInput
              label="Variables (JSON)"
              placeholder='{"container_name": "crowdsec"}'
              description="Variables utilisées dans les commandes du template"
              {...editForm.getInputProps('variables')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeEditModal}>
                Annuler
              </Button>
              <Button
                type="submit"
                loading={updateDashboardMutation.isPending}
              >
                Enregistrer
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Supprimer le dashboard"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Êtes-vous sûr de vouloir supprimer le dashboard <strong>{tab.name}</strong> ?
          </Text>
          <Text size="sm" c="dimmed">
            Cette action est irréversible.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeDeleteModal}>
              Annuler
            </Button>
            <Button
              color="red"
              loading={deleteDashboardMutation.isPending}
              onClick={() => deleteDashboardMutation.mutate()}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
