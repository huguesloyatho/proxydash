'use client';

import { useState, useEffect, useCallback } from 'react';
import { Text, Stack, Group, SimpleGrid, Box, ScrollArea, Badge, Loader, Center, Tooltip, Checkbox } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconCalendarEvent, IconChecklist, IconFlag } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { widgetsApi, vikunjaApi } from '@/lib/api';
import { DayEventsModal, TaskDetailDrawer } from '@/components/tasks';

interface CalendarEvent {
  summary: string;
  start: string;
  end: string | null;
  all_day: boolean;
}

interface VikunjaTask {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  due_date: string;
  project_id: number;
  labels: { id: number; title: string; hex_color: string }[];
}

interface CalendarWidgetData {
  events: CalendarEvent[];
  vikunjaTasksMap: Record<string, VikunjaTask[]>;
  upcomingTasks: VikunjaTask[];
  currentMonth: string;
  timezone: string;
}

interface CalendarWidgetProps {
  widgetId?: number;
  config?: {
    timezone?: string;
    first_day_monday?: boolean;
    show_events_list?: boolean;
    ical_urls?: string;
  };
  size?: 'small' | 'medium' | 'large';
  colSpan?: number;
  rowSpan?: number;
  onDataReady?: (data: CalendarWidgetData) => void;
}

const priorityColors: Record<number, string> = {
  0: 'gray',
  1: 'blue',
  2: 'yellow',
  3: 'orange',
  4: 'red',
  5: 'red',
};

