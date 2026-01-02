'use client';

import { useState } from 'react';
import { Box, NavLink, Title, Divider, Button, Text, ActionIcon, Badge, Group, Tooltip, Collapse } from '@mantine/core';
import {
  IconHome,
  IconRefresh,
  IconLogout,
  IconApps,
  IconEdit,
  IconWorld,
  IconWorldOff,
  IconUser,
  IconServer,
  IconLayoutDashboard,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconPalette,
  IconSettings,
} from '@tabler/icons-react';
import { ThemeConfigurator } from './ThemeConfigurator';
import { Category } from '@/types';
import { useUIStore, useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api';
import { notifications } from '@mantine/notifications';

interface SidebarProps {
  categories: Category[];
  onSync?: () => void;
  isSyncing?: boolean;
  onEditCategory?: (category: Category) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ categories, onSync, isSyncing, onEditCategory, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { selectedCategory, setSelectedCategory } = useUIStore();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const togglePublicMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: number; isPublic: boolean }) =>
      categoriesApi.update(id, { is_public: isPublic }),
    onSuccess: (_, { isPublic }) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      notifications.show({
        title: isPublic ? 'Catégorie publique' : 'Catégorie privée',
        message: isPublic
          ? 'La catégorie et ses applications sont maintenant publiques'
          : 'La catégorie et ses applications sont maintenant privées',
        color: isPublic ? 'green' : 'orange',
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

  const handleLogout = () => {
    logout();
    router.push('/public');
  };

  const handleToggleCategoryPublic = (e: React.MouseEvent, category: Category) => {
    e.stopPropagation();
    togglePublicMutation.mutate({ id: category.id, isPublic: !category.is_public });
  };

  const getCategoryIcon = (icon: string): string => {
    const iconMap: Record<string, string> = {
      'mdi:play-circle': '🎬',
      'mdi:briefcase': '💼',
      'mdi:cog': '⚙️',
      'mdi:chart-line': '📊',
      'mdi:network': '🌐',
      'mdi:database': '💾',
      'mdi:shield': '🔒',
      'mdi:code-braces': '💻',
      'mdi:home-automation': '🏠',
      'mdi:message': '💬',
      'mdi:apps': '📦',
    };
    return iconMap[icon] || '📁';
  };

  return (
    <Box className="h-full flex flex-col bg-gray-50 dark:bg-gray-900" style={{ width: collapsed ? 60 : 'auto' }}>
      {/* Header */}
      <Box p={collapsed ? 'xs' : 'md'}>
        <Group justify="space-between" wrap="nowrap">
          {collapsed ? (
            <Tooltip label="ProxyDash" position="right">
              <ActionIcon variant="transparent" size="lg">
                <IconApps size={28} className="text-blue-500" />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Group gap="xs" wrap="nowrap">
              <Title order={3} className="flex items-center gap-2">
                <IconApps size={28} className="text-blue-500" />
                ProxyDash
              </Title>
              <Tooltip label="Page publique (nouvel onglet)">
                <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => window.open('/public', '_blank')}>
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
          {onToggleCollapse && !collapsed && (
            <Tooltip label="Réduire le menu">
              <ActionIcon variant="subtle" size="sm" onClick={onToggleCollapse}>
                <IconChevronLeft size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Box>

      <Divider />

      {/* Categories */}
      <Box className="flex-1 overflow-y-auto" p={collapsed ? 'xs' : 'sm'}>
        {collapsed ? (
          <Tooltip label="Toutes les applications" position="right">
            <ActionIcon
              variant={selectedCategory === null ? 'filled' : 'subtle'}
              color={selectedCategory === null ? 'blue' : 'gray'}
              size="lg"
              onClick={() => setSelectedCategory(null)}
              mb="xs"
            >
              <IconHome size={20} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <NavLink
            label="Toutes les applications"
            leftSection={<IconHome size={18} />}
            active={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
            variant="filled"
            className="mb-2"
          />
        )}

        {!collapsed && (
          <Text size="xs" c="dimmed" fw={500} mt="md" mb="xs" px="sm">
            CATÉGORIES
          </Text>
        )}

        {categories.map((category) => (
          collapsed ? (
            <Tooltip key={category.id} label={category.name} position="right">
              <ActionIcon
                variant={selectedCategory === category.slug ? 'light' : 'subtle'}
                color={selectedCategory === category.slug ? 'blue' : 'gray'}
                size="lg"
                onClick={() => setSelectedCategory(category.slug)}
                mb="xs"
              >
                <span style={{ fontSize: 18 }}>{getCategoryIcon(category.icon)}</span>
              </ActionIcon>
            </Tooltip>
          ) : (
            <NavLink
              key={category.id}
              label={
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text size="sm">{category.name}</Text>
                  <Group gap={4} wrap="nowrap">
                    {user?.is_admin && (
                      <Tooltip
                        label={category.is_public ? 'Rendre privée' : 'Rendre publique'}
                        position="top"
                      >
                        <ActionIcon
                          size="xs"
                          variant={category.is_public ? 'filled' : 'subtle'}
                          color={category.is_public ? 'green' : 'gray'}
                          onClick={(e) => handleToggleCategoryPublic(e, category)}
                          loading={togglePublicMutation.isPending}
                        >
                          {category.is_public ? <IconWorld size={12} /> : <IconWorldOff size={12} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {!user?.is_admin && category.is_public && (
                      <Badge size="xs" variant="light" color="green" leftSection={<IconWorld size={10} />}>
                        Public
                      </Badge>
                    )}
                    {user?.is_admin && onEditCategory && (
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCategory(category);
                        }}
                      >
                        <IconEdit size={12} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>
              }
              leftSection={<span>{getCategoryIcon(category.icon)}</span>}
              active={selectedCategory === category.slug}
              onClick={() => setSelectedCategory(category.slug)}
              variant="light"
            />
          )
        ))}

        {/* Expand button when collapsed */}
        {collapsed && onToggleCollapse && (
          <>
            <Divider my="xs" />
            <Tooltip label="Développer le menu" position="right">
              <ActionIcon variant="subtle" size="lg" onClick={onToggleCollapse}>
                <IconChevronRight size={20} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      </Box>

      <Divider />

      {/* Settings section */}
      <Box p={collapsed ? 'xs' : 'md'}>
        {collapsed ? (
          /* Collapsed mode - show only icons */
          <Group gap={4} justify="center" wrap="wrap">
            {user?.is_admin && (
              <>
                <Tooltip label="Synchroniser NPM" position="right">
                  <ActionIcon variant="light" size="lg" onClick={onSync} loading={isSyncing}>
                    <IconRefresh size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Paramètres" position="right">
                  <ActionIcon variant="subtle" size="lg" onClick={() => router.push('/dashboard/settings')}>
                    <IconServer size={18} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
            <Tooltip label="Personnaliser" position="right">
              <ActionIcon variant="subtle" size="lg" onClick={() => setThemeModalOpen(true)}>
                <IconPalette size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Mon profil" position="right">
              <ActionIcon variant="subtle" size="lg" onClick={() => router.push('/dashboard/profile')}>
                <IconUser size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Déconnexion" position="right">
              <ActionIcon variant="subtle" color="red" size="lg" onClick={handleLogout}>
                <IconLogout size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : (
          /* Expanded mode */
          <>
            {/* Settings toggle header */}
            <Group
              justify="space-between"
              onClick={() => setSettingsCollapsed(!settingsCollapsed)}
              style={{ cursor: 'pointer' }}
              mb="xs"
            >
              <Text size="xs" c="dimmed" fw={500}>
                PARAMÈTRES
              </Text>
              <ActionIcon variant="subtle" size="xs">
                {settingsCollapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
              </ActionIcon>
            </Group>

            <Collapse in={!settingsCollapsed}>
              <Box className="space-y-2">
                {user?.is_admin && (
                  <>
                    <Button
                      variant="light"
                      fullWidth
                      leftSection={<IconRefresh size={18} />}
                      onClick={onSync}
                      loading={isSyncing}
                    >
                      Synchroniser NPM
                    </Button>

                    <Button
                      variant="subtle"
                      fullWidth
                      leftSection={<IconServer size={18} />}
                      onClick={() => router.push('/dashboard/settings')}
                    >
                      Paramètres
                    </Button>

                    <Button
                      variant="subtle"
                      fullWidth
                      leftSection={<IconLayoutDashboard size={18} />}
                      onClick={() => router.push('/dashboard/widgets')}
                    >
                      Widgets
                    </Button>
                  </>
                )}

                <Divider my="xs" />

                <Button
                  variant="subtle"
                  fullWidth
                  leftSection={<IconPalette size={18} />}
                  onClick={() => setThemeModalOpen(true)}
                >
                  Personnaliser
                </Button>

                <Button
                  variant="subtle"
                  fullWidth
                  leftSection={<IconUser size={18} />}
                  onClick={() => router.push('/dashboard/profile')}
                >
                  Mon profil
                </Button>

                <Button
                  variant="subtle"
                  color="red"
                  fullWidth
                  leftSection={<IconLogout size={18} />}
                  onClick={handleLogout}
                >
                  Déconnexion
                </Button>

                {user && (
                  <Text size="xs" c="dimmed" ta="center">
                    Connecté: {user.username}
                  </Text>
                )}
              </Box>
            </Collapse>

            {/* Show minimal info when settings collapsed */}
            {settingsCollapsed && (
              <Group justify="center" gap="xs">
                <Tooltip label="Personnaliser">
                  <ActionIcon variant="subtle" onClick={() => setThemeModalOpen(true)}>
                    <IconPalette size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Mon profil">
                  <ActionIcon variant="subtle" onClick={() => router.push('/dashboard/profile')}>
                    <IconUser size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Déconnexion">
                  <ActionIcon variant="subtle" color="red" onClick={handleLogout}>
                    <IconLogout size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </>
        )}
      </Box>

      {/* Theme Configurator Modal */}
      <ThemeConfigurator opened={themeModalOpen} onClose={() => setThemeModalOpen(false)} />
    </Box>
  );
}
