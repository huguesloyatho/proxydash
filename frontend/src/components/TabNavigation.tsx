'use client';

import { useState } from 'react';
import {
  Tabs,
  ActionIcon,
  Group,
  Modal,
  TextInput,
  Button,
  Stack,
  Menu,
  Text,
  Tooltip,
  Box,
  Badge,
  Card,
  Loader,
  Center,
  Divider,
  ScrollArea,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconHome,
  IconLayoutDashboard,
  IconBookmark,
  IconFolder,
  IconStar,
  IconWorld,
  IconLock,
  IconUsers,
  IconUserPlus,
  IconUserMinus,
  IconNetwork,
  IconRobot,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { tabsApi } from '@/lib/api';
import { Tab } from '@/types';

interface TabWithOwner extends Tab {
  owner?: {
    id: number;
    username: string;
  } | null;
}

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (slug: string) => void;
  isAdmin?: boolean;
  currentUserId?: number;
  onCreateAppDashboard?: () => void;
}

const TAB_ICONS: Record<string, React.ReactNode> = {
  'mdi:home': <IconHome size={16} />,
  'mdi:dashboard': <IconLayoutDashboard size={16} />,
  'mdi:bookmark': <IconBookmark size={16} />,
  'mdi:folder': <IconFolder size={16} />,
  'mdi:star': <IconStar size={16} />,
  'mdi:network': <IconNetwork size={16} />,
  'mdi:robot': <IconRobot size={16} />,
};

const AVAILABLE_ICONS = [
  { value: 'mdi:home', label: 'Accueil', icon: <IconHome size={20} /> },
  { value: 'mdi:dashboard', label: 'Dashboard', icon: <IconLayoutDashboard size={20} /> },
  { value: 'mdi:bookmark', label: 'Favoris', icon: <IconBookmark size={20} /> },
  { value: 'mdi:folder', label: 'Dossier', icon: <IconFolder size={20} /> },
  { value: 'mdi:star', label: 'Étoile', icon: <IconStar size={20} /> },
];

