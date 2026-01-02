'use client';

import { useState } from 'react';
import {
  Modal,
  Text,
  Stack,
  Group,
  Badge,
  Button,
  Box,
  Divider,
  Loader,
  Center,
  Paper,
  ActionIcon,
  Checkbox,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconPlus,
  IconCalendarEvent,
  IconChecklist,
  IconFlag,
  IconClock,
} from '@tabler/icons-react';
import { vikunjaApi } from '@/lib/api';
import { TaskModal } from './TaskModal';
import { TaskDetailDrawer } from './TaskDetailDrawer';

interface CalendarEvent {
  summary: string;
  start: string;
  end: string | null;
  all_day: boolean;
}

interface Task {
  id: number;
  title: string;
  description: string;
  done: boolean;
  priority: number;
  due_date: string;
  project_id: number;
  labels: { id: number; title: string; hex_color: string }[];
}

interface DayEventsModalProps {
  date: Date | null;
  opened: boolean;
  onClose: () => void;
  events?: CalendarEvent[];
  onRefresh?: () => void;
}

const priorityColors: Record<number, string> = {
  0: 'gray',
  1: 'blue',
  2: 'yellow',
  3: 'orange',
  4: 'red',
  5: 'red',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeader(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return date.toLocaleDateString('fr-FR', options);
}

export function DayEventsModal({
  date,
  opened,
  onClose,
  events = [],
  onRefresh,
}: DayEventsModalProps) {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const dateStr = date?.toISOString().split('T')[0] || '';

  // Fetch tasks for this date
  const { data: tasksData, isLoading, refetch } = useQuery<{ tasks: Task[]; count: number }>({
    queryKey: ['vikunja-tasks-date', dateStr],
    queryFn: () => vikunjaApi.getTasksByDate(dateStr),
    enabled: opened && !!dateStr,
  });

  const tasks = tasksData?.tasks || [];

  // Toggle done mutation
  const toggleDoneMutation = useMutation({
    mutationFn: (taskId: number) => vikunjaApi.toggleDone(taskId),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      onRefresh?.();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de modifier',
        color: 'red',
      });
    },
  });

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setDetailDrawerOpen(true);
  };

  const handleCreateSuccess = () => {
    refetch();
    onRefresh?.();
  };

  const handleDetailUpdate = () => {
    refetch();
    onRefresh?.();
  };

  // Filter events for this specific date
  const dayEvents = events.filter((event) => {
    const eventDate = new Date(event.start);
    return date && eventDate.toDateString() === date.toDateString();
  });

  const isToday = date && new Date().toDateString() === date.toDateString();

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm">
            <IconCalendarEvent size={20} />
            <div>
              <Text fw={600}>{date ? formatDateHeader(date) : ''}</Text>
              {isToday && (
                <Badge size="sm" color="blue" variant="light">
                  Aujourd'hui
                </Badge>
              )}
            </div>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          {/* Add task button */}
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Ajouter une tâche
          </Button>

          {/* Tasks section */}
          <Box>
            <Group gap="xs" mb="sm">
              <IconChecklist size={18} className="text-blue-500" />
              <Text fw={600} size="sm">
                Tâches ({tasks.length})
              </Text>
            </Group>

            {isLoading ? (
              <Center py="md">
                <Loader size="sm" />
              </Center>
            ) : tasks.length > 0 ? (
              <Stack gap="xs">
                {tasks.map((task) => (
                  <Paper
                    key={task.id}
                    withBorder
                    p="xs"
                    radius="sm"
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      task.done ? 'opacity-60' : ''
                    }`}
                  >
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <Tooltip label={task.done ? 'Rouvrir' : 'Terminer'}>
                        <Checkbox
                          size="sm"
                          checked={task.done}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleDoneMutation.mutate(task.id);
                          }}
                          mt={2}
                        />
                      </Tooltip>
                      <Box
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => handleTaskClick(task.id)}
                      >
                        <Text
                          size="sm"
                          fw={500}
                          td={task.done ? 'line-through' : undefined}
                          lineClamp={1}
                        >
                          {task.title}
                        </Text>

                        <Group gap={4} mt={4}>
                          {task.priority > 0 && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={priorityColors[task.priority]}
                              leftSection={<IconFlag size={10} />}
                            >
                              P{task.priority}
                            </Badge>
                          )}

                          {task.due_date && (
                            <Badge
                              size="xs"
                              variant="light"
                              color="gray"
                              leftSection={<IconClock size={10} />}
                            >
                              {formatTime(task.due_date)}
                            </Badge>
                          )}

                          {task.labels?.slice(0, 2).map((label) => (
                            <Badge
                              key={label.id}
                              size="xs"
                              variant="filled"
                              style={{ backgroundColor: label.hex_color }}
                            >
                              {label.title}
                            </Badge>
                          ))}
                        </Group>
                      </Box>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">
                Aucune tâche pour cette date
              </Text>
            )}
          </Box>

          {/* Calendar events section */}
          {dayEvents.length > 0 && (
            <>
              <Divider />
              <Box>
                <Group gap="xs" mb="sm">
                  <IconCalendarEvent size={18} className="text-green-500" />
                  <Text fw={600} size="sm">
                    Événements calendrier ({dayEvents.length})
                  </Text>
                </Group>

                <Stack gap="xs">
                  {dayEvents.map((event, index) => (
                    <Paper key={index} withBorder p="xs" radius="sm">
                      <Group gap="xs" wrap="nowrap">
                        <Box
                          style={{
                            width: 4,
                            height: 32,
                            borderRadius: 2,
                            backgroundColor: 'var(--mantine-color-green-6)',
                          }}
                        />
                        <Box style={{ flex: 1 }}>
                          <Text size="sm" fw={500} lineClamp={1}>
                            {event.summary}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {event.all_day
                              ? 'Toute la journée'
                              : `${formatTime(event.start)}${event.end ? ` - ${formatTime(event.end)}` : ''}`}
                          </Text>
                        </Box>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {/* Empty state when no events and no tasks */}
          {!isLoading && tasks.length === 0 && dayEvents.length === 0 && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconCalendarEvent size={48} className="text-gray-300" />
                <Text c="dimmed">Rien de prévu pour cette journée</Text>
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setCreateModalOpen(true)}
                >
                  Ajouter une tâche
                </Button>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>

      {/* Create Task Modal */}
      <TaskModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultDate={date || undefined}
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
