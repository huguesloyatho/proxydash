'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Text,
  Stack,
  Group,
  Loader,
  Center,
  Badge,
  ScrollArea,
  Box,
  Tooltip,
  ActionIcon,
  TextInput,
  Textarea,
  ColorSwatch,
  Menu,
  Modal,
  Button,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { NotesWidgetSkeleton } from './WidgetSkeleton';
import {
  IconNote,
  IconPlus,
  IconPin,
  IconPinFilled,
  IconTrash,
  IconEdit,
  IconArchive,
  IconArchiveOff,
  IconRefresh,
  IconDotsVertical,
  IconGripVertical,
  IconCloud,
  IconDeviceFloppy,
  IconMicrophone,
} from '@tabler/icons-react';
import { notesApi } from '@/lib/api';
import { VoiceDictationButton } from '@/components/VoiceDictation';

interface Note {
  id: number | string;
  title: string;
  content: string;
  color: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  // Nextcloud specific
  category?: string;
  favorite?: boolean;
  modified?: number;
}

interface NotesWidgetData {
  notes: Note[];
  source: 'local' | 'nextcloud';
  counts: {
    total: number;
    pinned: number;
    archived: number;
  };
}

interface NotesWidgetProps {
  widgetId?: number;
  config?: {
    source?: 'local' | 'nextcloud';
    nextcloud_url?: string;
    nextcloud_username?: string;
    nextcloud_password?: string;
    nextcloud_category?: string;
    default_color?: string;
    show_pinned_first?: boolean;
    show_archived?: boolean;
    compact_mode?: boolean;
    max_notes_display?: number;
    refresh_interval?: number;
  };
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  onDataReady?: (data: NotesWidgetData) => void;
}

const DEFAULT_COLORS = [
  '#fef3c7', // amber-100
  '#fce7f3', // pink-100
  '#dbeafe', // blue-100
  '#d1fae5', // emerald-100
  '#f3e8ff', // purple-100
  '#fed7aa', // orange-100
  '#e0e7ff', // indigo-100
  '#fecaca', // red-100
];

