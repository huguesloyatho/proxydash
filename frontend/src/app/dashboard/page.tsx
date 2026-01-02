'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AppShell,
  Box,
  Title,
  Text,
  Loader,
  Center,
  Button,
  Group,
  TextInput,
  ActionIcon,
  Tooltip,
  Image,
  Burger,
  Drawer,
  Stack,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconPlus, IconSearch, IconX, IconSettings, IconRefresh, IconDeviceTv, IconKeyboard } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { Sidebar, SortableCategorySection, EditAppModal, AddAppModal, EditCategoryModal, TabNavigation, CustomTabContent, KioskOverlay, KioskConfigModal, MobileBottomNav, MobileTasksView, MobileNotesView, MobileCalendarView, GlobalSearch, KeyboardShortcutsModal } from '@/components';
import { WidgetGrid, Widget } from '@/components/widgets';
import { InfrastructureSchema } from '@/components/InfrastructureSchema';
import { ChatTab } from '@/components/tabs/ChatTab';
import { AppDashboardTab } from '@/components/tabs/AppDashboardTab';
import { CreateAppDashboardModal } from '@/components/app-dashboard';
import { applicationsApi, categoriesApi, authApi, widgetsApi, tabsApi, URLStatus } from '@/lib/api';
import { useAuthStore, useUIStore, useKioskStore } from '@/lib/store';
import { useUrlStatus, useKioskMode, useKeyboardShortcuts, KeyboardShortcut } from '@/hooks';
import { Application, Category, Tab } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();
  const { selectedCategory, setSelectedCategory, editingApp, setEditingApp } = useUIStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [autheliaFilter, setAutheliaFilter] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  // Track visited tabs to keep them mounted (performance optimization)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['dashboard']));
  const [kioskConfigOpen, setKioskConfigOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [appDashboardModalOpen, setAppDashboardModalOpen] = useState(false);

  // Mobile drawer for sidebar
  const [mobileNavOpened, { open: openMobileNav, close: closeMobileNav }] = useDisclosure(false);

  // Mobile view state for bottom navigation
  const [mobileView, setMobileView] = useState<'home' | 'tasks' | 'notes' | 'calendar' | 'chat'>('home');

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

  // Kiosk mode
  const { kioskRotationInterval } = useKioskStore();

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Verify token
    authApi.getMe().then((userData) => {
      setAuth(token, userData);
    }).catch(() => {
      logout();
      router.push('/login');
    });
  }, []);

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
    enabled: isAuthenticated,
  });

  // Fetch applications
  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.list(undefined, true),
    enabled: isAuthenticated,
  });

  // Fetch widgets
  const { data: widgets = [] } = useQuery<Widget[]>({
    queryKey: ['widgets'],
    queryFn: widgetsApi.list,
    enabled: isAuthenticated,
  });

  // Fetch tabs
  const { data: tabs = [] } = useQuery<Tab[]>({
    queryKey: ['tabs'],
    queryFn: user?.is_admin ? tabsApi.listAll : tabsApi.list,
    enabled: isAuthenticated,
  });

  // Set default active tab when tabs are loaded
  useEffect(() => {
    if (tabs.length > 0 && activeTab === 'dashboard') {
      const defaultTab = tabs.find(t => t.tab_type === 'default') || tabs[0];
      setActiveTab(defaultTab.slug);
    }
  }, [tabs]);

  // Get current tab
  const currentTab = useMemo(() => {
    return tabs.find(t => t.slug === activeTab);
  }, [tabs, activeTab]);

  // Handle tab change and track visited tabs
  const handleTabChange = (slug: string) => {
    setActiveTab(slug);
    setVisitedTabs(prev => new Set([...prev, slug]));
  };

  // Get custom tabs that have been visited (to keep them mounted)
  const customTabsToRender = useMemo(() => {
    return tabs.filter(t => t.tab_type === 'custom' && visitedTabs.has(t.slug));
  }, [tabs, visitedTabs]);

  // Kiosk mode hook
  const tabSlugs = useMemo(() => tabs.map(t => t.slug), [tabs]);
  const {
    isKioskMode,
    enterKioskMode,
    exitKioskMode,
    currentKioskTab,
    timeUntilNextRotation,
    isPaused,
    pauseRotation,
    resumeRotation,
  } = useKioskMode({
    tabs: tabSlugs,
    onTabChange: handleTabChange,
    currentTab: activeTab,
  });

  // Get current kiosk tab index
  const kioskTabIndex = useMemo(() => {
    return tabSlugs.indexOf(currentKioskTab);
  }, [tabSlugs, currentKioskTab]);

  // Navigate to prev/next tab (for kiosk controls)
  const navigateKioskPrev = () => {
    const prevIndex = (kioskTabIndex - 1 + tabSlugs.length) % tabSlugs.length;
    handleTabChange(tabSlugs[prevIndex]);
  };

  const navigateKioskNext = () => {
    const nextIndex = (kioskTabIndex + 1) % tabSlugs.length;
    handleTabChange(tabSlugs[nextIndex]);
  };

  // Filter visible widgets
  const visibleWidgets = useMemo(() => {
    return widgets.filter((w: Widget) => w.is_visible);
  }, [widgets]);

  // Find Vikunja and Notes widget IDs for mobile views
  const vikunjaWidgetId = useMemo(() => {
    const widget = widgets.find((w: Widget) => w.widget_type === 'vikunja');
    return widget?.id;
  }, [widgets]);

  const notesWidgetId = useMemo(() => {
    const widget = widgets.find((w: Widget) => w.widget_type === 'notes');
    return widget?.id;
  }, [widgets]);

  // Find chat tab for mobile
  const chatTab = useMemo(() => {
    return tabs.find((t) => t.tab_type === 'chat');
  }, [tabs]);

  // Count incomplete tasks for badge
  const incompleteTaskCount = useMemo(() => {
    // This will be updated when tasks are fetched
    return 0;
  }, []);

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: applicationsApi.sync,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      notifications.show({
        title: 'Synchronisation terminée',
        message: `${data.stats.created} créées, ${data.stats.updated} mises à jour, ${data.stats.removed || 0} supprimées`,
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'La synchronisation a échoué',
        color: 'red',
      });
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (appIds: number[]) => applicationsApi.reorder(appIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      notifications.show({
        title: 'Ordre mis à jour',
        message: 'Les applications ont été réorganisées',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de réorganiser les applications',
        color: 'red',
      });
    },
  });

  // Filter applications by category, search, and authelia
  const filteredApplications = useMemo(() => {
    let filtered = applications;

    if (selectedCategory) {
      filtered = filtered.filter(
        (app: Application) => app.category?.slug === selectedCategory
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (app: Application) =>
          app.name.toLowerCase().includes(query) ||
          app.url.toLowerCase().includes(query) ||
          app.description?.toLowerCase().includes(query)
      );
    }

    if (autheliaFilter) {
      filtered = filtered.filter(
        (app: Application) => app.is_authelia_protected
      );
    }

    return filtered;
  }, [applications, selectedCategory, searchQuery, autheliaFilter]);

  // Group applications by category
  const applicationsByCategory = useMemo(() => {
    const grouped: Record<string, Application[]> = {};

    for (const cat of categories) {
      grouped[cat.slug] = filteredApplications.filter(
        (app: Application) => app.category?.slug === cat.slug
      );
    }

    // Add uncategorized
    grouped['uncategorized'] = filteredApplications.filter(
      (app: Application) => !app.category
    );

    return grouped;
  }, [filteredApplications, categories]);

  // Get editing application
  const editingApplication = useMemo(() => {
    if (!editingApp) return null;
    return applications.find((app: Application) => app.id === editingApp) || null;
  }, [editingApp, applications]);

  // Get all application URLs for status checking
  const appUrls = useMemo(() => {
    return applications.map((app: Application) => app.url);
  }, [applications]);

  // URL status checking
  const { statuses: urlStatuses } = useUrlStatus({
    urls: appUrls,
    refreshInterval: 60000, // Check every minute
    timeout: 5,
    enabled: isAuthenticated && appUrls.length > 0,
  });

  // Get current tab name for kiosk overlay (must be before early return)
  const currentTabName = useMemo(() => {
    const tab = tabs.find(t => t.slug === activeTab);
    return tab?.name || 'Dashboard';
  }, [tabs, activeTab]);

  // Refresh all data without page reload (moved before shortcuts for reference)
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['widgets'] }),
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['tabs'] }),
      ]);
      notifications.show({
        title: 'Données actualisées',
        message: 'Toutes les données ont été rafraîchies',
        color: 'green',
        autoClose: 2000,
      });
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de rafraîchir les données',
        color: 'red',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // Keyboard shortcuts definition
  const shortcuts = useMemo<KeyboardShortcut[]>(() => [
    {
      key: 'k',
      ctrl: true,
      action: () => setGlobalSearchOpen(true),
      description: 'Recherche globale',
      category: 'Navigation',
    },
    {
      key: '/',
      action: () => setGlobalSearchOpen(true),
      description: 'Recherche rapide',
      category: 'Navigation',
    },
    {
      key: '?',
      action: () => setShortcutsModalOpen(true),
      description: 'Afficher les raccourcis',
      category: 'Aide',
    },
    {
      key: 'n',
      ctrl: true,
      action: () => user?.is_admin && setAddModalOpen(true),
      description: 'Nouvelle application',
      category: 'Actions',
    },
    {
      key: 'r',
      ctrl: true,
      action: () => handleRefreshAll(),
      description: 'Rafraîchir les données',
      category: 'Actions',
    },
    {
      key: 's',
      alt: true,
      action: () => setSidebarCollapsed(prev => !prev),
      description: 'Basculer la barre latérale',
      category: 'Navigation',
    },
    {
      key: 'ArrowLeft',
      alt: true,
      action: () => {
        const currentIndex = tabs.findIndex(t => t.slug === activeTab);
        if (currentIndex > 0) {
          handleTabChange(tabs[currentIndex - 1].slug);
        }
      },
      description: 'Onglet précédent',
      category: 'Navigation',
    },
    {
      key: 'ArrowRight',
      alt: true,
      action: () => {
        const currentIndex = tabs.findIndex(t => t.slug === activeTab);
        if (currentIndex < tabs.length - 1) {
          handleTabChange(tabs[currentIndex + 1].slug);
        }
      },
      description: 'Onglet suivant',
      category: 'Navigation',
    },
    {
      key: 'Escape',
      action: () => {
        setGlobalSearchOpen(false);
        setShortcutsModalOpen(false);
        setAddModalOpen(false);
        setEditingApp(null);
      },
      description: 'Fermer les modals',
      category: 'Général',
    },
  ], [tabs, activeTab, user?.is_admin, handleRefreshAll, setEditingApp]);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts,
    enabled: isAuthenticated && !isKioskMode,
  });

  // Handle global search navigation
  const handleSearchNavigate = useCallback((type: 'app' | 'tab' | 'task' | 'note', id: number | string) => {
    if (type === 'tab') {
      const tabId = String(id).replace('tab-', '');
      const tab = tabs.find(t => t.id === parseInt(tabId));
      if (tab) {
        handleTabChange(tab.slug);
      }
    } else if (type === 'task') {
      // Navigate to tasks view (mobile) or tasks tab if exists
      if (isMobile) {
        setMobileView('tasks');
      }
    }
  }, [tabs, isMobile]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['applications'] });
  };

  const handleCategoryRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  if (!isAuthenticated) {
    return (
      <Center className="min-h-screen">
        <Loader size="xl" />
      </Center>
    );
  }

  const isLoading = categoriesLoading || appsLoading;

  return (
    <>
      {/* Kiosk Mode Overlay */}
      {isKioskMode && (
        <KioskOverlay
          currentTabName={currentTabName}
          timeUntilNext={timeUntilNextRotation}
          totalTime={kioskRotationInterval}
          isPaused={isPaused}
          onPause={pauseRotation}
          onResume={resumeRotation}
          onExit={exitKioskMode}
          onPrev={navigateKioskPrev}
          onNext={navigateKioskNext}
          tabIndex={kioskTabIndex}
          totalTabs={tabSlugs.length}
        />
      )}

      {/* Kiosk Config Modal */}
      <KioskConfigModal
        opened={kioskConfigOpen}
        onClose={() => setKioskConfigOpen(false)}
        onStart={enterKioskMode}
        tabs={tabs}
      />

      {/* Global Search Modal */}
      <GlobalSearch
        opened={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={handleSearchNavigate}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        opened={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        shortcuts={shortcuts}
      />

      {/* Mobile Drawer for Sidebar */}
      <Drawer
        opened={mobileNavOpened}
        onClose={closeMobileNav}
        size="280px"
        padding={0}
        title={null}
        withCloseButton={false}
        styles={{
          body: { padding: 0, height: '100%' },
          content: { height: '100%' },
        }}
      >
        <Sidebar
          categories={categories}
          onSync={() => syncMutation.mutate()}
          isSyncing={syncMutation.isPending}
          onEditCategory={setEditingCategory}
          collapsed={false}
          onToggleCollapse={closeMobileNav}
        />
      </Drawer>

      <AppShell
        navbar={{
          width: isKioskMode ? 0 : (isMobile ? 0 : (sidebarCollapsed ? 60 : 280)),
          breakpoint: 'sm',
          collapsed: { mobile: true },
        }}
        padding={isKioskMode ? 'xs' : (isMobile ? 'xs' : 'md')}
        style={{
          // Add padding top for kiosk overlay
          paddingTop: isKioskMode ? '60px' : undefined,
        }}
      >
        {/* Hide sidebar in kiosk mode and on mobile (use drawer instead) */}
        {!isKioskMode && !isMobile && (
          <AppShell.Navbar>
            <Sidebar
              categories={categories}
              onSync={() => syncMutation.mutate()}
              isSyncing={syncMutation.isPending}
              onEditCategory={setEditingCategory}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </AppShell.Navbar>
        )}

        <AppShell.Main>
          <Box className="max-w-7xl mx-auto">
            {/* Sticky Header - hide in kiosk mode */}
            {!isKioskMode && (
              <Box
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 100,
                  backgroundColor: 'var(--mantine-color-body)',
                  paddingTop: isMobile ? 'var(--mantine-spacing-xs)' : 'var(--mantine-spacing-md)',
                  paddingBottom: isMobile ? 'var(--mantine-spacing-xs)' : 'var(--mantine-spacing-md)',
                  marginBottom: 'var(--mantine-spacing-md)',
                  borderBottom: '1px solid var(--mantine-color-default-border)',
                }}
              >
                {/* Mobile Header Layout */}
                {isMobile ? (
                  <Stack gap="xs">
                    {/* Top row: Burger + Title + Key Actions */}
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <Burger
                          opened={mobileNavOpened}
                          onClick={openMobileNav}
                          size="sm"
                          aria-label="Navigation menu"
                        />
                        <Title order={4}>ProxyDash</Title>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="md"
                          onClick={handleRefreshAll}
                          loading={isRefreshing}
                        >
                          <IconRefresh size={18} />
                        </ActionIcon>
                        {user?.is_admin && (
                          <ActionIcon
                            variant="filled"
                            color="blue"
                            size="md"
                            onClick={() => setAddModalOpen(true)}
                          >
                            <IconPlus size={18} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>

                    {/* Tab Navigation - scrollable on mobile */}
                    <Box style={{ overflow: 'auto', marginLeft: -8, marginRight: -8, paddingLeft: 8, paddingRight: 8 }}>
                      <TabNavigation
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        isAdmin={user?.is_admin}
                        currentUserId={user?.id}
                      />
                    </Box>

                    {/* Search button - opens global search on mobile */}
                    <Button
                      variant="default"
                      leftSection={<IconSearch size={16} />}
                      onClick={() => setGlobalSearchOpen(true)}
                      fullWidth
                      size="sm"
                      styles={{
                        root: {
                          justifyContent: 'flex-start',
                          color: 'var(--mantine-color-dimmed)',
                        },
                      }}
                    >
                      Rechercher...
                    </Button>
                  </Stack>
                ) : (
                  /* Desktop/Tablet Header Layout */
                  <Group justify="space-between" wrap="nowrap">
                    {/* Tab Navigation on the left */}
                    <TabNavigation
                      activeTab={activeTab}
                      onTabChange={handleTabChange}
                      isAdmin={user?.is_admin}
                      currentUserId={user?.id}
                      onCreateAppDashboard={() => setAppDashboardModalOpen(true)}
                    />

                    {/* Actions on the right */}
                    <Group gap="sm" wrap="nowrap">
                      <Tooltip label={autheliaFilter ? "Afficher toutes les apps" : "Filtrer apps Authelia"}>
                        <ActionIcon
                          variant={autheliaFilter ? 'filled' : 'subtle'}
                          color={autheliaFilter ? 'blue' : 'gray'}
                          size="lg"
                          onClick={() => setAutheliaFilter(!autheliaFilter)}
                        >
                          <Image
                            src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/authelia.svg"
                            alt="Authelia"
                            w={20}
                            h={20}
                          />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label="Recherche globale (Ctrl+K)">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="lg"
                          onClick={() => setGlobalSearchOpen(true)}
                        >
                          <IconSearch size={20} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label="Raccourcis clavier (?)">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="lg"
                          onClick={() => setShortcutsModalOpen(true)}
                        >
                          <IconKeyboard size={20} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label="Rafraîchir les données (Ctrl+R)">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="lg"
                          onClick={handleRefreshAll}
                          loading={isRefreshing}
                          loaderProps={{ size: 16 }}
                        >
                          <IconRefresh size={20} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label="Mode Kiosk">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="lg"
                          onClick={() => setKioskConfigOpen(true)}
                        >
                          <IconDeviceTv size={20} />
                        </ActionIcon>
                      </Tooltip>

                      {user?.is_admin && (
                        <Button
                          leftSection={<IconPlus size={18} />}
                          onClick={() => setAddModalOpen(true)}
                          size={isTablet ? 'sm' : 'md'}
                        >
                          {isTablet ? 'Ajouter' : 'Ajouter'}
                        </Button>
                      )}
                    </Group>
                  </Group>
                )}
              </Box>
            )}

          {/* Default Tab Content (Dashboard) - Keep mounted but hidden when on custom/infrastructure tabs or mobile specific views */}
          <Box style={{ display: (!currentTab || currentTab.tab_type === 'default') && (!isMobile || mobileView === 'home') ? 'block' : 'none' }}>
            <>
              {/* Title section */}
              <Box mb="xl">
                <Title order={1}>
                  {selectedCategory
                    ? categories.find((c: Category) => c.slug === selectedCategory)?.name || 'Dashboard'
                    : 'Toutes les applications'}
                </Title>
                <Text c="dimmed" size="sm">
                  {filteredApplications.length} application{filteredApplications.length > 1 ? 's' : ''}
                </Text>
              </Box>

              {/* Widgets Section */}
              {visibleWidgets.length > 0 && !searchQuery && !selectedCategory && (
                <Box mb="xl">
                  {user?.is_admin && (
                    <Group justify="flex-end" mb="xs">
                      <Tooltip label="Configurer les widgets">
                        <ActionIcon
                          component={Link}
                          href="/dashboard/widgets"
                          variant="subtle"
                          size="sm"
                        >
                          <IconSettings size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                  <WidgetGrid widgets={visibleWidgets} isAdmin={user?.is_admin} columns={4} />
                </Box>
              )}

              {/* Applications Content */}
              {isLoading ? (
                <Center py="xl">
                  <Loader size="lg" />
                </Center>
              ) : filteredApplications.length === 0 ? (
                <Center py="xl">
                  <Box ta="center">
                    <Text size="lg" fw={500} mb="sm">
                      Aucune application trouvée
                    </Text>
                    <Text c="dimmed" size="sm">
                      {searchQuery
                        ? 'Essayez une autre recherche'
                        : 'Les applications de NPM apparaîtront ici après la synchronisation'}
                    </Text>
                    {user?.is_admin && !searchQuery && (
                      <Button
                        mt="md"
                        onClick={() => syncMutation.mutate()}
                        loading={syncMutation.isPending}
                      >
                        Synchroniser maintenant
                      </Button>
                    )}
                  </Box>
                </Center>
              ) : selectedCategory ? (
                // Show only selected category
                <SortableCategorySection
                  category={categories.find((c: Category) => c.slug === selectedCategory)!}
                  applications={filteredApplications}
                  isAdmin={user?.is_admin}
                  onReorder={(ids) => reorderMutation.mutate(ids)}
                  urlStatuses={urlStatuses}
                />
              ) : (
                // Show all categories
                categories.map((category: Category) => (
                  <SortableCategorySection
                    key={category.id}
                    category={category}
                    applications={applicationsByCategory[category.slug] || []}
                    isAdmin={user?.is_admin}
                    onReorder={(ids) => reorderMutation.mutate(ids)}
                    urlStatuses={urlStatuses}
                  />
                ))
              )}
            </>
          </Box>

          {/* Infrastructure Tab Content */}
          {currentTab?.tab_type === 'infrastructure' && (!isMobile || mobileView === 'home') && (
            <Box>
              <InfrastructureSchema />
            </Box>
          )}

          {/* Chat Tab Content (desktop or via tab navigation) */}
          {currentTab?.tab_type === 'chat' && (!isMobile || mobileView === 'home') && (
            <Box h="calc(100vh - 120px)">
              <ChatTab tabId={currentTab.id} />
            </Box>
          )}

          {/* App Dashboard Tab Content */}
          {currentTab?.tab_type === 'app_dashboard' && (!isMobile || mobileView === 'home') && (
            <Box h="calc(100vh - 120px)">
              <AppDashboardTab
                tab={currentTab}
                isAdmin={user?.is_admin}
                onDeleted={() => {
                  // Navigate to first available tab after deletion
                  const remainingTabs = tabs.filter(t => t.id !== currentTab.id);
                  if (remainingTabs.length > 0) {
                    const defaultTab = remainingTabs.find(t => t.tab_type === 'default') || remainingTabs[0];
                    handleTabChange(defaultTab.slug);
                  }
                }}
              />
            </Box>
          )}

          {/* Custom Tab Content - Keep visited tabs mounted but hidden for performance */}
          {customTabsToRender.map((tab) => (
            <Box
              key={tab.id}
              style={{
                display: activeTab === tab.slug && (!isMobile || mobileView === 'home') ? 'block' : 'none',
              }}
            >
              <CustomTabContent
                tab={tab}
                isAdmin={user?.is_admin}
              />
            </Box>
          ))}

          {/* Mobile-specific views when using bottom navigation */}
          {isMobile && mobileView === 'tasks' && (
            <Box h="calc(100vh - 140px)">
              <MobileTasksView vikunjaWidgetId={vikunjaWidgetId} />
            </Box>
          )}

          {isMobile && mobileView === 'notes' && (
            <Box h="calc(100vh - 140px)">
              <MobileNotesView notesWidgetId={notesWidgetId} />
            </Box>
          )}

          {isMobile && mobileView === 'calendar' && (
            <Box h="calc(100vh - 140px)">
              <MobileCalendarView vikunjaWidgetId={vikunjaWidgetId} />
            </Box>
          )}

          {isMobile && mobileView === 'chat' && chatTab && (
            <Box h="calc(100vh - 140px)">
              <ChatTab tabId={chatTab.id} />
            </Box>
          )}
        </Box>
      </AppShell.Main>

      {/* Edit Modal */}
      <EditAppModal
        app={editingApplication}
        categories={categories}
        onClose={() => setEditingApp(null)}
        onSave={handleRefresh}
      />

      {/* Add Modal */}
      <AddAppModal
        opened={addModalOpen}
        categories={categories}
        onClose={() => setAddModalOpen(false)}
        onSave={handleRefresh}
      />

        {/* Edit Category Modal */}
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={handleCategoryRefresh}
        />

        {/* Create App Dashboard Modal */}
        <CreateAppDashboardModal
          opened={appDashboardModalOpen}
          onClose={() => setAppDashboardModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['tabs'] });
          }}
        />
      </AppShell>

      {/* Mobile Bottom Navigation */}
      {isMobile && !isKioskMode && (
        <MobileBottomNav
          activeView={mobileView}
          onViewChange={setMobileView}
          taskCount={incompleteTaskCount}
        />
      )}
    </>
  );
}
