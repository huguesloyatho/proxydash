'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Group,
  Text,
  Badge,
  ScrollArea,
  ActionIcon,
  TextInput,
  Textarea,
  ColorSwatch,
  Modal,
  Button,
  Loader,
  Center,
  Card,
  useMantineColorScheme,
  Menu,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconNote,
  IconPlus,
  IconSearch,
  IconPin,
  IconPinFilled,
  IconTrash,
  IconEdit,
  IconArchive,
  IconArchiveOff,
  IconDotsVertical,
  IconDeviceFloppy,
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
}

interface MobileNotesViewProps {
  notesWidgetId?: number;
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

export function MobileNotesView({ notesWidgetId }: MobileNotesViewProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState<string | null>('#fef3c7');

  const fetchNotes = useCallback(async () => {
    if (!notesWidgetId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await notesApi.getWidgetData(notesWidgetId);
      if (response.data?.notes) {
        setNotes(response.data.notes);
      }
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les notes',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [notesWidgetId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteColor('#fef3c7');
    openEditModal();
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteColor(note.color || '#fef3c7');
    openEditModal();
  };

  const handleSaveNote = async () => {
    if (!notesWidgetId) return;

    try {
      if (editingNote) {
        await notesApi.updateNote(Number(editingNote.id), {
          title: noteTitle,
          content: noteContent,
          color: noteColor,
        });
        notifications.show({
          title: 'Note mise à jour',
          message: 'La note a été modifiée',
          color: 'green',
        });
      } else {
        await notesApi.createNote(notesWidgetId, {
          title: noteTitle,
          content: noteContent,
          color: noteColor,
        });
        notifications.show({
          title: 'Note créée',
          message: 'La nouvelle note a été ajoutée',
          color: 'green',
        });
      }

      closeEditModal();
      fetchNotes();
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Impossible de sauvegarder la note',
        color: 'red',
      });
    }
  };

  const handleDeleteNote = async (noteId: number | string) => {
    try {
      await notesApi.deleteNote(Number(noteId));
      notifications.show({
        title: 'Note supprimée',
        message: 'La note a été supprimée',
        color: 'green',
      });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Impossible de supprimer la note',
        color: 'red',
      });
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      await notesApi.updateNote(Number(note.id), {
        is_pinned: !note.is_pinned,
      });
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n))
      );
    } catch {
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

  // Filter and sort notes
  const filteredNotes = notes
    .filter((note) => !note.is_archived)
    .filter(
      (note) =>
        !searchQuery ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!notesWidgetId) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconNote size={48} className="text-gray-400" />
          <Text c="dimmed" ta="center">
            Configurez un widget Notes pour voir vos notes
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box px="sm" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <IconNote size={22} className="text-amber-500" />
            <Text fw={600} size="lg">Mes Notes</Text>
          </Group>
          <Group gap="xs">
            <VoiceDictationButton
              onTranscript={(text) => {
                setNoteTitle('');
                setNoteContent(text);
                setNoteColor('#fef3c7');
                setEditingNote(null);
                openEditModal();
              }}
              size="sm"
            />
            <ActionIcon
              variant="filled"
              color="amber"
              size="md"
              onClick={handleCreateNote}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Search */}
        <TextInput
          placeholder="Rechercher dans les notes..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="sm"
        />
      </Box>

      {/* Stats */}
      <Group gap="xs" px="sm" py="xs">
        <Badge variant="light" color="amber">
          {filteredNotes.length} note{filteredNotes.length > 1 ? 's' : ''}
        </Badge>
        <Badge variant="light" color="blue">
          {filteredNotes.filter((n) => n.is_pinned).length} épinglée{filteredNotes.filter((n) => n.is_pinned).length > 1 ? 's' : ''}
        </Badge>
      </Group>

      {/* Notes List */}
      <ScrollArea style={{ flex: 1 }} px="sm" pb="80px">
        {filteredNotes.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconNote size={48} className="text-gray-400" />
              <Text c="dimmed" ta="center">
                {searchQuery ? 'Aucune note trouvée' : 'Aucune note'}
              </Text>
              <Button
                variant="light"
                color="amber"
                leftSection={<IconPlus size={16} />}
                onClick={handleCreateNote}
              >
                Créer une note
              </Button>
            </Stack>
          </Center>
        ) : (
          <Stack gap="sm">
            {filteredNotes.map((note) => (
              <Card
                key={note.id}
                p="sm"
                radius="md"
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
                  cursor: 'pointer',
                }}
                withBorder
                onClick={() => handleEditNote(note)}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap" mb={4}>
                      {note.is_pinned && (
                        <IconPinFilled size={14} className="text-amber-500" />
                      )}
                      <Text
                        fw={600}
                        lineClamp={1}
                        style={{ color: isDark ? 'var(--mantine-color-gray-1)' : undefined }}
                      >
                        {note.title || 'Sans titre'}
                      </Text>
                    </Group>

                    {note.content && (
                      <Text
                        size="sm"
                        c="dimmed"
                        lineClamp={3}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {note.content}
                      </Text>
                    )}

                    <Text size="xs" c="dimmed" mt="xs">
                      {formatDate(note.updated_at)}
                    </Text>
                  </Box>

                  <Menu shadow="md" width={150} position="bottom-end">
                    <Menu.Target>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                      <Menu.Item
                        leftSection={note.is_pinned ? <IconPin size={14} /> : <IconPinFilled size={14} />}
                        onClick={() => handleTogglePin(note)}
                      >
                        {note.is_pinned ? 'Désépingler' : 'Épingler'}
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleEditNote(note)}
                      >
                        Modifier
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        Supprimer
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </ScrollArea>

      {/* Edit/Create Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={editingNote ? 'Modifier la note' : 'Nouvelle note'}
        fullScreen
        transitionProps={{ transition: 'slide-up' }}
      >
        <Stack gap="md" h="calc(100vh - 120px)">
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

          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>Contenu</Text>
              <VoiceDictationButton
                onTranscript={(text) => setNoteContent((prev) => prev + (prev ? ' ' : '') + text)}
                size="xs"
                color="blue"
              />
            </Group>
            <Textarea
              placeholder="Écrivez votre note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              styles={{
                root: { flex: 1, display: 'flex', flexDirection: 'column' },
                wrapper: { flex: 1 },
                input: { height: '100%', minHeight: 200 },
              }}
            />
          </Box>

          <Box>
            <Text size="sm" fw={500} mb={4}>
              Couleur
            </Text>
            <Group gap={8}>
              {DEFAULT_COLORS.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size={32}
                  style={{
                    cursor: 'pointer',
                    border:
                      noteColor === color
                        ? '3px solid var(--mantine-color-blue-5)'
                        : '1px solid var(--mantine-color-gray-3)',
                  }}
                  onClick={() => setNoteColor(color)}
                />
              ))}
            </Group>
          </Box>

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
    </Box>
  );
}
