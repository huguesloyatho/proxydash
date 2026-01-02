'use client';

import { useEffect } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Button,
  Group,
  Stack,
  LoadingOverlay,
  Badge,
  MultiSelect,
  Box,
  Text,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconFlag, IconCalendar, IconUser } from '@tabler/icons-react';
import { vikunjaApi } from '@/lib/api';
import { VoiceDictationButton } from '@/components/VoiceDictation';

interface Task {
  id: number;
  title: string;
  description: string;
  done: boolean;
  priority: number;
  due_date: string | null;
  project_id: number;
  labels: { id: number; title: string; hex_color: string }[];
  assignees?: { id: number; name: string; username: string }[];
}

interface Project {
  id: number;
  title: string;
}

interface Label {
  id: number;
  title: string;
  hex_color: string;
}

interface User {
  id: number;
  name: string;
  username: string;
}

interface TaskModalProps {
  opened: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultDate?: Date | null;
  defaultProjectId?: number;
  onSuccess?: () => void;
}

interface FormValues {
  title: string;
  description: string;
  project_id: string;
  priority: number;
  due_date: Date | string | null;
  labels: string[];
  assignees: string[];
}

const priorityOptions = [
  { value: '0', label: 'Aucune priorité' },
  { value: '1', label: 'Basse', color: 'blue' },
  { value: '2', label: 'Moyenne', color: 'yellow' },
  { value: '3', label: 'Haute', color: 'orange' },
  { value: '4', label: 'Urgente', color: 'red' },
  { value: '5', label: 'Critique', color: 'red' },
];

