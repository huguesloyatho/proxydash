'use client';

import { Box, Text, Center } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { WidgetCard, Widget } from './WidgetCard';

interface WidgetGridProps {
  widgets: Widget[];
  isAdmin?: boolean;
  onEdit?: (widget: Widget) => void;
  onDelete?: (widget: Widget) => void;
  onToggleVisibility?: (widget: Widget) => void;
  onTogglePublic?: (widget: Widget) => void;
  onRemoveFromTab?: (widgetId: number) => void;
  columns?: number;
}

export function WidgetGrid({
  widgets,
  isAdmin = false,
  onEdit,
  onDelete,
  onToggleVisibility,
  onTogglePublic,
  onRemoveFromTab,
  columns = 4,
}: WidgetGridProps) {
  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 576px)');
  const isTablet = useMediaQuery('(min-width: 577px) and (max-width: 992px)');
  const isSmallDesktop = useMediaQuery('(min-width: 993px) and (max-width: 1200px)');

  // Determine responsive column count
  const getResponsiveColumns = () => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    if (isSmallDesktop) return 3;
    return columns; // desktop: use prop value (default 4)
  };

  const responsiveColumns = getResponsiveColumns();

  // Adjust row height for mobile
  const rowHeight = isMobile ? '200px' : '180px';

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
  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position);

  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${responsiveColumns}, minmax(0, 1fr))`,
        gap: isMobile ? '12px' : '16px',
        gridAutoRows: rowHeight,
      }}
    >
      {sortedWidgets.map((widget) => {
        // On mobile, widgets span full width; on tablet, limit to 2 cols max
        const colSpan = isMobile
          ? 1
          : isTablet
            ? Math.min(widget.col_span || 1, 2)
            : Math.min(widget.col_span || 1, responsiveColumns);

        const rowSpan = isMobile
          ? Math.min(widget.row_span || 1, 2) // Limit height on mobile
          : widget.row_span || 1;

        return (
          <div
            key={widget.id}
            style={{
              gridColumn: `span ${colSpan}`,
              gridRow: `span ${rowSpan}`,
            }}
          >
            <WidgetCard
              widget={widget}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
              onTogglePublic={onTogglePublic}
              onRemoveFromTab={onRemoveFromTab ? () => onRemoveFromTab(widget.id) : undefined}
            />
          </div>
        );
      })}
    </Box>
  );
}
