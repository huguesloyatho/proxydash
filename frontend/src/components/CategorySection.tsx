'use client';

import { Box, Title, SimpleGrid, Text } from '@mantine/core';
import { Application, Category } from '@/types';
import { AppCard } from './AppCard';

interface CategorySectionProps {
  category: Category;
  applications: Application[];
  isAdmin?: boolean;
}

export function CategorySection({ category, applications, isAdmin }: CategorySectionProps) {
  if (applications.length === 0) {
    return null;
  }

  return (
    <Box mb="xl">
      <Title order={3} mb="md" className="flex items-center gap-2">
        <span className="text-2xl">{getCategoryEmoji(category.icon)}</span>
        {category.name}
        <Text span size="sm" c="dimmed" fw={400}>
          ({applications.length})
        </Text>
      </Title>

      <SimpleGrid
        cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6, xl: 7 }}
        spacing="md"
      >
        {applications.map((app) => (
          <AppCard key={app.id} app={app} isAdmin={isAdmin} />
        ))}
      </SimpleGrid>
    </Box>
  );
}

function getCategoryEmoji(icon: string): string {
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
}
