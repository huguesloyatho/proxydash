'use client';

import { useState, useCallback } from 'react';
import { Box, Text, Card, Group, ActionIcon, Badge, Stack, Button, Paper } from '@mantine/core';
import {
  IconGripVertical,
  IconArrowsMaximize,
  IconMinus,
  IconPlus,
  IconCheck,
  IconX,
  IconArrowUp,
  IconArrowDown,
  IconClock,
  IconCalendar,
  IconCloud,
  IconServer,
  IconChecklist,
  IconBrandTabler,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import { Widget } from './WidgetCard';

interface EditableWidgetGridProps {
  widgets: Widget[];
  onSave: (updates: { id: number; position: number; col_span: number; row_span: number }[]) => void;
  onCancel: () => void;
  columns?: number;
}

// Widget icons
const widgetIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  clock: IconClock,
  calendar: IconCalendar,
  weather: IconCloud,
  proxmox_node: IconServer,
  proxmox_vm: IconDeviceDesktop,
  proxmox_summary: IconServer,
  vm_status: IconServer,
  vikunja: IconChecklist,
  iframe: IconBrandTabler,
};

// Widget titles for display
const widgetTitles: Record<string, string> = {
  clock: 'Horloge',
  calendar: 'Calendrier',
  weather: 'Météo',
  proxmox_node: 'Noeud Proxmox',
  proxmox_vm: 'VM Proxmox',
  proxmox_summary: 'Résumé Proxmox',
  system_stats: 'Stats Système',
  iframe: 'Iframe',
  vm_status: 'VM / Serveur',
  vikunja: 'Vikunja',
};

export function EditableWidgetGrid({
  widgets: initialWidgets,
  onSave,
  onCancel,
}: EditableWidgetGridProps) {
  const [widgets, setWidgets] = useState(() =>
    [...initialWidgets].sort((a, b) => (a.position || 0) - (b.position || 0))
  );

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setWidgets((items) => {
      const newItems = [...items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      return newItems;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setWidgets((items) => {
      if (index >= items.length - 1) return items;
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      return newItems;
    });
  }, []);

  const handleResize = useCallback((id: number, colSpan: number, rowSpan: number) => {
    setWidgets((items) =>
      items.map((item) =>
        item.id === id ? { ...item, col_span: colSpan, row_span: rowSpan } : item
      )
    );
  }, []);

  const handleSave = () => {
    const updates = widgets.map((widget, index) => ({
      id: widget.id,
      position: index,
      col_span: widget.col_span || 1,
      row_span: widget.row_span || 1,
    }));
    onSave(updates);
  };

  return (
    <Stack gap="md">
      {/* Toolbar */}
      <Card withBorder padding="sm" bg="blue.9">
        <Group justify="space-between">
          <Group gap="md">
            <IconArrowsMaximize size={20} className="text-blue-300" />
            <Text size="sm" c="blue.1">
              Mode personnalisation - Réorganisez et redimensionnez vos widgets
            </Text>
          </Group>
          <Group gap="sm">
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              leftSection={<IconX size={16} />}
              onClick={onCancel}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              variant="filled"
              color="green"
              leftSection={<IconCheck size={16} />}
              onClick={handleSave}
            >
              Enregistrer
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Widget List */}
      <Stack gap="sm">
        {widgets.map((widget, index) => {
          const title = widget.title || widgetTitles[widget.widget_type] || widget.widget_type;
          const Icon = widgetIcons[widget.widget_type] || IconGripVertical;

          return (
            <Paper
              key={widget.id}
              withBorder
              p="md"
              radius="md"
              style={{
                background: 'var(--mantine-color-dark-6)',
                borderColor: 'var(--mantine-color-dark-4)',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                {/* Left: Position controls + Widget info */}
                <Group gap="md" wrap="nowrap">
                  {/* Position number */}
                  <Badge size="lg" variant="filled" color="dark" radius="sm" w={36}>
                    {index + 1}
                  </Badge>

                  {/* Move up/down */}
                  <Stack gap={2}>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                    >
                      <IconArrowUp size={14} />
                    </ActionIcon>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      disabled={index === widgets.length - 1}
                      onClick={() => handleMoveDown(index)}
                    >
                      <IconArrowDown size={14} />
                    </ActionIcon>
                  </Stack>

                  {/* Widget icon and title */}
                  <Group gap="sm">
                    <Icon size={20} className="text-blue-400" />
                    <div>
                      <Text size="sm" fw={500}>{title}</Text>
                      <Text size="xs" c="dimmed">{widget.widget_type}</Text>
                    </div>
                  </Group>
                </Group>

                {/* Right: Size controls */}
                <Group gap="lg" wrap="nowrap">
                  {/* Current size badge */}
                  <Badge size="lg" variant="light" color="blue">
                    {widget.col_span || 1} × {widget.row_span || 1}
                  </Badge>

                  {/* Column controls */}
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed" w={50}>Largeur</Text>
                    <ActionIcon
                      size="sm"
                      variant="filled"
                      color="blue"
                      disabled={(widget.col_span || 1) <= 1}
                      onClick={() => handleResize(widget.id, Math.max(1, (widget.col_span || 1) - 1), widget.row_span || 1)}
                    >
                      <IconMinus size={12} />
                    </ActionIcon>
                    <Text size="sm" fw={500} w={16} ta="center">{widget.col_span || 1}</Text>
                    <ActionIcon
                      size="sm"
                      variant="filled"
                      color="blue"
                      disabled={(widget.col_span || 1) >= 4}
                      onClick={() => handleResize(widget.id, Math.min(4, (widget.col_span || 1) + 1), widget.row_span || 1)}
                    >
                      <IconPlus size={12} />
                    </ActionIcon>
                  </Group>

                  {/* Row controls */}
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed" w={50}>Hauteur</Text>
                    <ActionIcon
                      size="sm"
                      variant="filled"
                      color="green"
                      disabled={(widget.row_span || 1) <= 1}
                      onClick={() => handleResize(widget.id, widget.col_span || 1, Math.max(1, (widget.row_span || 1) - 1))}
                    >
                      <IconMinus size={12} />
                    </ActionIcon>
                    <Text size="sm" fw={500} w={16} ta="center">{widget.row_span || 1}</Text>
                    <ActionIcon
                      size="sm"
                      variant="filled"
                      color="green"
                      disabled={(widget.row_span || 1) >= 4}
                      onClick={() => handleResize(widget.id, widget.col_span || 1, Math.min(4, (widget.row_span || 1) + 1))}
                    >
                      <IconPlus size={12} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Group>
            </Paper>
          );
        })}
      </Stack>

      {/* Preview hint */}
      <Text size="xs" c="dimmed" ta="center">
        L&apos;ordre des widgets détermine leur position dans la grille (de gauche à droite, de haut en bas)
      </Text>
    </Stack>
  );
}
