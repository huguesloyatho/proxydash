'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  TextInput,
  Box,
  Text,
  Group,
  Stack,
  Badge,
  ScrollArea,
  UnstyledButton,
  Kbd,
  ThemeIcon,
  Loader,
  Center,
  Divider,
} from '@mantine/core';
import {
  IconSearch,
  IconApps,
  IconLayoutDashboard,
  IconChecklist,
  IconNote,
  IconMessage,
  IconCategory,
  IconExternalLink,
  IconArrowRight,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { applicationsApi, tabsApi, vikunjaApi } from '@/lib/api';
import { Application, Tab } from '@/types';

interface GlobalSearchProps {
  opened: boolean;
  onClose: () => void;
  onNavigate: (type: 'app' | 'tab' | 'task' | 'note', id: number | string, data?: unknown) => void;
}

interface SearchResult {
  id: string;
  type: 'app' | 'tab' | 'task' | 'note' | 'category';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  url?: string;
  data?: unknown;
}

export function GlobalSearch({ opened, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.list(undefined, true),
    enabled: opened,
  });

  const { data: tabs = [] } = useQuery<Tab[]>({
    queryKey: ['tabs'],
    queryFn: tabsApi.list,
    enabled: opened,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['vikunja-tasks-search'],
    queryFn: () => vikunjaApi.getUpcomingTasks(50),
    enabled: opened,
  });

  // Reset on open
  useEffect(() => {
    if (opened) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [opened]);

  // Search results
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      // Show recent/suggested items when no query
      const suggestions: SearchResult[] = [];

      // Add tabs as suggestions
      tabs.slice(0, 4).forEach((tab) => {
        suggestions.push({
          id: `tab-${tab.id}`,
          type: 'tab',
          title: tab.name,
          subtitle: `Onglet ${tab.tab_type}`,
          icon: getTabIcon(tab.tab_type),
        });
      });

      // Add a few apps
      applications.slice(0, 4).forEach((app: Application) => {
        suggestions.push({
          id: `app-${app.id}`,
          type: 'app',
          title: app.name,
          subtitle: app.category?.name || 'Application',
          icon: <IconApps size={16} />,
          url: app.url,
          data: app,
        });
      });

      return suggestions;
    }

    const lowerQuery = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Search applications
    applications.forEach((app: Application) => {
      if (
        app.name.toLowerCase().includes(lowerQuery) ||
        app.url.toLowerCase().includes(lowerQuery) ||
        app.description?.toLowerCase().includes(lowerQuery) ||
        app.category?.name.toLowerCase().includes(lowerQuery)
      ) {
        matches.push({
          id: `app-${app.id}`,
          type: 'app',
          title: app.name,
          subtitle: app.category?.name || app.url,
          icon: <IconApps size={16} />,
          url: app.url,
          data: app,
        });
      }
    });

    // Search tabs
    tabs.forEach((tab) => {
      if (
        tab.name.toLowerCase().includes(lowerQuery) ||
        tab.slug.toLowerCase().includes(lowerQuery)
      ) {
        matches.push({
          id: `tab-${tab.id}`,
          type: 'tab',
          title: tab.name,
          subtitle: `Onglet ${tab.tab_type}`,
          icon: getTabIcon(tab.tab_type),
        });
      }
    });

    // Search tasks
    if (Array.isArray(tasks)) {
      tasks.forEach((task: { id: number; title: string; project?: { title: string } }) => {
        if (task.title.toLowerCase().includes(lowerQuery)) {
          matches.push({
            id: `task-${task.id}`,
            type: 'task',
            title: task.title,
            subtitle: task.project?.title || 'Tâche',
            icon: <IconChecklist size={16} />,
            data: task,
          });
        }
      });
    }

    return matches.slice(0, 15); // Limit results
  }, [query, applications, tabs, tasks]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      } else if (event.key === 'Escape') {
        onClose();
      }
    },
    [results, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'app' && result.url) {
      window.open(result.url, '_blank');
    } else {
      onNavigate(result.type as 'tab' | 'task' | 'note', result.id, result.data);
    }
    onClose();
  };

  function getTabIcon(tabType: string) {
    switch (tabType) {
      case 'default':
        return <IconLayoutDashboard size={16} />;
      case 'chat':
        return <IconMessage size={16} />;
      case 'custom':
        return <IconCategory size={16} />;
      default:
        return <IconLayoutDashboard size={16} />;
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'app':
        return 'blue';
      case 'tab':
        return 'violet';
      case 'task':
        return 'green';
      case 'note':
        return 'yellow';
      default:
        return 'gray';
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'app':
        return 'App';
      case 'tab':
        return 'Onglet';
      case 'task':
        return 'Tâche';
      case 'note':
        return 'Note';
      default:
        return type;
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      padding={0}
      withCloseButton={false}
      centered
      radius="lg"
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
      styles={{
        content: {
          overflow: 'hidden',
        },
      }}
    >
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <TextInput
          ref={inputRef}
          placeholder="Rechercher apps, onglets, tâches..."
          leftSection={<IconSearch size={20} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          size="lg"
          variant="unstyled"
          styles={{
            input: {
              fontSize: '1.1rem',
            },
          }}
          rightSection={
            <Kbd size="xs" style={{ marginRight: 8 }}>
              Esc
            </Kbd>
          }
        />
      </Box>

      <ScrollArea h={400} ref={resultsRef}>
        {results.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconSearch size={40} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed" size="sm">
                {query ? 'Aucun résultat trouvé' : 'Commencez à taper pour rechercher'}
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap={0} p="xs">
            {!query && (
              <Text size="xs" c="dimmed" px="xs" py={4}>
                Suggestions
              </Text>
            )}
            {results.map((result, index) => (
              <UnstyledButton
                key={result.id}
                data-index={index}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                p="sm"
                style={{
                  borderRadius: 8,
                  backgroundColor:
                    index === selectedIndex
                      ? 'var(--mantine-color-dark-5)'
                      : 'transparent',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon
                      variant="light"
                      color={getTypeColor(result.type)}
                      size="md"
                      radius="md"
                    >
                      {result.icon}
                    </ThemeIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {result.title}
                      </Text>
                      {result.subtitle && (
                        <Text size="xs" c="dimmed" truncate>
                          {result.subtitle}
                        </Text>
                      )}
                    </Box>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Badge
                      size="xs"
                      variant="light"
                      color={getTypeColor(result.type)}
                    >
                      {getTypeLabel(result.type)}
                    </Badge>
                    {result.type === 'app' && (
                      <IconExternalLink size={14} color="var(--mantine-color-dimmed)" />
                    )}
                    {index === selectedIndex && (
                      <IconArrowRight size={14} color="var(--mantine-color-dimmed)" />
                    )}
                  </Group>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </ScrollArea>

      <Box
        p="xs"
        style={{
          borderTop: '1px solid var(--mantine-color-dark-4)',
          backgroundColor: 'var(--mantine-color-dark-7)',
        }}
      >
        <Group justify="center" gap="md">
          <Group gap={4}>
            <Kbd size="xs">↑</Kbd>
            <Kbd size="xs">↓</Kbd>
            <Text size="xs" c="dimmed">
              naviguer
            </Text>
          </Group>
          <Group gap={4}>
            <Kbd size="xs">↵</Kbd>
            <Text size="xs" c="dimmed">
              ouvrir
            </Text>
          </Group>
          <Group gap={4}>
            <Kbd size="xs">Esc</Kbd>
            <Text size="xs" c="dimmed">
              fermer
            </Text>
          </Group>
        </Group>
      </Box>
    </Modal>
  );
}
