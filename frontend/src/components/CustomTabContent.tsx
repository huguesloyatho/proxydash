'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Title,
  Text,
  Button,
  Group,
  Card,
  Image,
  Modal,
  TextInput,
  Stack,
  ActionIcon,
  SimpleGrid,
  Tooltip,
  Menu,
  Select,
  Divider,
  Badge,
} from '@mantine/core';
import {
  IconPlus,
  IconLink,
  IconEdit,
  IconTrash,
  IconExternalLink,
  IconLayoutDashboard,
  IconGripVertical,
  IconDotsVertical,
  IconCopy,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { tabsApi, widgetsApi, URLStatus } from '@/lib/api';
import { Tab } from '@/types';
import { WidgetCard, Widget } from '@/components/widgets';
import { TabWidgetConfigModal } from './TabWidgetConfigModal';
import { StatusIndicator } from './StatusIndicator';
import { useUrlStatus } from '@/hooks/useUrlStatus';

interface TabLink {
  id: string;
  name: string;
  url: string;
  icon?: string;
  description?: string;
}

// Widget indépendant stocké dans l'onglet (copie complète, pas une référence)
interface TabWidget {
  id: string;  // ID unique dans l'onglet (pas l'ID du widget source)
  widget_type: string;
  title: string | null;
  position: number;
  size: 'small' | 'medium' | 'large';
  col_span: number;
  row_span: number;
  config: Record<string, unknown>;
  is_visible: boolean;
  is_public: boolean;
  source_widget_id?: number;  // ID du widget source (optionnel, pour référence)
  db_widget_id?: number;  // ID réel du widget en base de données (pour historique, etc.)
}

interface TabContent {
  links?: TabLink[];
  widgets?: TabWidget[];  // Widgets indépendants avec leur propre config
  widgetIds?: number[];   // Ancien format - pour migration
}

interface CustomTabContentProps {
  tab: Tab;
  isAdmin?: boolean;
}

// Sortable widget wrapper component
interface SortableWidgetProps {
  widget: TabWidget;
  isAdmin: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  isDragging?: boolean;
}

function SortableWidget({ widget, isAdmin, onEdit, onRemove }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${widget.col_span || 1}`,
    gridRow: `span ${widget.row_span || 1}`,
    opacity: isSortableDragging ? 0.4 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/sortable">
      {/* Drag handle visible on hover for admins */}
      {isAdmin && (
        <Tooltip label="Glisser pour réorganiser" position="top">
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-100 transition-opacity bg-white dark:bg-gray-800 rounded p-1.5 shadow-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            style={{ touchAction: 'none' }}
          >
            <IconGripVertical size={14} className="text-gray-500" />
          </div>
        </Tooltip>
      )}
      <WidgetCard
        widget={{
          ...widget,
          id: widget.db_widget_id || 0,  // Use real DB widget ID if available
          column: 0,
        } as Widget}
        isAdmin={isAdmin}
        isTabWidget={!widget.db_widget_id}  // Only use direct config if no DB widget
        onEdit={onEdit}
        onRemoveFromTab={onRemove}
      />
    </div>
  );
}

export function CustomTabContent({ tab, isAdmin = false }: CustomTabContentProps) {
  const queryClient = useQueryClient();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<TabLink | null>(null);
  const [editingWidget, setEditingWidget] = useState<TabWidget | null>(null);
  const [newLink, setNewLink] = useState<Partial<TabLink>>({ name: '', url: '' });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Parse tab content
  const tabContent: TabContent = useMemo(() => {
    return (tab.content as TabContent) || { links: [], widgets: [] };
  }, [tab.content]);

  // Fetch all widgets to use as templates
  const { data: allWidgets = [] } = useQuery<Widget[]>({
    queryKey: ['widgets', 'all'],
    queryFn: widgetsApi.listAll,
    enabled: isAdmin,
  });

  // Get widgets indépendants de cet onglet
  const tabWidgets: TabWidget[] = useMemo(() => {
    return tabContent.widgets || [];
  }, [tabContent.widgets]);

  // Widget types disponibles pour création
  const widgetTypes = [
    { value: 'clock', label: 'Horloge' },
    { value: 'calendar', label: 'Calendrier' },
    { value: 'weather', label: 'Météo' },
    { value: 'notes', label: 'Notes' },
    { value: 'proxmox_node', label: 'Noeud Proxmox' },
    { value: 'proxmox_vm', label: 'VM Proxmox' },
    { value: 'proxmox_summary', label: 'Résumé Proxmox' },
    { value: 'vm_status', label: 'VM / Serveur' },
    { value: 'vikunja', label: 'Vikunja' },
    { value: 'crowdsec', label: 'CrowdSec' },
    { value: 'uptime_ping', label: 'Uptime / Ping' },
    { value: 'docker', label: 'Docker' },
    { value: 'logs', label: 'Logs Docker' },
    { value: 'rss_feed', label: 'Flux RSS' },
    { value: 'iframe', label: 'Iframe' },
  ];

  // Update tab content mutation
  const updateContentMutation = useMutation({
    mutationFn: (newContent: TabContent) =>
      tabsApi.update(tab.id, { content: newContent as Record<string, unknown> }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de mettre à jour l\'onglet',
        color: 'red',
      });
    },
  });

  // Add link
  const handleAddLink = () => {
    if (!newLink.name || !newLink.url) return;

    const link: TabLink = {
      id: Date.now().toString(),
      name: newLink.name,
      url: newLink.url.startsWith('http') ? newLink.url : `https://${newLink.url}`,
      icon: newLink.icon,
      description: newLink.description,
    };

    const newContent: TabContent = {
      ...tabContent,
      links: [...(tabContent.links || []), link],
    };

    updateContentMutation.mutate(newContent);
    setNewLink({ name: '', url: '' });
    setLinkModalOpen(false);
    notifications.show({
      title: 'Lien ajouté',
      message: `${link.name} a été ajouté à l'onglet`,
      color: 'green',
    });
  };

  // Update link
  const handleUpdateLink = () => {
    if (!editingLink || !newLink.name || !newLink.url) return;

    const updatedLinks = (tabContent.links || []).map(l =>
      l.id === editingLink.id
        ? {
            ...l,
            name: newLink.name!,
            url: newLink.url!.startsWith('http') ? newLink.url! : `https://${newLink.url}`,
            icon: newLink.icon,
            description: newLink.description,
          }
        : l
    );

    const newContent: TabContent = {
      ...tabContent,
      links: updatedLinks,
    };

    updateContentMutation.mutate(newContent);
    setEditingLink(null);
    setNewLink({ name: '', url: '' });
    notifications.show({
      title: 'Lien modifié',
      message: 'Le lien a été mis à jour',
      color: 'green',
    });
  };

  // Delete link
  const handleDeleteLink = (linkId: string) => {
    const newContent: TabContent = {
      ...tabContent,
      links: (tabContent.links || []).filter(l => l.id !== linkId),
    };

    updateContentMutation.mutate(newContent);
    notifications.show({
      title: 'Lien supprimé',
      message: 'Le lien a été supprimé',
      color: 'green',
    });
  };

  // Create a new widget in this tab (copy from template, creates real widget in DB)
  const handleCopyWidget = async (sourceWidget: Widget) => {
    try {
      // Create real widget in database (copy of source)
      const dbWidget = await widgetsApi.create({
        widget_type: sourceWidget.widget_type,
        title: sourceWidget.title || undefined,
        position: 999,  // High position so it doesn't show on main dashboard
        size: sourceWidget.size,
        col_span: sourceWidget.col_span,
        row_span: sourceWidget.row_span,
        config: { ...sourceWidget.config },
        is_visible: false,  // Hidden from main dashboard
        is_public: false,
      });

      const newWidget: TabWidget = {
        id: `tw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        widget_type: sourceWidget.widget_type,
        title: sourceWidget.title,
        position: tabWidgets.length,
        size: sourceWidget.size,
        col_span: sourceWidget.col_span,
        row_span: sourceWidget.row_span,
        config: { ...sourceWidget.config },  // Deep copy de la config
        is_visible: true,
        is_public: false,
        source_widget_id: sourceWidget.id,
        db_widget_id: dbWidget.id,  // Store real DB widget ID
      };

      const newContent: TabContent = {
        ...tabContent,
        widgets: [...tabWidgets, newWidget],
      };

      updateContentMutation.mutate(newContent);
      setWidgetModalOpen(false);
      notifications.show({
        title: 'Widget ajouté',
        message: `Une copie de "${sourceWidget.title || sourceWidget.widget_type}" a été créée`,
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to copy widget:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de copier le widget',
        color: 'red',
      });
    }
  };

  // Create a new empty widget (creates real widget in DB)
  const handleCreateWidget = async (widgetType: string) => {
    try {
      // Create real widget in database first
      const dbWidget = await widgetsApi.create({
        widget_type: widgetType,
        title: undefined,
        position: 999,  // High position so it doesn't show on main dashboard
        size: 'medium',
        col_span: 1,
        row_span: 1,
        config: {},
        is_visible: false,  // Hidden from main dashboard
        is_public: false,
      });

      const newWidget: TabWidget = {
        id: `tw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        widget_type: widgetType,
        title: null,
        position: tabWidgets.length,
        size: 'medium',
        col_span: 1,
        row_span: 1,
        config: {},
        is_visible: true,
        is_public: false,
        db_widget_id: dbWidget.id,  // Store real DB widget ID
      };

      const newContent: TabContent = {
        ...tabContent,
        widgets: [...tabWidgets, newWidget],
      };

      updateContentMutation.mutate(newContent);
      setWidgetModalOpen(false);
      notifications.show({
        title: 'Widget créé',
        message: 'Le widget a été ajouté à l\'onglet. Configurez-le via le menu.',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to create widget:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de créer le widget',
        color: 'red',
      });
    }
  };

  // Remove widget from tab (also deletes from DB if it has db_widget_id)
  const handleRemoveWidget = async (widgetId: string) => {
    const widgetToRemove = tabWidgets.find(w => w.id === widgetId);

    // Delete from DB if it has a real DB widget ID
    if (widgetToRemove?.db_widget_id) {
      try {
        await widgetsApi.delete(widgetToRemove.db_widget_id);
      } catch (error) {
        console.error('Failed to delete widget from DB:', error);
        // Continue anyway - we still want to remove from tab
      }
    }

    const newContent: TabContent = {
      ...tabContent,
      widgets: tabWidgets.filter(w => w.id !== widgetId),
    };

    updateContentMutation.mutate(newContent);
    notifications.show({
      title: 'Widget supprimé',
      message: 'Le widget a été supprimé de l\'onglet',
      color: 'green',
    });
  };

  // Update widget config (also updates DB if it has db_widget_id)
  const handleUpdateWidget = async (widgetId: string, updates: Partial<TabWidget>) => {
    const widgetToUpdate = tabWidgets.find(w => w.id === widgetId);

    // Update in DB if it has a real DB widget ID
    if (widgetToUpdate?.db_widget_id) {
      try {
        await widgetsApi.update(widgetToUpdate.db_widget_id, {
          title: updates.title ?? widgetToUpdate.title ?? undefined,
          size: updates.size ?? widgetToUpdate.size,
          col_span: updates.col_span ?? widgetToUpdate.col_span,
          row_span: updates.row_span ?? widgetToUpdate.row_span,
          config: updates.config ?? widgetToUpdate.config,
          is_visible: false,  // Keep hidden from main dashboard
        });
      } catch (error) {
        console.error('Failed to update widget in DB:', error);
        notifications.show({
          title: 'Erreur',
          message: 'Impossible de mettre à jour le widget',
          color: 'red',
        });
        return;
      }
    }

    const newContent: TabContent = {
      ...tabContent,
      widgets: tabWidgets.map(w =>
        w.id === widgetId ? { ...w, ...updates } : w
      ),
    };

    updateContentMutation.mutate(newContent);
  };

  // Drag & drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = tabWidgets.findIndex(w => w.id === active.id);
      const newIndex = tabWidgets.findIndex(w => w.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedWidgets = arrayMove(tabWidgets, oldIndex, newIndex);

        // Update positions based on new order
        const updatedWidgets = reorderedWidgets.map((w, index) => ({
          ...w,
          position: index,
        }));

        const newContent: TabContent = {
          ...tabContent,
          widgets: updatedWidgets,
        };

        updateContentMutation.mutate(newContent);
        notifications.show({
          title: 'Widgets réorganisés',
          message: 'L\'ordre des widgets a été mis à jour',
          color: 'green',
        });
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Get active widget for drag overlay
  const activeWidget = activeId ? tabWidgets.find(w => w.id === activeId) : null;

  const openEditLink = (link: TabLink) => {
    setEditingLink(link);
    setNewLink({
      name: link.name,
      url: link.url,
      icon: link.icon,
      description: link.description,
    });
  };

  const links = tabContent.links || [];
  const hasContent = links.length > 0 || tabWidgets.length > 0;

  // Get all link URLs for status checking
  const linkUrls = useMemo(() => {
    return links.map(link => link.url);
  }, [links]);

  // URL status checking
  const { statuses: urlStatuses } = useUrlStatus({
    urls: linkUrls,
    refreshInterval: 60000, // Check every minute
    timeout: 5,
    enabled: linkUrls.length > 0,
  });

  return (
    <Box>
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>{tab.name}</Title>
          <Text c="dimmed" size="sm">
            {links.length} lien{links.length > 1 ? 's' : ''} - {tabWidgets.length} widget{tabWidgets.length > 1 ? 's' : ''}
          </Text>
        </div>

        {isAdmin && (
          <Group>
            <Button
              variant="light"
              leftSection={<IconLink size={18} />}
              onClick={() => setLinkModalOpen(true)}
            >
              Ajouter un lien
            </Button>
            <Button
              variant="light"
              leftSection={<IconLayoutDashboard size={18} />}
              onClick={() => setWidgetModalOpen(true)}
            >
              Ajouter un widget
            </Button>
          </Group>
        )}
      </Group>

      {/* Widgets Section */}
      {tabWidgets.length > 0 && (
        <Box mb="xl">
          <Group justify="space-between" mb="sm">
            <Text fw={500} size="sm" c="dimmed">WIDGETS</Text>
            {isAdmin && tabWidgets.length > 1 && (
              <Text size="xs" c="dimmed">
                <IconGripVertical size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Glissez pour réorganiser
              </Text>
            )}
          </Group>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={tabWidgets.map(w => w.id)}
              strategy={rectSortingStrategy}
            >
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '16px',
                  gridAutoRows: '180px',
                }}
              >
                {tabWidgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    isAdmin={isAdmin}
                    onEdit={isAdmin ? () => setEditingWidget(widget) : undefined}
                    onRemove={isAdmin ? () => handleRemoveWidget(widget.id) : undefined}
                  />
                ))}
              </Box>
            </SortableContext>

            {/* Drag overlay for smooth dragging visual */}
            <DragOverlay>
              {activeWidget ? (
                <Box
                  style={{
                    gridColumn: `span ${activeWidget.col_span || 1}`,
                    gridRow: `span ${activeWidget.row_span || 1}`,
                    width: `${(activeWidget.col_span || 1) * 200}px`,
                    height: `${(activeWidget.row_span || 1) * 180}px`,
                    opacity: 0.9,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                  }}
                >
                  <WidgetCard
                    widget={{
                      ...activeWidget,
                      id: activeWidget.db_widget_id || 0,
                      column: 0,
                    } as Widget}
                    isAdmin={false}
                    isTabWidget={!activeWidget.db_widget_id}
                  />
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
        </Box>
      )}

      {/* Links Section */}
      {links.length > 0 && (
        <Box mb="xl">
          <Text fw={500} size="sm" c="dimmed" mb="sm">LIENS</Text>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
            {links.map((link) => (
              <Card
                key={link.id}
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 hover:border-blue-400 relative group"
                onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                style={{ height: '140px' }}
              >
                {/* URL Status Indicator */}
                <StatusIndicator
                  status={urlStatuses[link.url]}
                  size="sm"
                  position="top-left"
                />

                {isAdmin && (
                  <Group
                    gap={4}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <Menu shadow="md" width={150}>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconDotsVertical size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconEdit size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditLink(link);
                          }}
                        >
                          Modifier
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLink(link.id);
                          }}
                        >
                          Supprimer
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                )}

                <div className="flex flex-col items-center justify-center h-full gap-3">
                  {link.icon ? (
                    <Image
                      src={link.icon}
                      alt={link.name}
                      w={48}
                      h={48}
                      fit="contain"
                      fallbackSrc="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/default.svg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <IconExternalLink size={24} className="text-blue-500" />
                    </div>
                  )}

                  <Text fw={500} size="sm" ta="center" lineClamp={2}>
                    {link.name}
                  </Text>
                </div>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      )}

      {/* Empty state */}
      {!hasContent && (
        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconLayoutDashboard size={48} className="text-gray-400" />
            <Text size="lg" fw={500}>
              Cet onglet est vide
            </Text>
            <Text c="dimmed" ta="center">
              {isAdmin
                ? 'Ajoutez des liens ou des widgets pour personnaliser cet onglet.'
                : 'Aucun contenu n\'a été ajouté à cet onglet.'}
            </Text>
            {isAdmin && (
              <Group>
                <Button
                  variant="light"
                  leftSection={<IconLink size={18} />}
                  onClick={() => setLinkModalOpen(true)}
                >
                  Ajouter un lien
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconLayoutDashboard size={18} />}
                  onClick={() => setWidgetModalOpen(true)}
                >
                  Ajouter un widget
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      )}

      {/* Add/Edit Link Modal */}
      <Modal
        opened={linkModalOpen || !!editingLink}
        onClose={() => {
          setLinkModalOpen(false);
          setEditingLink(null);
          setNewLink({ name: '', url: '' });
        }}
        title={editingLink ? 'Modifier le lien' : 'Ajouter un lien'}
      >
        <Stack>
          <TextInput
            label="Nom"
            placeholder="Mon site"
            value={newLink.name || ''}
            onChange={(e) => setNewLink({ ...newLink, name: e.target.value })}
            required
          />
          <TextInput
            label="URL"
            placeholder="https://example.com"
            value={newLink.url || ''}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            required
          />
          <TextInput
            label="Icône (URL)"
            placeholder="https://example.com/icon.png"
            value={newLink.icon || ''}
            onChange={(e) => setNewLink({ ...newLink, icon: e.target.value })}
          />
          <TextInput
            label="Description"
            placeholder="Description optionnelle"
            value={newLink.description || ''}
            onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setLinkModalOpen(false);
                setEditingLink(null);
                setNewLink({ name: '', url: '' });
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={editingLink ? handleUpdateLink : handleAddLink}
              loading={updateContentMutation.isPending}
              disabled={!newLink.name || !newLink.url}
            >
              {editingLink ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add Widget Modal */}
      <Modal
        opened={widgetModalOpen}
        onClose={() => setWidgetModalOpen(false)}
        title="Ajouter un widget"
        size="lg"
      >
        <Stack>
          {/* Section: Créer un nouveau widget */}
          <div>
            <Text fw={500} size="sm" mb="xs">Créer un nouveau widget</Text>
            <SimpleGrid cols={3} spacing="sm">
              {widgetTypes.map((type) => (
                <Card
                  key={type.value}
                  shadow="sm"
                  padding="sm"
                  radius="md"
                  withBorder
                  className="cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => handleCreateWidget(type.value)}
                >
                  <Group gap="xs">
                    <IconPlus size={16} className="text-blue-500" />
                    <Text size="sm">{type.label}</Text>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          </div>

          {/* Section: Copier un widget existant */}
          {allWidgets.length > 0 && (
            <>
              <Divider label="ou copier un widget existant" labelPosition="center" my="md" />
              <SimpleGrid cols={2} spacing="md">
                {allWidgets.map((widget) => (
                  <Card
                    key={widget.id}
                    shadow="sm"
                    padding="md"
                    radius="md"
                    withBorder
                    className="cursor-pointer hover:border-green-400 transition-colors"
                    onClick={() => handleCopyWidget(widget)}
                  >
                    <Group>
                      <IconCopy size={20} className="text-green-500" />
                      <div>
                        <Text fw={500}>{widget.title || widget.widget_type}</Text>
                        <Badge size="xs" variant="light" color="green">
                          Copier: {widget.widget_type}
                        </Badge>
                      </div>
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setWidgetModalOpen(false)}>
              Fermer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Widget Config Modal */}
      <TabWidgetConfigModal
        widget={editingWidget}
        opened={!!editingWidget}
        onClose={() => setEditingWidget(null)}
        onSave={(widgetId, updates) => {
          handleUpdateWidget(widgetId, updates);
          setEditingWidget(null);
          notifications.show({
            title: 'Widget mis à jour',
            message: 'La configuration a été enregistrée',
            color: 'green',
          });
        }}
      />
    </Box>
  );
}
