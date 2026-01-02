'use client';

import { useEffect, useState, useCallback } from 'react';
import { Text, Stack, Group, Loader, Center, Badge, Checkbox, ScrollArea, Box, Tooltip, ActionIcon, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChecklist, IconCalendarDue, IconFlag, IconPlus, IconUser } from '@tabler/icons-react';
import { widgetsApi, vikunjaApi } from '@/lib/api';
import { TaskModal, TaskDetailDrawer } from '@/components/tasks';
import { VikunjaWidgetSkeleton } from './WidgetSkeleton';

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

interface VikunjaData {
  tasks: Task[];
  total: number;
  completed_count: number;
  incomplete_count: number;
  show_completed: boolean;
}

interface VikunjaWidgetProps {
  widgetId?: number;  // Optional - if not provided, uses config directly
  config?: {
    api_url?: string;
    api_token?: string;
    project_id?: number;
    show_completed?: boolean;
    max_tasks?: number;
    filter?: 'all' | 'today' | 'week' | 'overdue';
  };
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  onDataReady?: (data: VikunjaData) => void;
}

const priorityColors: Record<number, string> = {
  0: 'gray',
  1: 'blue',
  2: 'yellow',
  3: 'orange',
  4: 'red',
  5: 'red',
};

interface User {
  id: number;
  name: string;
  username: string;
}