export function CalendarWidget({ widgetId, config = {}, size = 'medium', colSpan = 1, rowSpan = 1, onDataReady }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [today] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [vikunjaTasksMap, setVikunjaTasksMap] = useState<Map<string, VikunjaTask[]>>(new Map());
  const [upcomingTasks, setUpcomingTasks] = useState<VikunjaTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayEventsModalOpen, setDayEventsModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<number | null>(null);

  const { timezone = 'Europe/Paris', first_day_monday = true, show_events_list = true, ical_urls = '' } = config;

  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);

  // Fetch events from iCal
  const fetchEvents = useCallback(async () => {
    if (!ical_urls || !hasValidWidgetId) return;

    try {
      setLoading(true);
      const response = await widgetsApi.getData(widgetId!);
      if (response.data?.events) {
        setEvents(response.data.events);
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, ical_urls, hasValidWidgetId]);

  // Fetch Vikunja tasks for the visible month
  const fetchVikunjaTasksForMonth = useCallback(async () => {
    try {
      // Get first and last day of current month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // Fetch tasks for each day that has a due date in this month
      const tasksMap = new Map<string, VikunjaTask[]>();

      // Fetch all tasks and filter by month (more efficient than fetching per day)
      const allDates: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        allDates.push(dateStr);
      }

      // Batch fetch - get tasks for a range around this month
      // We'll fetch the whole month at once by getting tasks for each week
      const promises = [];
      for (let day = 1; day <= daysInMonth; day += 7) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, daysInMonth)).padStart(2, '0')}`;
        promises.push(
          vikunjaApi.getTasksByDate(dateStr).catch(() => ({ tasks: [] }))
        );
      }

      // Also fetch for specific individual days to ensure coverage
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        try {
          const result = await vikunjaApi.getTasksByDate(dateStr);
          if (result.tasks && result.tasks.length > 0) {
            tasksMap.set(dateStr, result.tasks);
          }
        } catch {
          // Ignore - no tasks for this date or API error
        }
      }

      setVikunjaTasksMap(tasksMap);
    } catch {
      // Ignore errors - Vikunja might not be configured
    }
  }, [currentDate]);

  // Fetch upcoming tasks (for sidebar)
  const fetchUpcomingTasks = useCallback(async () => {
    try {
      setLoadingUpcoming(true);
      const result = await vikunjaApi.getUpcomingTasks(10);
      if (result.tasks) {
        setUpcomingTasks(result.tasks);
      }
    } catch {
      // Ignore - Vikunja might not be configured
    } finally {
      setLoadingUpcoming(false);
    }
  }, []);

  // Toggle task done
  const handleToggleTask = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingTaskId(taskId);
    try {
      await vikunjaApi.toggleDone(taskId);
      // Refresh upcoming tasks and month view
      fetchUpcomingTasks();
      fetchVikunjaTasksForMonth();
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier le statut',
        color: 'red',
      });
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setTaskDrawerOpen(true);
  };

  useEffect(() => {
    fetchEvents();
    fetchUpcomingTasks();
    const interval = setInterval(() => {
      fetchEvents();
      fetchUpcomingTasks();
    }, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetchEvents, fetchUpcomingTasks]);

  useEffect(() => {
    fetchVikunjaTasksForMonth();
  }, [fetchVikunjaTasksForMonth]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Notify parent about data for export
  useEffect(() => {
    if (onDataReady) {
      // Convert Map to Record for serialization
      const tasksRecord: Record<string, VikunjaTask[]> = {};
      vikunjaTasksMap.forEach((tasks, date) => {
        tasksRecord[date] = tasks;
      });

      onDataReady({
        events,
        vikunjaTasksMap: tasksRecord,
        upcomingTasks,
        currentMonth: currentDate.toISOString().slice(0, 7), // YYYY-MM format
        timezone,
      });
    }
  }, [events, vikunjaTasksMap, upcomingTasks, currentDate, timezone, onDataReady]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return first_day_monday ? (day === 0 ? 6 : day - 1) : day;
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const getDateString = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const hasEvent = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.some(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === dayDate.toDateString();
    });
  };

  const hasVikunjaTask = (day: number) => {
    const dateStr = getDateString(day);
    const tasks = vikunjaTasksMap.get(dateStr);
    return tasks && tasks.length > 0;
  };

  const getVikunjaTasksForDay = (day: number) => {
    const dateStr = getDateString(day);
    return vikunjaTasksMap.get(dateStr) || [];
  };

  const getEventsForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === dayDate.toDateString();
    });
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
    setDayEventsModalOpen(true);
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter(e => new Date(e.start) >= now)
      .slice(0, 5);
  };

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const formatEventTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleRefresh = () => {
    fetchEvents();
    fetchVikunjaTasksForMonth();
    fetchUpcomingTasks();
  };

  const formatTaskDueDate = (dateStr: string): { text: string; isToday: boolean; isOverdue: boolean } => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'En retard', isToday: false, isOverdue: true };
    if (diffDays === 0) return { text: "Aujourd'hui", isToday: true, isOverdue: false };
    if (diffDays === 1) return { text: 'Demain', isToday: false, isOverdue: false };
    return {
      text: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      isToday: false,
      isOverdue: false
    };
  };

  const monthName = currentDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  });

  const dayNames = first_day_monday
    ? ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    : ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const cellSize = rowSpan >= 2 ? 28 : size === 'large' ? 28 : size === 'medium' ? 24 : 20;
  const showEventsList = show_events_list && (colSpan >= 2 || rowSpan >= 2);
  const upcomingEvents = getUpcomingEvents();

  return (
    <>
      <Group gap="md" h="100%" align="flex-start" wrap="nowrap">
        <Stack gap="xs" style={{ flex: showEventsList ? '0 0 auto' : 1 }}>
          <Group justify="space-between" px="xs">
            <IconChevronLeft
              size={16}
              className="cursor-pointer hover:text-blue-500"
              onClick={prevMonth}
            />
            <Text fw={600} size="sm" tt="capitalize">
              {monthName}
            </Text>
            <IconChevronRight
              size={16}
              className="cursor-pointer hover:text-blue-500"
              onClick={nextMonth}
            />
          </Group>

          <SimpleGrid cols={7} spacing={2}>
            {dayNames.map((day, i) => (
              <Text key={i} size="xs" c="dimmed" ta="center" fw={500}>
                {day}
              </Text>
            ))}
            {days.map((day, index) => {
              const dayHasEvent = day && hasEvent(day);
              const dayHasTask = day && hasVikunjaTask(day);
              const dayEvents = day ? getEventsForDay(day) : [];
              const dayTasks = day ? getVikunjaTasksForDay(day) : [];
              const totalItems = dayEvents.length + dayTasks.length;

              return (
                <Tooltip
                  key={index}
                  label={
                    day && totalItems > 0
                      ? `${dayEvents.length} événement${dayEvents.length > 1 ? 's' : ''}, ${dayTasks.length} tâche${dayTasks.length > 1 ? 's' : ''}`
                      : 'Cliquez pour ajouter'
                  }
                  disabled={!day}
                  position="top"
                  withArrow
                >
                  <Box
                    style={{
                      width: cellSize,
                      height: cellSize,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: day && isToday(day) ? 'var(--mantine-color-blue-6)' : 'transparent',
                      color: day && isToday(day) ? 'white' : undefined,
                      position: 'relative',
                      cursor: day ? 'pointer' : 'default',
                      transition: 'background-color 0.15s ease',
                    }}
                    className={day && !isToday(day) ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                    onClick={() => day && handleDayClick(day)}
                  >
                    {day && (
                      <>
                        <Text size="xs" fw={isToday(day) ? 700 : 400}>
                          {day}
                        </Text>
                        {/* Event indicators */}
                        {(dayHasEvent || dayHasTask) && !isToday(day) && (
                          <Group
                            gap={2}
                            style={{
                              position: 'absolute',
                              bottom: 1,
                            }}
                          >
                            {dayHasEvent && (
                              <Box
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--mantine-color-green-5)',
                                }}
                              />
                            )}
                            {dayHasTask && (
                              <Box
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--mantine-color-blue-5)',
                                }}
                              />
                            )}
                          </Group>
                        )}
                      </>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </SimpleGrid>

          {/* Legend */}
          <Group gap="xs" justify="center" mt={4}>
            <Group gap={4}>
              <Box
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-green-5)',
                }}
              />
              <Text size="xs" c="dimmed">iCal</Text>
            </Group>
            <Group gap={4}>
              <Box
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-blue-5)',
                }}
              />
              <Text size="xs" c="dimmed">Vikunja</Text>
            </Group>
          </Group>
        </Stack>

        {showEventsList && (
          <Stack gap="xs" style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <Group gap="xs">
              <IconChecklist size={16} className="text-blue-500" />
              <Text size="sm" fw={600}>Tâches à venir</Text>
            </Group>

            {loadingUpcoming ? (
              <Center py="md">
                <Loader size="sm" />
              </Center>
            ) : upcomingTasks.length > 0 ? (
              <ScrollArea style={{ flex: 1, minHeight: 0 }} scrollbarSize={6} type="auto">
                <Stack gap={6}>
                  {upcomingTasks.map((task) => {
                    const dueInfo = formatTaskDueDate(task.due_date);
                    return (
                      <Box
                        key={task.id}
                        p="xs"
                        className="bg-gray-50 dark:bg-gray-800 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => handleTaskClick(task.id)}
                      >
                        <Group gap={4} wrap="nowrap" align="flex-start">
                          <Checkbox
                            size="xs"
                            checked={task.done}
                            disabled={togglingTaskId === task.id}
                            onChange={() => {}}
                            onClick={(e) => handleToggleTask(task.id, e)}
                            mt={2}
                          />
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={500} lineClamp={1}>
                              {task.title}
                            </Text>
                            <Group gap={4}>
                              <Badge
                                size="xs"
                                variant="light"
                                color={dueInfo.isOverdue ? 'red' : dueInfo.isToday ? 'orange' : 'blue'}
                              >
                                {dueInfo.text}
                              </Badge>
                              {task.priority > 0 && (
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={priorityColors[task.priority]}
                                  leftSection={<IconFlag size={8} />}
                                >
                                  P{task.priority}
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        </Group>
                      </Box>
                    );
                  })}
                </Stack>
              </ScrollArea>
            ) : (
              <Text size="xs" c="dimmed">
                Aucune tâche à venir
              </Text>
            )}
          </Stack>
        )}
      </Group>

      {/* Day Events Modal */}
      <DayEventsModal
        date={selectedDate}
        opened={dayEventsModalOpen}
        onClose={() => {
          setDayEventsModalOpen(false);
          setSelectedDate(null);
        }}
        events={selectedDate ? getEventsForDay(selectedDate.getDate()) : []}
        onRefresh={handleRefresh}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        opened={taskDrawerOpen}
        onClose={() => {
          setTaskDrawerOpen(false);
          setSelectedTaskId(null);
        }}
        onUpdate={handleRefresh}
      />
    </>
  );
}
