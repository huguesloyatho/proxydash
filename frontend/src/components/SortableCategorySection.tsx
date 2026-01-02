'use client';

import { useState, useEffect } from 'react';
import { Box, Title, Text } from '@mantine/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Application, Category } from '@/types';
import { SortableAppCard } from './SortableAppCard';
import { URLStatus } from '@/lib/api';

interface SortableCategorySectionProps {
  category: Category;
  applications: Application[];
  isAdmin?: boolean;
  onReorder?: (appIds: number[]) => void;
  urlStatuses?: Record<string, URLStatus>;
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

export function SortableCategorySection({
  category,
  applications,
  isAdmin,
  onReorder,
  urlStatuses = {},
}: SortableCategorySectionProps) {
  const [items, setItems] = useState(applications);

  // Update items when applications prop changes
  useEffect(() => {
    setItems(applications);
  }, [applications]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Notify parent of new order
        if (onReorder) {
          onReorder(newItems.map((item) => item.id));
        }

        return newItems;
      });
    }
  };

  if (applications.length === 0) {
    return null;
  }

  // Sort by display_order
  const sortedApps = [...items].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <Box mb="xl">
      <Title order={3} mb="md" className="flex items-center gap-2">
        <span className="text-2xl">{getCategoryEmoji(category.icon)}</span>
        {category.name}
        <Text span size="sm" c="dimmed" fw={400}>
          ({applications.length})
        </Text>
      </Title>

      {isAdmin ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedApps.map((a) => a.id)} strategy={rectSortingStrategy}>
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '16px',
              }}
            >
              {sortedApps.map((app) => (
                <SortableAppCard
                  key={app.id}
                  app={app}
                  isAdmin={isAdmin}
                  urlStatus={urlStatuses[app.url]}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      ) : (
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '16px',
          }}
        >
          {sortedApps.map((app) => (
            <SortableAppCard
              key={app.id}
              app={app}
              isAdmin={false}
              urlStatus={urlStatuses[app.url]}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