export function VikunjaWidget({ widgetId, config = {}, size = 'medium', rowSpan = 1, onDataReady }: VikunjaWidgetProps) {
  const [data, setData] = useState<VikunjaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);

  const fetchData = useCallback(async () => {
    try {
      if (!hasValidWidgetId) {
        setError('Widget ID manquant - veuillez reconfigurer le widget');
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await widgetsApi.getData(widgetId!);

      if (response.data?.error) {
        setError(response.data.error);
      } else {
        setData(response.data);
        setError(null);
        // Notify parent about data for export
        onDataReady?.(response.data);
      }
    } catch {
      setError('Impossible de charger les tâches');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, hasValidWidgetId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 1000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch users for filter
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userList = await vikunjaApi.getUsers();
        setUsers(userList || []);
      } catch {
        // Ignore - users might not be available
      }
    };
    fetchUsers();
  }, []);

  const handleToggleDone = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingTaskId(taskId);
    try {
      await vikunjaApi.toggleDone(taskId);
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t
          ),
        };
      });
      // Refresh to get accurate counts
      setTimeout(fetchData, 500);
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

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setDetailDrawerOpen(true);
  };

  const handleCreateSuccess = () => {
    fetchData();
  };

  const handleDetailUpdate = () => {
    fetchData();
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'En retard';
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays <= 7) return `Dans ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getDueDateColor = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'red';
    if (diffDays === 0) return 'orange';
    if (diffDays <= 2) return 'yellow';
    return 'gray';
  };

  if (loading && !data) {
    return <VikunjaWidgetSkeleton />;
  }

  if (error) {
    return (
      <Center h="100%">
        <Text size="sm" c="dimmed">{error}</Text>
      </Center>
    );
  }

  const allTasks = data?.tasks || [];

  // Filter tasks by selected user
  const tasks = filterUserId
    ? allTasks.filter((task) =>
        task.assignees?.some((a) => String(a.id) === filterUserId)
      )
    : allTasks;

  if (!data || (allTasks.length === 0 && !filterUserId)) {
    // Determine the message to show
    let message = "Aucune tâche";
    if (data && data.total > 0) {
      if (!data.show_completed && data.completed_count === data.total) {
        message = `Toutes les ${data.total} tâches sont terminées !`;
      } else if (data.incomplete_count === 0) {
        message = "Aucune tâche en cours";
      }
    }

    return (
      <Stack h="100%" justify="space-between">
        <Center style={{ flex: 1 }}>
          <Stack align="center" gap="xs">
            <IconChecklist size={32} className="text-green-500" />
            <Text size="sm" c="dimmed" ta="center">{message}</Text>
            {data && data.completed_count > 0 && !data.show_completed && (
              <Text size="xs" c="dimmed">
                ({data.completed_count} terminée{data.completed_count > 1 ? 's' : ''})
              </Text>
            )}
          </Stack>
        </Center>
        <Group justify="center">
          <Tooltip label="Nouvelle tâche">
            <ActionIcon
              variant="light"
              color="blue"
              size="lg"
              onClick={() => setCreateModalOpen(true)}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <TaskModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          defaultProjectId={config.project_id}
          onSuccess={handleCreateSuccess}
        />
      </Stack>
    );
  }

  return (
    <>
      <Stack gap="xs" h="100%" style={{ overflow: 'hidden' }}>
        {/* Header avec padding à droite pour éviter les boutons de paramètres du widget */}
        <Group justify="space-between" pr={80}>
          <Group gap="xs">
            <IconChecklist size={18} className="text-blue-500" />
            <Text fw={600} size="sm">Tâches</Text>
          </Group>
          <Group gap={4}>
            {users.length > 0 && (
              <Select
                size="xs"
                placeholder="Filtrer..."
                leftSection={<IconUser size={12} />}
                data={[
                  { value: '', label: 'Tous' },
                  ...users.map((u) => ({
                    value: String(u.id),
                    label: u.name || u.username,
                  })),
                ]}
                value={filterUserId || ''}
                onChange={(value) => setFilterUserId(value || null)}
                clearable
                w={120}
                styles={{
                  input: { minHeight: 24, height: 24 },
                }}
              />
            )}
            <Badge size="xs" variant="light">
              {tasks.filter(t => !t.done).length} en cours
            </Badge>
            <Tooltip label="Nouvelle tâche">
              <ActionIcon
                variant="subtle"
                color="blue"
                size="sm"
                onClick={() => setCreateModalOpen(true)}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <ScrollArea style={{ flex: 1 }} scrollbarSize={6}>
          <Stack gap={6}>
            {tasks.map((task) => (
              <Box
                key={task.id}
                p="xs"
                className={`rounded border cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${task.done ? 'bg-gray-50 dark:bg-gray-800 opacity-60' : 'bg-white dark:bg-gray-900'} border-gray-200 dark:border-gray-700`}
                onClick={() => handleTaskClick(task.id)}
              >
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <Tooltip label={task.done ? 'Rouvrir' : 'Terminer'}>
                    <Checkbox
                      size="xs"
                      checked={task.done}
                      onChange={() => {}}
                      onClick={(e) => handleToggleDone(task.id, e)}
                      mt={2}
                      disabled={togglingTaskId === task.id}
                      styles={{
                        input: { cursor: 'pointer' },
                      }}
                    />
                  </Tooltip>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      size="xs"
                      fw={500}
                      lineClamp={2}
                      td={task.done ? 'line-through' : undefined}
                    >
                      {task.title}
                    </Text>

                    <Group gap={4} mt={4}>
                      {task.priority > 0 && (
                        <Tooltip label={`Priorité ${task.priority}`}>
                          <Badge
                            size="xs"
                            variant="light"
                            color={priorityColors[task.priority]}
                            leftSection={<IconFlag size={10} />}
                          >
                            P{task.priority}
                          </Badge>
                        </Tooltip>
                      )}

                      {task.due_date && (
                        <Badge
                          size="xs"
                          variant="light"
                          color={getDueDateColor(task.due_date)}
                          leftSection={<IconCalendarDue size={10} />}
                        >
                          {formatDueDate(task.due_date)}
                        </Badge>
                      )}

                      {task.labels.slice(0, 2).map((label, i) => (
                        <Badge key={i} size="xs" variant="dot">
                          {label}
                        </Badge>
                      ))}
                    </Group>
                  </Box>
                </Group>
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>

      {/* Create Task Modal */}
      <TaskModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultProjectId={config.project_id}
        onSuccess={handleCreateSuccess}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        opened={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedTaskId(null);
        }}
        onUpdate={handleDetailUpdate}
      />
    </>
  );
}