export function TaskModal({
  opened,
  onClose,
  task,
  defaultDate,
  defaultProjectId,
  onSuccess,
}: TaskModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!task;

  // Fetch projects
  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ['vikunja-projects'],
    queryFn: vikunjaApi.getProjects,
    enabled: opened,
  });

  // Fetch labels
  const { data: labels = [], isLoading: loadingLabels } = useQuery<Label[]>({
    queryKey: ['vikunja-labels'],
    queryFn: vikunjaApi.getLabels,
    enabled: opened,
  });

  // Fetch users
  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['vikunja-users'],
    queryFn: vikunjaApi.getUsers,
    enabled: opened,
  });

  const form = useForm<FormValues>({
    initialValues: {
      title: '',
      description: '',
      project_id: '',
      priority: 0,
      due_date: null,
      labels: [],
      assignees: [],
    },
    validate: {
      title: (value) => (!value.trim() ? 'Le titre est requis' : null),
      project_id: (value) => (!value ? 'Sélectionnez un projet' : null),
    },
  });

  // Populate form when editing or when defaults change
  useEffect(() => {
    if (task) {
      form.setValues({
        title: task.title,
        description: task.description || '',
        project_id: String(task.project_id),
        priority: task.priority,
        due_date: task.due_date ? new Date(task.due_date) : null,
        labels: task.labels.map((l) => String(l.id)),
        assignees: (task.assignees || []).map((a) => String(a.id)),
      });
    } else {
      form.reset();
      if (defaultDate) {
        form.setFieldValue('due_date', defaultDate);
      }
      if (defaultProjectId) {
        form.setFieldValue('project_id', String(defaultProjectId));
      }
    }
  }, [task, defaultDate, defaultProjectId, opened]);

  // Auto-select first project if none is selected (for calendar creation)
  useEffect(() => {
    if (!task && opened && projects.length > 0 && !form.values.project_id) {
      form.setFieldValue('project_id', String(projects[0].id));
    }
  }, [projects, opened, task]);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      // Handle due_date - can be Date, string, or null
      let dueDate: string | undefined;
      if (values.due_date) {
        if (values.due_date instanceof Date) {
          dueDate = values.due_date.toISOString();
        } else if (typeof values.due_date === 'string') {
          dueDate = new Date(values.due_date).toISOString();
        }
      }

      return vikunjaApi.createTask({
        title: values.title,
        description: values.description,
        project_id: Number(values.project_id),
        priority: values.priority,
        due_date: dueDate,
        labels: values.labels.map((l) => (typeof l === 'string' ? Number(l) : l)),
        assignees: values.assignees.map((a) => (typeof a === 'string' ? Number(a) : a)),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vikunja'] });
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      queryClient.invalidateQueries({ queryKey: ['vikunja-tasks-date'] });
      notifications.show({
        title: 'Tâche créée',
        message: 'La tâche a été créée avec succès',
        color: 'green',
      });
      onClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de créer la tâche',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Handle due_date - can be Date, string, or null
      let dueDate: string | null = null;
      if (values.due_date) {
        if (values.due_date instanceof Date) {
          dueDate = values.due_date.toISOString();
        } else if (typeof values.due_date === 'string') {
          dueDate = new Date(values.due_date).toISOString();
        }
      }

      const payload = {
        title: values.title,
        description: values.description,
        project_id: Number(values.project_id),
        priority: values.priority,
        due_date: dueDate,
        labels: values.labels.map((l) => (typeof l === 'string' ? Number(l) : l)),
        assignees: values.assignees.map((a) => (typeof a === 'string' ? Number(a) : a)),
      };
      console.log('Updating task', task!.id, 'with payload:', payload);
      const result = await vikunjaApi.updateTask(task!.id, payload);
      console.log('Update result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('Update success:', data);
      queryClient.invalidateQueries({ queryKey: ['vikunja'] });
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      queryClient.invalidateQueries({ queryKey: ['vikunja-tasks-date'] });
      notifications.show({
        title: 'Tâche modifiée',
        message: 'La tâche a été mise à jour',
        color: 'green',
      });
      onClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || error.message || 'Impossible de modifier la tâche',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? 'Modifier la tâche' : 'Nouvelle tâche'}
      size="lg"
    >
      <LoadingOverlay visible={loadingProjects || loadingLabels || loadingUsers} />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Group gap="xs" align="flex-end">
            <TextInput
              label="Titre"
              placeholder="Titre de la tâche"
              required
              style={{ flex: 1 }}
              {...form.getInputProps('title')}
            />
            <VoiceDictationButton
              onTranscript={(text) => form.setFieldValue('title', form.values.title + (form.values.title ? ' ' : '') + text)}
              size="sm"
              color="blue"
            />
          </Group>

          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>Description</Text>
              <VoiceDictationButton
                onTranscript={(text) => form.setFieldValue('description', form.values.description + (form.values.description ? ' ' : '') + text)}
                size="xs"
                color="blue"
              />
            </Group>
            <Textarea
              placeholder="Description (optionnel)"
              minRows={3}
              autosize
              maxRows={8}
              {...form.getInputProps('description')}
            />
          </Box>

          <Select
            label="Projet"
            placeholder="Sélectionnez un projet"
            required
            data={projects.map((p) => ({ value: String(p.id), label: p.title }))}
            searchable
            {...form.getInputProps('project_id')}
          />

          <Group grow>
            <Select
              label="Priorité"
              leftSection={<IconFlag size={16} />}
              data={priorityOptions}
              value={String(form.values.priority)}
              onChange={(value) => form.setFieldValue('priority', Number(value))}
              renderOption={({ option }) => {
                const opt = priorityOptions.find((p) => p.value === option.value);
                return (
                  <Group gap="xs">
                    {opt?.color && (
                      <Badge size="xs" color={opt.color}>
                        P{option.value}
                      </Badge>
                    )}
                    <span>{option.label}</span>
                  </Group>
                );
              }}
            />

            <DateTimePicker
              label="Échéance"
              placeholder="Date et heure"
              leftSection={<IconCalendar size={16} />}
              clearable
              valueFormat="DD/MM/YYYY HH:mm"
              {...form.getInputProps('due_date')}
            />
          </Group>

          <MultiSelect
            label="Labels"
            placeholder="Sélectionnez des labels"
            data={labels.map((l) => ({
              value: String(l.id),
              label: l.title,
            }))}
            searchable
            clearable
            {...form.getInputProps('labels')}
            renderOption={({ option }) => {
              const label = labels.find((l) => String(l.id) === option.value);
              return (
                <Group gap="xs">
                  <Badge
                    size="xs"
                    variant="filled"
                    style={{ backgroundColor: label?.hex_color || '#666' }}
                  >
                    {option.label}
                  </Badge>
                </Group>
              );
            }}
          />

          <MultiSelect
            label="Assignés"
            placeholder="Assigner à..."
            leftSection={<IconUser size={16} />}
            data={users.map((u) => ({
              value: String(u.id),
              label: u.name || u.username,
            }))}
            searchable
            clearable
            {...form.getInputProps('assignees')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={isLoading}>
              {isEditing ? 'Enregistrer' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
