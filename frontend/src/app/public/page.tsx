'use client';

import { useMemo, useState } from 'react';
import {
  AppShell,
  Box,
  Title,
  Text,
  Loader,
  Center,
  SimpleGrid,
  Card,
  Image,
  Tooltip,
  TextInput,
  ActionIcon,
  Group,
  ThemeIcon,
  Divider,
  NavLink,
  ScrollArea,
} from '@mantine/core';
import { IconSearch, IconX, IconExternalLink, IconLogin, IconApps, IconHome } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { publicApi } from '@/lib/api';
import { Application, Category } from '@/types';

interface PublicDashboardData {
  categories: Array<{
    category: Category;
    applications: Application[];
  }>;
  total_applications: number;
}

function PublicAppCard({ app }: { app: Application }) {
  const handleClick = () => {
    window.open(app.url, '_blank', 'noopener,noreferrer');
  };

  const cardContent = (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-blue-500"
      onClick={handleClick}
      style={{ height: '140px' }}
    >
      <div className="flex flex-col items-center justify-center h-full gap-2">
        {app.icon ? (
          <Image
            src={app.icon}
            alt={app.name}
            w={44}
            h={44}
            fit="contain"
            fallbackSrc="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/default.svg"
          />
        ) : (
          <ThemeIcon size={44} variant="light" color="blue" radius="md">
            <IconExternalLink size={24} />
          </ThemeIcon>
        )}

        <Text fw={500} size="sm" ta="center" lineClamp={2}>
          {app.name}
        </Text>
      </div>
    </Card>
  );

  if (app.description) {
    return (
      <Tooltip
        label={app.description}
        position="bottom"
        withArrow
        multiline
        w={220}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
}

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

export default function PublicDashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch public dashboard data
  const { data, isLoading, error } = useQuery<PublicDashboardData>({
    queryKey: ['public-dashboard'],
    queryFn: publicApi.getDashboard,
  });

  // Filter applications by search and category
  const filteredData = useMemo(() => {
    if (!data) return data;

    let filtered = data.categories;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(cat => cat.category.slug === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map(cat => ({
        ...cat,
        applications: cat.applications.filter(
          (app: Application) =>
            app.name.toLowerCase().includes(query) ||
            app.url.toLowerCase().includes(query) ||
            app.description?.toLowerCase().includes(query)
        )
      })).filter(cat => cat.applications.length > 0);
    }

    return {
      ...data,
      categories: filtered
    };
  }, [data, searchQuery, selectedCategory]);

  // Get all applications flat
  const allApplications = useMemo(() => {
    if (!filteredData) return [];
    return filteredData.categories.flatMap(cat => cat.applications);
  }, [filteredData]);

  if (isLoading) {
    return (
      <Center className="min-h-screen">
        <Loader size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center className="min-h-screen">
        <Box ta="center">
          <Text size="lg" fw={500} c="red" mb="sm">
            Erreur de chargement
          </Text>
          <Text c="dimmed">Impossible de charger le dashboard public</Text>
        </Box>
      </Center>
    );
  }

  const totalApps = allApplications.length;
  const categories = data?.categories || [];

  return (
    <AppShell
      navbar={{ width: 260, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Navbar>
        <Box className="h-full flex flex-col">
          {/* Header */}
          <Box p="md">
            <Group gap="sm" justify="space-between">
              <Group gap="sm">
                <IconApps size={28} className="text-blue-500" />
                <Title order={3}>ProxyDash</Title>
              </Group>
              <Tooltip label="Connexion admin">
                <ActionIcon
                  component={Link}
                  href="/login"
                  variant="subtle"
                  color="gray"
                  size="lg"
                >
                  <IconLogin size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Dashboard public
            </Text>
          </Box>

          <Divider />

          {/* Search */}
          <Box p="sm">
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              rightSection={
                searchQuery && (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )
              }
            />
          </Box>

          {/* Categories */}
          <ScrollArea className="flex-1" p="sm">
            <NavLink
              label="Toutes les applications"
              leftSection={<IconHome size={18} />}
              active={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
              variant="filled"
              className="mb-2"
            />

            {categories.length > 0 && (
              <>
                <Text size="xs" c="dimmed" fw={500} mt="md" mb="xs" px="sm">
                  CATÉGORIES
                </Text>

                {categories.map((categoryData) => (
                  <NavLink
                    key={categoryData.category.slug}
                    label={
                      <Group gap="xs" justify="space-between">
                        <Text size="sm">{categoryData.category.name}</Text>
                        <Text size="xs" c="dimmed">
                          {categoryData.applications.length}
                        </Text>
                      </Group>
                    }
                    leftSection={<span>{getCategoryIcon(categoryData.category.icon)}</span>}
                    active={selectedCategory === categoryData.category.slug}
                    onClick={() => setSelectedCategory(categoryData.category.slug)}
                    variant="light"
                  />
                ))}
              </>
            )}
          </ScrollArea>

        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box className="max-w-6xl mx-auto">
          {/* Header */}
          <Group justify="space-between" mb="xl">
            <div>
              <Title order={1}>
                {selectedCategory
                  ? categories.find(c => c.category.slug === selectedCategory)?.category.name || 'Applications'
                  : 'Toutes les applications'}
              </Title>
              <Text c="dimmed" size="sm">
                {totalApps} application{totalApps > 1 ? 's' : ''} disponible{totalApps > 1 ? 's' : ''}
              </Text>
            </div>
          </Group>

          {/* Content */}
          {totalApps === 0 ? (
            <Center py="xl">
              <Box ta="center">
                <ThemeIcon size={80} variant="light" color="gray" radius="xl" mb="lg">
                  <IconExternalLink size={40} />
                </ThemeIcon>
                <Text size="xl" fw={500} mb="sm">
                  Aucune application publique
                </Text>
                <Text c="dimmed" size="md" maw={400}>
                  {searchQuery
                    ? 'Aucune application ne correspond à votre recherche'
                    : 'Les applications publiques apparaîtront ici une fois configurées par l\'administrateur'}
                </Text>
              </Box>
            </Center>
          ) : selectedCategory ? (
            // Single category view
            <SimpleGrid
              cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }}
              spacing="md"
            >
              {allApplications.map((app: Application) => (
                <PublicAppCard key={app.id} app={app} />
              ))}
            </SimpleGrid>
          ) : (
            // All categories view
            filteredData?.categories.map((categoryData) => (
              <Box key={categoryData.category.slug} mb="xl">
                <Group gap="sm" mb="md">
                  <Text size="lg">{getCategoryIcon(categoryData.category.icon)}</Text>
                  <Title order={3}>{categoryData.category.name}</Title>
                  <Text c="dimmed" size="sm">({categoryData.applications.length})</Text>
                </Group>

                <SimpleGrid
                  cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }}
                  spacing="md"
                >
                  {categoryData.applications.map((app: Application) => (
                    <PublicAppCard key={app.id} app={app} />
                  ))}
                </SimpleGrid>
              </Box>
            ))
          )}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