export function TabNavigation({ activeTab, onTabChange, isAdmin = false, currentUserId, onCreateAppDashboard }: TabNavigationProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  // Responsive
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sharedTabsModalOpen, setSharedTabsModalOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<Tab | null>(null);
  const [newTabName, setNewTabName] = useState('');
  const [newTabIcon, setNewTabIcon] = useState('mdi:folder');

  // Check if user can edit a tab (owner or admin)
  const canEditTab = (tab: Tab) => {
    if (isAdmin) return true;
    if (tab.owner_id === currentUserId) return true;
    return false;
  };

  // Check if tab is from another user (subscribed shared tab)
  const isSubscribedTab = (tab: Tab) => {
    return tab.owner_id !== null && tab.owner_id !== currentUserId;
  };

  // Fetch tabs
  const { data: tabs = [] } = useQuery<Tab[]>({
    queryKey: ['tabs'],
    queryFn: tabsApi.list,
  });

  // Fetch shared tabs available for subscription
  const { data: sharedTabs = [], isLoading: sharedTabsLoading } = useQuery<TabWithOwner[]>({
    queryKey: ['tabs', 'shared'],
    queryFn: tabsApi.listShared,
    enabled: sharedTabsModalOpen,
  });

  // Create tab mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; icon?: string }) =>
      tabsApi.create({ name: data.name, icon: data.icon }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      notifications.show({
        title: 'Onglet créé',
        message: 'Le nouvel onglet a été créé avec succès',
        color: 'green',
      });
      setModalOpen(false);
      setNewTabName('');
      setNewTabIcon('mdi:folder');
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de créer l\'onglet',
        color: 'red',
      });
    },
  });

  // Update tab mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; icon?: string } }) =>
      tabsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      notifications.show({
        title: 'Onglet modifié',
        message: 'L\'onglet a été modifié avec succès',
        color: 'green',
      });
      setEditingTab(null);
      setNewTabName('');
      setNewTabIcon('mdi:folder');
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier l\'onglet',
        color: 'red',
      });
    },
  });

  // Delete tab mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => tabsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      notifications.show({
        title: 'Onglet supprimé',
        message: 'L\'onglet a été supprimé',
        color: 'green',
      });
      // Si on supprime l'onglet actif, revenir au premier
      const deletedTab = tabs.find(t => t.id === deletedId);
      if (deletedTab?.slug === activeTab) {
        const firstTab = tabs.find(t => t.id !== deletedId);
        if (firstTab) {
          onTabChange(firstTab.slug);
        }
      }
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de supprimer l\'onglet',
        color: 'red',
      });
    },
  });

  // Toggle public mutation
  const togglePublicMutation = useMutation({
    mutationFn: (id: number) => tabsApi.togglePublic(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      notifications.show({
        title: data.is_public ? 'Onglet partagé' : 'Onglet privé',
        message: data.is_public
          ? 'Cet onglet est maintenant visible par tous les utilisateurs'
          : 'Cet onglet est maintenant privé',
        color: data.is_public ? 'green' : 'orange',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier le partage',
        color: 'red',
      });
    },
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: (id: number) => tabsApi.subscribe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['tabs', 'shared'] });
      notifications.show({
        title: 'Abonnement réussi',
        message: 'Vous êtes maintenant abonné à cet onglet',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de s\'abonner à cet onglet',
        color: 'red',
      });
    },
  });

  // Unsubscribe mutation
  const unsubscribeMutation = useMutation({
    mutationFn: (id: number) => tabsApi.unsubscribe(id),
    onSuccess: (_, unsubscribedId) => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['tabs', 'shared'] });
      notifications.show({
        title: 'Désabonnement réussi',
        message: 'Vous n\'êtes plus abonné à cet onglet',
        color: 'green',
      });
      // Si on se désabonne de l'onglet actif, revenir au premier
      const unsubTab = tabs.find(t => t.id === unsubscribedId);
      if (unsubTab?.slug === activeTab) {
        const firstTab = tabs.find(t => t.id !== unsubscribedId);
        if (firstTab) {
          onTabChange(firstTab.slug);
        }
      }
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de se désabonner de cet onglet',
        color: 'red',
      });
    },
  });

  const handleCreateTab = () => {
    if (!newTabName.trim()) return;
    createMutation.mutate({ name: newTabName, icon: newTabIcon });
  };

  const handleUpdateTab = () => {
    if (!editingTab || !newTabName.trim()) return;
    updateMutation.mutate({
      id: editingTab.id,
      data: { name: newTabName, icon: newTabIcon },
    });
  };

  const handleEditClick = (tab: Tab) => {
    setEditingTab(tab);
    setNewTabName(tab.name);
    setNewTabIcon(tab.icon || 'mdi:folder');
  };

  const handleDeleteClick = (tab: Tab) => {
    if (tab.tab_type === 'default') {
      notifications.show({
        title: 'Action impossible',
        message: 'L\'onglet par défaut ne peut pas être supprimé',
        color: 'orange',
      });
      return;
    }
    deleteMutation.mutate(tab.id);
  };

  const getTabIcon = (icon: string | null) => {
    if (!icon) return <IconFolder size={16} />;
    return TAB_ICONS[icon] || <IconFolder size={16} />;
  };

  const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);

  // Find current custom tab for the menu
  const currentCustomTab = sortedTabs.find(t => t.slug === activeTab && t.tab_type === 'custom');
  const canEditCurrentTab = currentCustomTab && canEditTab(currentCustomTab);
  const isCurrentTabSubscribed = currentCustomTab && isSubscribedTab(currentCustomTab);

  return (
    <>
      <Group gap="xs" wrap="nowrap" align="flex-end" style={{ minWidth: 0, flex: 1 }}>
        <Box style={{ overflow: 'hidden', flex: 1 }}>
          <ScrollArea
            type={isMobile ? 'scroll' : 'auto'}
            scrollbarSize={6}
            offsetScrollbars={false}
            styles={{
              viewport: { paddingBottom: 4 },
            }}
          >
            <Tabs value={activeTab} onChange={(value) => value && onTabChange(value)}>
              <Tabs.List style={{ flexWrap: 'nowrap' }}>
                {sortedTabs.map((tab) => (
                  <Tabs.Tab
                    key={tab.id}
                    value={tab.slug}
                    style={{ whiteSpace: 'nowrap' }}
                    leftSection={
                      <Group gap={4} wrap="nowrap">
                        {getTabIcon(tab.icon)}
                        {/* Subscribed indicator (shared tab from another user) */}
                        {isSubscribedTab(tab) && (
                          <Tooltip label="Onglet partagé (abonné)">
                            <IconUsers size={12} style={{ opacity: 0.6 }} />
                          </Tooltip>
                        )}
                        {/* Public indicator for own tabs */}
                        {tab.is_public && tab.owner_id === currentUserId && (
                          <Tooltip label="Partagé publiquement">
                            <IconWorld size={12} color="var(--mantine-color-green-6)" />
                          </Tooltip>
                        )}
                      </Group>
                    }
                  >
                    {isMobile && tab.name.length > 10 ? `${tab.name.slice(0, 10)}...` : tab.name}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          </ScrollArea>
        </Box>

        {/* Menu for current custom tab - outside of Tabs to avoid button nesting */}
        {currentCustomTab && (canEditCurrentTab || isCurrentTabSubscribed) && (
          <Menu shadow="md" width={180} position="bottom-end">
            <Menu.Target>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
              >
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {canEditCurrentTab && (
                <>
                  <Menu.Item
                    leftSection={<IconEdit size={14} />}
                    onClick={() => handleEditClick(currentCustomTab)}
                  >
                    Modifier
                  </Menu.Item>
                  <Menu.Item
                    leftSection={currentCustomTab.is_public ? <IconLock size={14} /> : <IconWorld size={14} />}
                    onClick={() => togglePublicMutation.mutate(currentCustomTab.id)}
                    disabled={togglePublicMutation.isPending}
                  >
                    {currentCustomTab.is_public ? 'Rendre privé' : 'Partager'}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconTrash size={14} />}
                    color="red"
                    onClick={() => handleDeleteClick(currentCustomTab)}
                  >
                    Supprimer
                  </Menu.Item>
                </>
              )}
              {isCurrentTabSubscribed && !canEditCurrentTab && (
                <Menu.Item
                  leftSection={<IconUserMinus size={14} />}
                  color="orange"
                  onClick={() => unsubscribeMutation.mutate(currentCustomTab.id)}
                  disabled={unsubscribeMutation.isPending}
                >
                  Se désabonner
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        )}

        {/* Add tab button with dropdown for create or browse shared */}
        <Menu shadow="md" width={220} position="bottom-end">
          <Menu.Target>
            <Tooltip label="Ajouter un onglet">
              <ActionIcon
                variant="subtle"
                color="blue"
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconPlus size={14} />}
              onClick={() => setModalOpen(true)}
            >
              Créer un nouvel onglet
            </Menu.Item>
            {onCreateAppDashboard && (
              <Menu.Item
                leftSection={<IconLayoutDashboard size={14} />}
                onClick={onCreateAppDashboard}
              >
                Créer un App Dashboard
              </Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconUsers size={14} />}
              onClick={() => setSharedTabsModalOpen(true)}
            >
              Parcourir les onglets partagés
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Modal de création */}
      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setNewTabName('');
          setNewTabIcon('mdi:folder');
        }}
        title="Créer un nouvel onglet"
      >
        <Stack>
          <TextInput
            label="Nom de l'onglet"
            placeholder="Mon onglet"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            required
          />

          <div>
            <Text size="sm" fw={500} mb="xs">
              Icône
            </Text>
            <Group gap="xs">
              {AVAILABLE_ICONS.map((iconOption) => (
                <Tooltip key={iconOption.value} label={iconOption.label}>
                  <ActionIcon
                    size="lg"
                    variant={newTabIcon === iconOption.value ? 'filled' : 'light'}
                    color={newTabIcon === iconOption.value ? 'blue' : 'gray'}
                    onClick={() => setNewTabIcon(iconOption.value)}
                  >
                    {iconOption.icon}
                  </ActionIcon>
                </Tooltip>
              ))}
            </Group>
          </div>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateTab}
              loading={createMutation.isPending}
              disabled={!newTabName.trim()}
            >
              Créer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal d'édition */}
      <Modal
        opened={!!editingTab}
        onClose={() => {
          setEditingTab(null);
          setNewTabName('');
          setNewTabIcon('mdi:folder');
        }}
        title="Modifier l'onglet"
      >
        <Stack>
          <TextInput
            label="Nom de l'onglet"
            placeholder="Mon onglet"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            required
          />

          <div>
            <Text size="sm" fw={500} mb="xs">
              Icône
            </Text>
            <Group gap="xs">
              {AVAILABLE_ICONS.map((iconOption) => (
                <Tooltip key={iconOption.value} label={iconOption.label}>
                  <ActionIcon
                    size="lg"
                    variant={newTabIcon === iconOption.value ? 'filled' : 'light'}
                    color={newTabIcon === iconOption.value ? 'blue' : 'gray'}
                    onClick={() => setNewTabIcon(iconOption.value)}
                  >
                    {iconOption.icon}
                  </ActionIcon>
                </Tooltip>
              ))}
            </Group>
          </div>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditingTab(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleUpdateTab}
              loading={updateMutation.isPending}
              disabled={!newTabName.trim()}
            >
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal des onglets partagés */}
      <Modal
        opened={sharedTabsModalOpen}
        onClose={() => setSharedTabsModalOpen(false)}
        title="Onglets partagés disponibles"
        size="md"
      >
        <Stack>
          {sharedTabsLoading ? (
            <Center py="xl">
              <Loader size="md" />
            </Center>
          ) : sharedTabs.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconUsers size={48} style={{ opacity: 0.3 }} />
                <Text c="dimmed" ta="center">
                  Aucun onglet partagé disponible
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  Les onglets partagés par d&apos;autres utilisateurs apparaîtront ici
                </Text>
              </Stack>
            </Center>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                Abonnez-vous aux onglets partagés par d&apos;autres utilisateurs pour les voir dans votre barre d&apos;onglets.
              </Text>
              <Divider />
              {sharedTabs.map((tab) => (
                <Card key={tab.id} withBorder padding="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      {getTabIcon(tab.icon)}
                      <div>
                        <Text fw={500}>{tab.name}</Text>
                        {tab.owner && (
                          <Text size="xs" c="dimmed">
                            Partagé par {tab.owner.username}
                          </Text>
                        )}
                      </div>
                    </Group>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconUserPlus size={14} />}
                      onClick={() => subscribeMutation.mutate(tab.id)}
                      loading={subscribeMutation.isPending}
                    >
                      S&apos;abonner
                    </Button>
                  </Group>
                </Card>
              ))}
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
