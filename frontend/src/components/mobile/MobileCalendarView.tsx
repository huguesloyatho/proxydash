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
  Loader,
  Center,
  Card,
  SegmentedControl,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconCalendarEvent,
  IconClock,
} from '@tabler/icons-react';
import { widgetsApi, vikunjaApi } from '@/lib/api';

interface Task {
  id: number;
  title: string;
  done: boolean;
  priority: number;
  due_date: string | null;
  project_id: number;
  labels: string[];
}

interface MobileCalendarViewProps {
  vikunjaWidgetId?: number;
}

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export function MobileCalendarView({ vikunjaWidgetId }: MobileCalendarViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchTasks = useCallback(async () => {
    if (!vikunjaWidgetId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await widgetsApi.getData(vikunjaWidgetId);
      if (response.data?.tasks) {
        setTasks(response.data.tasks.filter((t: Task) => t.due_date && !t.done));
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

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get tasks for a specific date
  const getTasksForDate = (date: Date): Task[] => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date).toISOString().split('T')[0];
      return taskDate === dateStr;
    });
  };

  // Get dates for current view
  const getViewDates = (): Date[] => {
    const dates: Date[] = [];
    const startDate = new Date(currentDate);

    switch (view) {
      case 'day':
        dates.push(new Date(startDate));
        break;
      case 'week':
        // Start from Monday
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        for (let i = 0; i < 7; i++) {
          dates.push(new Date(startDate));
          startDate.setDate(startDate.getDate() + 1);
        }
        break;
      case 'month':
        const year = startDate.getFullYear();
        const month = startDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Start from the Monday before the first day of month
        const startOffset = firstDay.getDay() === 0 ? -6 : 1 - firstDay.getDay();
        firstDay.setDate(firstDay.getDate() + startOffset);

        // Include 6 weeks to cover all possible month layouts
        for (let i = 0; i < 42; i++) {
          dates.push(new Date(firstDay));
          firstDay.setDate(firstDay.getDate() + 1);
        }
        break;
    }

    return dates;
  };

  const formatDateHeader = (): string => {
    switch (view) {
      case 'day':
        return currentDate.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      case 'week':
        const weekDates = getViewDates();
        const first = weekDates[0];
        const last = weekDates[6];
        if (first.getMonth() === last.getMonth()) {
          return `${first.getDate()} - ${last.getDate()} ${MONTHS_FR[first.getMonth()]}`;
        }
        return `${first.getDate()} ${MONTHS_FR[first.getMonth()].slice(0, 3)} - ${last.getDate()} ${MONTHS_FR[last.getMonth()].slice(0, 3)}`;
      case 'month':
        return `${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth();
  };

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
          <IconCalendar size={48} className="text-gray-400" />
          <Text c="dimmed" ta="center">
            Configurez un widget Vikunja pour voir votre agenda
          </Text>
        </Stack>
      </Center>
    );
  }

  const viewDates = getViewDates();

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box px="sm" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <IconCalendar size={22} className="text-green-500" />
            <Text fw={600} size="lg">Agenda</Text>
          </Group>
          <Badge
            variant="light"
            color="blue"
            style={{ cursor: 'pointer' }}
            onClick={goToToday}
          >
            Aujourd'hui
          </Badge>
        </Group>

        {/* View selector */}
        <SegmentedControl
          value={view}
          onChange={(value) => setView(value as typeof view)}
          data={[
            { label: 'Jour', value: 'day' },
            { label: 'Semaine', value: 'week' },
            { label: 'Mois', value: 'month' },
          ]}
          size="xs"
          fullWidth
          mb="xs"
        />

        {/* Date navigation */}
        <Group justify="space-between">
          <ActionIcon variant="subtle" onClick={() => navigateDate('prev')}>
            <IconChevronLeft size={20} />
          </ActionIcon>
          <Text fw={500} size="sm" tt="capitalize">
            {formatDateHeader()}
          </Text>
          <ActionIcon variant="subtle" onClick={() => navigateDate('next')}>
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>
      </Box>

      {/* Calendar view */}
      <ScrollArea style={{ flex: 1 }} px="sm" pb="80px">
        {view === 'month' ? (
          /* Month view - calendar grid */
          <Box py="xs">
            {/* Day headers */}
            <Group gap={0} mb="xs">
              {DAYS_FR.slice(1).concat(DAYS_FR[0]).map((day) => (
                <Box
                  key={day}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                  }}
                >
                  <Text size="xs" c="dimmed" fw={500}>
                    {day}
                  </Text>
                </Box>
              ))}
            </Group>

            {/* Calendar grid */}
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 2,
              }}
            >
              {viewDates.map((date, index) => {
                const dateTasks = getTasksForDate(date);
                const today = isToday(date);
                const currentMonth = isCurrentMonth(date);

                return (
                  <Box
                    key={index}
                    p={4}
                    style={{
                      minHeight: 50,
                      borderRadius: 4,
                      backgroundColor: today
                        ? 'var(--mantine-color-blue-light)'
                        : 'transparent',
                      opacity: currentMonth ? 1 : 0.4,
                    }}
                  >
                    <Text
                      size="xs"
                      fw={today ? 700 : 400}
                      c={today ? 'blue' : undefined}
                      ta="center"
                    >
                      {date.getDate()}
                    </Text>
                    {dateTasks.length > 0 && (
                      <Badge
                        size="xs"
                        color={dateTasks.some((t) => t.priority >= 3) ? 'red' : 'blue'}
                        variant="filled"
                        fullWidth
                        mt={2}
                      >
                        {dateTasks.length}
                      </Badge>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : (
          /* Day/Week view - list of dates with tasks */
          <Stack gap="sm" py="xs">
            {viewDates.map((date, index) => {
              const dateTasks = getTasksForDate(date);
              const today = isToday(date);

              return (
                <Card
                  key={index}
                  p="sm"
                  radius="md"
                  withBorder
                  style={{
                    borderColor: today ? 'var(--mantine-color-blue-5)' : undefined,
                    backgroundColor: today ? 'var(--mantine-color-blue-light)' : undefined,
                  }}
                >
                  <Group justify="space-between" mb={dateTasks.length > 0 ? 'xs' : 0}>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {DAYS_FR[date.getDay()]}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {date.getDate()} {MONTHS_FR[date.getMonth()].slice(0, 3)}
                      </Text>
                      {today && (
                        <Badge size="xs" color="blue">
                          Aujourd'hui
                        </Badge>
                      )}
                    </Group>
                    {dateTasks.length > 0 && (
                      <Badge size="sm" variant="light">
                        {dateTasks.length} tâche{dateTasks.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </Group>

                  {dateTasks.length > 0 ? (
                    <Stack gap={6}>
                      {dateTasks.map((task) => (
                        <Group key={task.id} gap="xs" wrap="nowrap">
                          <IconCalendarEvent
                            size={14}
                            className={
                              task.priority >= 3 ? 'text-red-500' : 'text-blue-500'
                            }
                          />
                          <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
                            {task.title}
                          </Text>
                          {task.priority > 0 && (
                            <Badge
                              size="xs"
                              color={task.priority >= 3 ? 'red' : 'orange'}
                            >
                              P{task.priority}
                            </Badge>
                          )}
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed" ta="center">
                      Aucune tâche
                    </Text>
                  )}
                </Card>
              );
            })}
          </Stack>
        )}
      </ScrollArea>
    </Box>
  );
}
