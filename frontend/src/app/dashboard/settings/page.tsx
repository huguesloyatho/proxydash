'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Group,
  Title,
  Paper,
  NavLink,
  Loader,
  Center,
  ActionIcon,
  Tooltip,
  Stack,
  Drawer,
  Burger,
  Text,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconUsers,
  IconServer,
  IconLayoutDashboard,
  IconEyeOff,
  IconPalette,
  IconArrowLeft,
  IconDatabase,
  IconRefresh,
  IconRobot,
  IconMicrophone,
  IconBell,
  IconShield,
  IconWebhook,
} from '@tabler/icons-react';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import Link from 'next/link';

// Import settings components
import { ServersSettings } from '@/components/settings/ServersSettings';
import { AutoUpdateSettings } from '@/components/settings/AutoUpdateSettings';
import { OllamaSettings } from '@/components/settings/OllamaSettings';
import { SpeechSettings } from '@/components/settings/SpeechSettings';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { WebhooksSettings } from '@/components/settings/WebhooksSettings';
import { ThemeConfigurator } from '@/components/ThemeConfigurator';

// Lazy imports for existing pages content
import dynamic from 'next/dynamic';

const UsersSettingsContent = dynamic(() => import('./UsersSettingsContent'), {
  loading: () => <Center py="xl"><Loader /></Center>,
});

const NpmInstancesSettingsContent = dynamic(() => import('./NpmInstancesSettingsContent'), {
  loading: () => <Center py="xl"><Loader /></Center>,
});

const HiddenAppsSettingsContent = dynamic(() => import('./HiddenAppsSettingsContent'), {
  loading: () => <Center py="xl"><Loader /></Center>,
});

type TabType = 'users' | 'npm-instances' | 'servers' | 'hidden-apps' | 'auto-update' | 'ollama' | 'speech' | 'webhooks' | 'notifications' | 'security' | 'personalize';

interface TabConfig {
  key: TabType;
  label: string;
  icon: React.ReactNode;
  adminOnly: boolean;
}

const tabs: TabConfig[] = [
  { key: 'users', label: 'Utilisateurs', icon: <IconUsers size={18} />, adminOnly: true },
  { key: 'npm-instances', label: 'Instances NPM', icon: <IconDatabase size={18} />, adminOnly: true },
  { key: 'servers', label: 'Serveurs', icon: <IconServer size={18} />, adminOnly: true },
  { key: 'hidden-apps', label: 'Apps masquées', icon: <IconEyeOff size={18} />, adminOnly: true },
  { key: 'auto-update', label: 'Mises à jour', icon: <IconRefresh size={18} />, adminOnly: true },
  { key: 'ollama', label: 'Assistant IA', icon: <IconRobot size={18} />, adminOnly: true },
  { key: 'speech', label: 'Reconnaissance vocale', icon: <IconMicrophone size={18} />, adminOnly: true },
  { key: 'webhooks', label: 'Webhooks', icon: <IconWebhook size={18} />, adminOnly: true },
  { key: 'notifications', label: 'Notifications', icon: <IconBell size={18} />, adminOnly: false },
  { key: 'security', label: 'Sécurité', icon: <IconShield size={18} />, adminOnly: false },
  { key: 'personalize', label: 'Personnaliser', icon: <IconPalette size={18} />, adminOnly: false },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  // Mobile responsive
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [navDrawerOpened, { open: openNavDrawer, close: closeNavDrawer }] = useDisclosure(false);

  // Get tab from URL or default to first available
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && tabs.find(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    authApi.getMe().then((userData) => {
      setAuth(token, userData);
    }).catch(() => {
      logout();
      router.push('/login');
    });
  }, []);

  const handleTabChange = (tab: TabType) => {
    if (tab === 'personalize') {
      setThemeModalOpen(true);
    } else {
      setActiveTab(tab);
      router.push(`/dashboard/settings?tab=${tab}`, { scroll: false });
    }
    // Close drawer on mobile after selection
    if (isMobile) {
      closeNavDrawer();
    }
  };

  if (!isAuthenticated) {
    return (
      <Center className="min-h-screen">
        <Loader size="xl" />
      </Center>
    );
  }

  const filteredTabs = tabs.filter(tab => !tab.adminOnly || user?.is_admin);

  // Get current tab label for mobile header
  const currentTabLabel = filteredTabs.find(t => t.key === activeTab)?.label || 'Paramètres';

  // Navigation component (shared between desktop sidebar and mobile drawer)
  const NavigationItems = () => (
    <>
      {filteredTabs.map((tab) => (
        <NavLink
          key={tab.key}
          label={tab.label}
          leftSection={tab.icon}
          active={activeTab === tab.key}
          onClick={() => handleTabChange(tab.key)}
          variant="filled"
          style={{ borderRadius: 8, marginBottom: 4 }}
        />
      ))}
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return user?.is_admin ? <UsersSettingsContent /> : null;
      case 'npm-instances':
        return user?.is_admin ? <NpmInstancesSettingsContent /> : null;
      case 'servers':
        return user?.is_admin ? <ServersSettings /> : null;
      case 'hidden-apps':
        return user?.is_admin ? <HiddenAppsSettingsContent /> : null;
      case 'auto-update':
        return user?.is_admin ? <AutoUpdateSettings /> : null;
      case 'ollama':
        return user?.is_admin ? <OllamaSettings /> : null;
      case 'speech':
        return user?.is_admin ? <SpeechSettings /> : null;
      case 'webhooks':
        return user?.is_admin ? <WebhooksSettings /> : null;
      case 'notifications':
        return <NotificationsSettings />;
      case 'security':
        return <SecuritySettings />;
      default:
        return null;
    }
  };

  return (
    <Box p={isMobile ? 'sm' : 'xl'} maw={1400} mx="auto">
      {/* Mobile Navigation Drawer */}
      <Drawer
        opened={navDrawerOpened}
        onClose={closeNavDrawer}
        title="Paramètres"
        size="280px"
        padding="md"
      >
        <NavigationItems />
      </Drawer>

      {/* Header */}
      <Group mb="xl" gap="xs" justify="space-between">
        <Group gap="xs">
          <Tooltip label="Retour au dashboard">
            <ActionIcon
              component={Link}
              href="/dashboard"
              variant="subtle"
              size="lg"
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
          </Tooltip>
          <Title order={isMobile ? 3 : 1}>
            {isMobile ? currentTabLabel : 'Paramètres'}
          </Title>
        </Group>

        {/* Mobile menu button */}
        {isMobile && (
          <ActionIcon variant="subtle" size="lg" onClick={openNavDrawer}>
            <IconLayoutDashboard size={20} />
          </ActionIcon>
        )}
      </Group>

      {isMobile ? (
        /* Mobile: Content only, navigation in drawer */
        <Box>
          {renderContent()}
        </Box>
      ) : (
        /* Desktop: Side navigation + Content */
        <Group align="flex-start" gap="xl">
          {/* Vertical Navigation */}
          <Paper withBorder p="md" w={250} style={{ flexShrink: 0 }}>
            <NavigationItems />
          </Paper>

          {/* Content Area */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            {renderContent()}
          </Box>
        </Group>
      )}

      {/* Theme Configurator Modal */}
      <ThemeConfigurator opened={themeModalOpen} onClose={() => setThemeModalOpen(false)} />
    </Box>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Center className="min-h-screen"><Loader size="xl" /></Center>}>
      <SettingsContent />
    </Suspense>
  );
}