export function NotesWidget({
  widgetId,
  config = {},
  size = 'medium',
  rowSpan = 1,
  onDataReady,
}: NotesWidgetProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [data, setData] = useState<NotesWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState<string | null>(null);

  const {
    source = 'local',
    default_color = '#fef3c7',
    show_pinned_first = true,
    show_archived = false,
    compact_mode = false,
    max_notes_display = 10,
    refresh_interval = 60,
  } = config;

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);
  const isNextcloud = source === 'nextcloud';

  const fetchData = useCallback(
    async (showRefreshing = false) => {
      try {
        if (!hasValidWidgetId) {
          setError('Widget ID manquant - veuillez reconfigurer le widget');
          setLoading(false);
          return;
        }

        if (showRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await notesApi.getWidgetData(widgetId!);

        if (response.data) {
          setData(response.data);
          setError(null);
        }
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.detail || 'Impossible de charger les notes';
        setError(errorMsg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [widgetId, hasValidWidgetId]
  );

  // Notify parent when data changes (separate effect to avoid infinite loop)
  useEffect(() => {
    if (data) {
      onDataReady?.(data);
    }
  }, [data, onDataReady]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(
      () => fetchData(true),
      refresh_interval * 1000
    );
    return () => clearInterval(interval);
  }, [fetchData, refresh_interval]);

  const handleCreateNote = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteColor(default_color);
    openEditModal();
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteColor(note.color || default_color);
    openEditModal();
  };

  const handleSaveNote = async () => {
    if (!hasValidWidgetId) return;

    try {
      if (editingNote) {
        // Update
        if (isNextcloud) {
          await notesApi.updateNextcloudNote(widgetId!, String(editingNote.id), {
            title: noteTitle,
            content: noteContent,
            category: config.nextcloud_category,
          });
        } else {
          await notesApi.updateNote(Number(editingNote.id), {
            title: noteTitle,
            content: noteContent,
            color: noteColor,
          });
        }
        notifications.show({
          title: 'Note mise à jour',
          message: 'La note a été modifiée avec succès',
          color: 'green',
        });
      } else {
        // Create
        if (isNextcloud) {
          await notesApi.createNextcloudNote(widgetId!, {
            title: noteTitle,
            content: noteContent,
            category: config.nextcloud_category,
          });
        } else {
          await notesApi.createNote(widgetId!, {
            title: noteTitle,
            content: noteContent,
            color: noteColor,
          });
        }
        notifications.show({
          title: 'Note créée',
          message: 'La nouvelle note a été ajoutée',
          color: 'green',
        });
      }

      closeEditModal();
      fetchData(true);
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Impossible de sauvegarder la note',
        color: 'red',
      });
    }
  };

  const handleDeleteNote = async (noteId: number | string) => {
    if (!hasValidWidgetId) return;

    try {
      if (isNextcloud) {
        await notesApi.deleteNextcloudNote(widgetId!, String(noteId));
      } else {
        await notesApi.deleteNote(Number(noteId));
      }

      notifications.show({
        title: 'Note supprimée',
        message: 'La note a été supprimée',
        color: 'green',
      });

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notes: prev.notes.filter((n) => n.id !== noteId),
          counts: {
            ...prev.counts,
            total: prev.counts.total - 1,
          },
        };
      });
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Impossible de supprimer la note',
        color: 'red',
      });
    }
  };

  const handleTogglePin = async (note: Note) => {
    if (!hasValidWidgetId || isNextcloud) return;

    try {
      await notesApi.updateNote(Number(note.id), {
        is_pinned: !note.is_pinned,
      });

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const newNotes = prev.notes.map((n) =>
          n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n
        );
        return {
          ...prev,
          notes: newNotes,
          counts: {
            ...prev.counts,
            pinned: note.is_pinned
              ? prev.counts.pinned - 1
              : prev.counts.pinned + 1,
          },
        };
      });
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier le statut',
        color: 'red',
      });
    }
  };

  const handleToggleArchive = async (note: Note) => {
    if (!hasValidWidgetId || isNextcloud) return;

    try {
      await notesApi.updateNote(Number(note.id), {
        is_archived: !note.is_archived,
      });

      // Optimistic update or refresh
      fetchData(true);

      notifications.show({
        title: note.is_archived ? 'Note restaurée' : 'Note archivée',
        message: note.is_archived
          ? 'La note a été restaurée'
          : 'La note a été archivée',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier le statut',
        color: 'red',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `il y a ${diffMins}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Sort notes: pinned first (if enabled), then by position
  const sortedNotes = data?.notes
    ? [...data.notes]
        .filter((n) => show_archived || !n.is_archived)
        .sort((a, b) => {
          if (show_pinned_first) {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
          }
          return a.position - b.position;
        })
        .slice(0, max_notes_display)
    : [];

  if (loading && !data) {
    return <NotesWidgetSkeleton />;
  }

  if (error) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconNote size={32} className="text-gray-400" />
          <Text size="sm" c="dimmed" ta="center">
            {error}
          </Text>
        </Stack>
      </Center>
    );
  }

  const counts = data?.counts || { total: 0, pinned: 0, archived: 0 };

  return (
    <>
      <Stack gap="xs" h="100%" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <Group justify="space-between" pr={80}>
          <Group gap="xs">
            {isNextcloud ? (
              <IconCloud size={18} className="text-blue-500" />
            ) : (
              <IconNote size={18} className="text-amber-500" />
            )}
            <Text fw={600} size="sm">
              Notes {isNextcloud && '(Nextcloud)'}
            </Text>
          </Group>
          <Group gap={4}>
            <Badge size="xs" variant="light" color="amber">
              {counts.total} note{counts.total > 1 ? 's' : ''}
            </Badge>

            <Tooltip label="Nouvelle note">
              <ActionIcon
                variant="light"
                color="green"
                size="sm"
                onClick={handleCreateNote}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>

            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="sm">
                  <IconDotsVertical size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                >
                  Rafraîchir
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconPlus size={14} />}
                  onClick={handleCreateNote}
                >
                  Nouvelle note
                </Menu.Item>
                {!isNextcloud && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconArchive size={14} />}
                      disabled={counts.archived === 0}
                    >
                      Archives ({counts.archived})
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Notes list */}
        {sortedNotes.length === 0 ? (
          <Center style={{ flex: 1 }}>
            <Stack align="center" gap="xs">
              <IconNote size={32} className="text-gray-400" />
              <Text size="sm" c="dimmed" ta="center">
                Aucune note
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={handleCreateNote}
              >
                Créer une note
              </Button>
            </Stack>
          </Center>
        ) : (
          <ScrollArea style={{ flex: 1 }} scrollbarSize={6}>
            <Stack gap={compact_mode ? 4 : 8}>
              {sortedNotes.map((note) => (
                <Box
                  key={note.id}
                  p="xs"
                  className="rounded border cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isDark
                      ? note.color
                        ? `${note.color}20`
                        : 'var(--mantine-color-dark-6)'
                      : note.color || 'white',
                    borderColor: isDark
                      ? 'var(--mantine-color-dark-4)'
                      : note.color
                        ? `${note.color}80`
                        : 'var(--mantine-color-gray-3)',
                  }}
                  onClick={() => handleEditNote(note)}
                >
                  <Group gap="xs" wrap="nowrap" align="flex-start">
                    {/* Grip for reorder (local only) */}
                    {!isNextcloud && !compact_mode && (
                      <IconGripVertical
                        size={14}
                        className="text-gray-400 cursor-grab"
                      />
                    )}

                    {/* Content */}
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={4} wrap="nowrap">
                        {note.is_pinned && (
                          <IconPinFilled size={12} className="text-amber-500" />
                        )}
                        {note.is_archived && (
                          <IconArchive size={12} className="text-gray-400" />
                        )}
                        <Text
                          size="xs"
                          fw={600}
                          lineClamp={1}
                          style={{
                            color: isDark ? 'var(--mantine-color-gray-1)' : undefined,
                          }}
                        >
                          {note.title || 'Sans titre'}
                        </Text>
                      </Group>

                      {!compact_mode && note.content && (
                        <Text
                          size="xs"
                          c="dimmed"
                          lineClamp={2}
                          mt={4}
                          style={{ whiteSpace: 'pre-wrap' }}
                        >
                          {note.content}
                        </Text>
                      )}

                      <Text size="xs" c="dimmed" mt={4}>
                        {formatDate(note.updated_at)}
                      </Text>
                    </Box>

                    {/* Actions */}
                    <Group gap={2} onClick={(e) => e.stopPropagation()}>
                      {!isNextcloud && (
                        <Tooltip label={note.is_pinned ? 'Désépingler' : 'Épingler'}>
                          <ActionIcon
                            variant="subtle"
                            color="amber"
                            size="xs"
                            onClick={() => handleTogglePin(note)}
                          >
                            {note.is_pinned ? (
                              <IconPinFilled size={12} />
                            ) : (
                              <IconPin size={12} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      )}

                      <Tooltip label="Modifier">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          size="xs"
                          onClick={() => handleEditNote(note)}
                        >
                          <IconEdit size={12} />
                        </ActionIcon>
                      </Tooltip>

                      {!isNextcloud && (
                        <Tooltip
                          label={note.is_archived ? 'Restaurer' : 'Archiver'}
                        >
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="xs"
                            onClick={() => handleToggleArchive(note)}
                          >
                            {note.is_archived ? (
                              <IconArchiveOff size={12} />
                            ) : (
                              <IconArchive size={12} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      )}

                      <Tooltip label="Supprimer">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="xs"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Box>
              ))}
            </Stack>
          </ScrollArea>
        )}

        {/* Refresh indicator */}
        {refreshing && (
          <Center>
            <Loader size="xs" />
          </Center>
        )}
      </Stack>

      {/* Edit/Create Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={editingNote ? 'Modifier la note' : 'Nouvelle note'}
        size="md"
      >
        <Stack gap="md">
          <Group gap="xs" align="flex-end">
            <TextInput
              label="Titre"
              placeholder="Titre de la note"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <VoiceDictationButton
              onTranscript={(text) => setNoteTitle((prev) => prev + (prev ? ' ' : '') + text)}
              size="sm"
              color="blue"
            />
          </Group>

          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>Contenu</Text>
              <VoiceDictationButton
                onTranscript={(text) => setNoteContent((prev) => prev + (prev ? ' ' : '') + text)}
                size="xs"
                color="blue"
              />
            </Group>
            <Textarea
              placeholder="Contenu de la note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              minRows={4}
              maxRows={10}
              autosize
            />
          </Box>

          {!isNextcloud && (
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Couleur
              </Text>
              <Group gap={8}>
                {DEFAULT_COLORS.map((color) => (
                  <Tooltip key={color} label={color}>
                    <ColorSwatch
                      color={color}
                      size={24}
                      style={{
                        cursor: 'pointer',
                        border:
                          noteColor === color
                            ? '2px solid var(--mantine-color-blue-5)'
                            : '1px solid var(--mantine-color-gray-3)',
                      }}
                      onClick={() => setNoteColor(color)}
                    />
                  </Tooltip>
                ))}
              </Group>
            </Box>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={closeEditModal}>
              Annuler
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSaveNote}
            >
              {editingNote ? 'Mettre à jour' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
