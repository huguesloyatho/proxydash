'use client';

import { useState } from 'react';
import { Box, Text, Center } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
import { Widget } from './WidgetCard';
import { SortableWidgetCard } from './SortableWidgetCard';

interface SortableWidgetGridProps {
  widgets: Widget[];
  isAdmin?: boolean;
  onEdit?: (widget: Widget) => void;
  onDelete?: (widget: Widget) => void;
  onToggleVisibility?: (widget: Widget) => void;
  onTogglePublic?: (widget: Widget) => void;
  onReorder?: (widgetIds: number[]) => void;
  columns?: number;
}

export function SortableWidgetGrid({
  widgets,
  isAdmin = false,
  onEdit,
  onDelete,
  onToggleVisibility,
  onTogglePublic,
  onReorder,
  columns = 4,
}: SortableWidgetGridProps) {
  const [items, setItems] = useState(widgets);

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 576px)');
  const isTablet = useMediaQuery('(min-width: 577px) and (max-width: 992px)');
  const isSmallDesktop = useMediaQuery('(min-width: 993px) and (max-width: 1200px)');

  // Calculate responsive columns
  const getResponsiveColumns = () => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    if (isSmallDesktop) return 3;
    return columns;
  };

  const responsiveColumns = getResponsiveColumns();

  // Update items when widgets prop changes
  if (widgets.length !== items.length || widgets.some((w, i) => w.id !== items[i]?.id)) {
    setItems(widgets);
  }

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

  if (widgets.length === 0) {
    return (
      <Center py="xl">
        <Text c="dimmed" size="sm">
          Aucun widget configuré
        </Text>
      </Center>
    );
  }

  // Sort widgets by position
  const sortedWidgets = [...items].sort((a, b) => a.position - b.position);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortedWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${responsiveColumns}, minmax(0, 1fr))`,
            gap: isMobile ? '12px' : '16px',
            gridAutoRows: isMobile ? '160px' : '180px',
          }}
        >
          {sortedWidgets.map((widget) => (
            <SortableWidgetCard
              key={widget.id}
              widget={widget}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
              onTogglePublic={onTogglePublic}
            />
          ))}
        </Box>
      </SortableContext>
    </DndContext>
  );
}
