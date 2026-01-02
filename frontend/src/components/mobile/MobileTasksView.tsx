'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Group,
  Text,
  Badge,
  Checkbox,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Select,
  Loader,
  Center,
  SegmentedControl,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconChecklist,
  IconPlus,
  IconSearch,
  IconCalendarDue,
  IconFlag,
  IconUser,
  IconFilter,
} from '@tabler/icons-react';
import { widgetsApi, vikunjaApi } from '@/lib/api';
import { TaskModal, TaskDetailDrawer } from '@/components/tasks';
import { VoiceDictationButton } from '@/components/VoiceDictation';

interface Assignee {
  id: number;
  name: string;
  username: string;
}

interface Task {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  due_date: string | null;
  project_id: number;
  labels: string[];
  assignees?: Assignee[];
}

interface User {
  id: number;
  name: string;
  username: string;
}

const priorityColors: Record<number, string> = {
  0: 'gray',
  1: 'blue',
  2: 'yellow',
  3: 'orange',
  4: 'red',
  5: 'red',
};

interface MobileTasksViewProps {
  vikunjaWidgetId?: number;
}

export function MobileTasksView({ vikunjaWidgetId }: MobileTasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | undefined>();

  const fetchTasks = useCallback(async () => {
    if (!vikunjaWidgetId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await widgetsApi.getData(vikunjaWidgetId);
      if (response.data?.tasks) {
        setTasks(response.data.tasks);
      }
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les tâches',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [vikunjaWidgetId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userList = await vikunjaApi.getUsers();
        setUsers(userList || []);
      } catch {
        // Ignore
      }
    };
    fetchUsers();
  }, []);

  const handleToggleDone = async (taskId: number) => {
    setTogglingTaskId(taskId);
    try {
      await vikunjaApi.toggleDone(taskId);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
      );
      setTimeout(fetchTasks, 500);
    } catch (err: any) {
      notifications.show({
        title: 'Erreur',
        message: err.response?.data?.detail || 'Impossible de modifier la tâche',
        color: 'red',
      });
    } finally {
      setTogglingTaskId(null);
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return 'En retard';
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays <= 7) return `Dans ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getDueDateColor = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return 'red';
    if (diffDays === 0) return 'orange';
    if (diffDays <= 2) return 'yellow';
    return 'gray';
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Filter by completion
    if (task.done) return false;

    // Filter by user
    if (filterUserId && !task.assignees?.some((a) => String(a.id) === filterUserId)) {
      return false;
    }

    // Filter by search query
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Filter by date
    if (filter !== 'all' && task.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      const diffDays = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (filter === 'today' && diffDays !== 0) return false;
      if (filter === 'week' && (diffDays < 0 || diffDays > 7)) return false;
      if (filter === 'overdue' && diffDays >= 0) return false;
    } else if (filter === 'overdue' && !task.due_date) {
      return false;
    }

    return true;
  });

  // Sort by priority and due date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Priority first (higher priority = lower number in some systems, but 4-5 is urgent)
    if (b.priority !== a.priority) return b.priority - a.priority;
    // Then by due date
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!vikunjaWidgetId) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <IconChecklist size={48} className="text-gray-400" />
          <Text c="dimmed" ta="center">
            Configurez un widget Vikunja pour voir vos tâches
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
            <IconChecklist size={22} className="text-blue-500" />
            <Text fw={600} size="lg">Mes Tâches</Text>
          </Group>
          <Group gap="xs">
            <VoiceDictationButton
              onTranscript={(text) => setSearchQuery(text)}
              size="sm"
            />
            <ActionIcon
              variant="filled"
              color="blue"
              size="md"
              onClick={() => setCreateModalOpen(true)}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Search */}
        <TextInput
          placeholder="Rechercher..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="sm"
          mb="xs"
        />

        {/* Filters */}
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as typeof filter)}
          data={[
            { label: 'Tout', value: 'all' },
            { label: "Aujourd'hui", value: 'today' },
            { label: 'Semaine', value: 'week' },
            { label: 'Retard', value: 'overdue' },
          ]}
          size="xs"
          fullWidth
        />

        {users.length > 0 && (
          <Select
            size="xs"
            placeholder="Filtrer par utilisateur"
            leftSection={<IconUser size={14} />}
            data={[
              { value: '', label: 'Tous les utilisateurs' },
              ...users.map((u) => ({
                value: String(u.id),
                label: u.name || u.username,
              })),
            ]}
            value={filterUserId || ''}
            onChange={(value) => setFilterUserId(value || null)}
            clearable
            mt="xs"
          />
        )}
      </Box>

      {/* Stats */}
      <Group gap="xs" px="sm" py="xs">
        <Badge variant="light" color="blue">
          {sortedTasks.length} tâche{sortedTasks.length > 1 ? 's' : ''}
        </Badge>
        <Badge variant="light" color="orange">
          {sortedTasks.filter((t) => t.due_date && getDueDateColor(t.due_date) === 'orange').length} aujourd'hui
        </Badge>
        <Badge variant="light" color="red">
          {sortedTasks.filter((t) => t.due_date && getDueDateColor(t.due_date) === 'red').length} en retard
        </Badge>
      </Group>

      {/* Tasks List */}
      <ScrollArea style={{ flex: 1 }} px="sm" pb="80px">
        {sortedTasks.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconChecklist size={48} className="text-green-500" />
              <Text c="dimmed" ta="center">
                {filter === 'all'
                  ? 'Toutes les tâches sont terminées !'
                  : 'Aucune tâche pour ce filtre'}
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="sm">
            {sortedTasks.map((task) => (
              <Box
                key={task.id}
                p="sm"
                className="rounded-lg border cursor-pointer active:scale-98 transition-transform"
                style={{
                  backgroundColor: 'var(--mantine-color-body)',
                  borderColor: 'var(--mantine-color-default-border)',
                }}
                onClick={() => {
                  setSelectedTaskId(task.id);
                  setDetailDrawerOpen(true);
                }}
              >
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Checkbox
                    size="md"
                    checked={task.done}
                    onChange={() => {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleDone(task.id);
                    }}
                    disabled={togglingTaskId === task.id}
                    mt={2}
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={500} lineClamp={2}>
                      {task.title}
                    </Text>

                    <Group gap={6} mt="xs" wrap="wrap">
                      {task.priority > 0 && (
                        <Badge
                          size="sm"
                          variant="light"
                          color={priorityColors[task.priority]}
                          leftSection={<IconFlag size={12} />}
                        >
                          P{task.priority}
                        </Badge>
                      )}

                      {task.due_date && (
                        <Badge
                          size="sm"
                          variant="light"
                          color={getDueDateColor(task.due_date)}
                          leftSection={<IconCalendarDue size={12} />}
                        >
                          {formatDueDate(task.due_date)}
                        </Badge>
                      )}

                      {task.labels.slice(0, 2).map((label, i) => (
                        <Badge key={i} size="sm" variant="dot">
                          {label}
                        </Badge>
                      ))}

                      {task.assignees && task.assignees.length > 0 && (
                        <Badge
                          size="sm"
                          variant="outline"
                          leftSection={<IconUser size={12} />}
                        >
                          {task.assignees[0].name || task.assignees[0].username}
                        </Badge>
                      )}
                    </Group>
                  </Box>
                </Group>
              </Box>
            ))}
          </Stack>
        )}
      </ScrollArea>

      {/* Create Task Modal */}
      <TaskModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultProjectId={projectId}
        onSuccess={fetchTasks}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        opened={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedTaskId(null);
        }}
        onUpdate={fetchTasks}
      />
    </Box>
  );
}
