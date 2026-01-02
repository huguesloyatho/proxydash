'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Drawer,
  Text,
  Stack,
  Group,
  Badge,
  Button,
  ActionIcon,
  Textarea,
  LoadingOverlay,
  Box,
  Divider,
  Tooltip,
  Progress,
  FileButton,
  Paper,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconFlag,
  IconCalendarDue,
  IconCheck,
  IconTrash,
  IconEdit,
  IconPaperclip,
  IconDownload,
  IconX,
  IconChecklist,
  IconLoader,
  IconUser,
} from '@tabler/icons-react';
import { vikunjaApi } from '@/lib/api';
import { TaskModal } from './TaskModal';
import { VoiceDictationButton } from '@/components/VoiceDictation';

interface Label {
  id: number;
  title: string;
  hex_color: string;
}

interface Assignee {
  id: number;
  name: string;
  username: string;
}

interface Attachment {
  id: number;
  file_name: string;
  file_size: number;
  created: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  done: boolean;
  priority: number;
  due_date: string | null;
  project_id: number;
  labels: Label[];
  assignees: Assignee[];
  attachments: Attachment[];
  created: string;
  updated: string;
  percent_done: number;
}

interface TaskDetailDrawerProps {
  taskId: number | null;
  opened: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const priorityColors: Record<number, string> = {
  0: 'gray',
  1: 'blue',
  2: 'yellow',
  3: 'orange',
  4: 'red',
  5: 'red',
};

const priorityLabels: Record<number, string> = {
  0: 'Aucune',
  1: 'Basse',
  2: 'Moyenne',
  3: 'Haute',
  4: 'Urgente',
  5: 'Critique',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDueDate(dateStr: string): { text: string; color: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `En retard (${formatDate(dateStr)})`, color: 'red' };
  if (diffDays === 0) return { text: `Aujourd'hui`, color: 'orange' };
  if (diffDays === 1) return { text: 'Demain', color: 'yellow' };
  if (diffDays <= 7) return { text: `Dans ${diffDays} jours`, color: 'blue' };
  return { text: formatDate(dateStr), color: 'gray' };
}

export function TaskDetailDrawer({ taskId, opened, onClose, onUpdate }: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [descriptionDirty, setDescriptionDirty] = useState(false);

  // Fetch task details
  const {
    data: task,
    isLoading,
    refetch,
  } = useQuery<Task>({
    queryKey: ['vikunja-task', taskId],
    queryFn: () => vikunjaApi.getTask(taskId!),
    enabled: opened && taskId !== null,
  });

  // Sync description with task data when task changes
  useEffect(() => {
    if (task?.description !== undefined) {
      setDescription(task.description);
      setDescriptionDirty(false);
    }
  }, [task?.description]);

  // Toggle done mutation
  const toggleDoneMutation = useMutation({
    mutationFn: () => vikunjaApi.toggleDone(taskId!),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      queryClient.invalidateQueries({ queryKey: ['vikunja-tasks-date'] });
      onUpdate?.();
      notifications.show({
        title: task?.done ? 'Tâche rouverte' : 'Tâche terminée',
        message: '',
        color: 'green',
        autoClose: 2000,
      });
    },
    onError: (error: any) => {
      console.error('Toggle done error:', error);
      const message = error.response?.data?.detail
        || error.message
        || 'Impossible de modifier le statut';
      notifications.show({
        title: 'Erreur',
        message,
        color: 'red',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => vikunjaApi.deleteTask(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      notifications.show({
        title: 'Tâche supprimée',
        message: 'La tâche a été supprimée',
        color: 'green',
      });
      onClose();
      onUpdate?.();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de supprimer',
        color: 'red',
      });
    },
  });

  // Update description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: (newDescription: string) =>
      vikunjaApi.updateTask(taskId!, { description: newDescription }),
    onSuccess: () => {
      setDescriptionDirty(false);
      refetch();
      notifications.show({
        title: 'Description sauvegardée',
        message: '',
        color: 'green',
        autoClose: 2000,
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de sauvegarder',
        color: 'red',
      });
    },
  });

  // Upload attachment mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => vikunjaApi.addAttachment(taskId!, file),
    onSuccess: () => {
      refetch();
      notifications.show({
        title: 'Pièce jointe ajoutée',
        message: '',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur upload',
        message: error.response?.data?.detail || "Impossible d'ajouter la pièce jointe",
        color: 'red',
      });
    },
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: number) => vikunjaApi.deleteAttachment(taskId!, attachmentId),
    onSuccess: () => {
      refetch();
      notifications.show({
        title: 'Pièce jointe supprimée',
        message: '',
        color: 'green',
      });
    },
  });

  const handleDescriptionBlur = useCallback(() => {
    if (descriptionDirty && description !== task?.description) {
      updateDescriptionMutation.mutate(description);
    }
  }, [description, descriptionDirty, task?.description]);

  const handleFileSelect = (file: File | null) => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const { url, token } = await vikunjaApi.getAttachmentUrl(taskId!, attachment.id);
      // Open in new tab with token
      window.open(`${url}?token=${token}`, '_blank');
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de télécharger le fichier',
        color: 'red',
      });
    }
  };

  if (!taskId) return null;

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="lg"
        title={
          <Group gap="sm">
            <IconChecklist size={20} />
            <Text fw={600}>Détails de la tâche</Text>
          </Group>
        }
      >
        <LoadingOverlay visible={isLoading} />

        {task && (
          <Stack gap="md">
            {/* Header with title and status */}
            <Box>
              <Group justify="space-between" align="flex-start">
                <Box style={{ flex: 1 }}>
                  <Text
                    size="xl"
                    fw={700}
                    td={task.done ? 'line-through' : undefined}
                    c={task.done ? 'dimmed' : undefined}
                  >
                    {task.title}
                  </Text>
                </Box>
                <Badge
                  size="lg"
                  color={task.done ? 'green' : 'blue'}
                  variant="filled"
                >
                  {task.done ? 'Terminée' : 'En cours'}
                </Badge>
              </Group>

              {task.percent_done > 0 && task.percent_done < 1 && (
                <Progress
                  value={task.percent_done * 100}
                  size="sm"
                  mt="xs"
                  color="blue"
                />
              )}
            </Box>

            {/* Actions */}
            <Group gap="sm">
              <Button
                variant={task.done ? 'light' : 'filled'}
                color={task.done ? 'gray' : 'green'}
                leftSection={<IconCheck size={16} />}
                onClick={() => toggleDoneMutation.mutate()}
                loading={toggleDoneMutation.isPending}
              >
                {task.done ? 'Rouvrir' : 'Terminer'}
              </Button>
              <Button
                variant="light"
                leftSection={<IconEdit size={16} />}
                onClick={() => setEditModalOpen(true)}
              >
                Modifier
              </Button>
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => {
                  if (confirm('Supprimer cette tâche ?')) {
                    deleteMutation.mutate();
                  }
                }}
                loading={deleteMutation.isPending}
              >
                Supprimer
              </Button>
            </Group>

            <Divider />

            {/* Metadata */}
            <Group gap="lg">
              {task.priority > 0 && (
                <Group gap="xs">
                  <IconFlag size={16} color={priorityColors[task.priority]} />
                  <Badge color={priorityColors[task.priority]} variant="light">
                    Priorité {priorityLabels[task.priority]}
                  </Badge>
                </Group>
              )}

              {task.due_date && (
                <Group gap="xs">
                  <IconCalendarDue size={16} />
                  <Badge color={formatDueDate(task.due_date).color} variant="light">
                    {formatDueDate(task.due_date).text}
                  </Badge>
                </Group>
              )}
            </Group>

            {/* Labels */}
            {task.labels.length > 0 && (
              <Group gap="xs">
                {task.labels.map((label) => (
                  <Badge
                    key={label.id}
                    variant="filled"
                    style={{ backgroundColor: label.hex_color }}
                  >
                    {label.title}
                  </Badge>
                ))}
              </Group>
            )}

            {/* Assignees */}
            {task.assignees && task.assignees.length > 0 && (
              <Group gap="xs">
                <IconUser size={16} />
                {task.assignees.map((assignee) => (
                  <Badge key={assignee.id} variant="light" color="blue">
                    {assignee.name || assignee.username}
                  </Badge>
                ))}
              </Group>
            )}

            <Divider />

            {/* Description / Notes */}
            <Box>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600}>
                  Notes / Description
                </Text>
                <VoiceDictationButton
                  onTranscript={(text) => {
                    setDescription((prev) => prev + (prev ? ' ' : '') + text);
                    setDescriptionDirty(true);
                  }}
                  size="xs"
                  color="blue"
                />
              </Group>
              <Textarea
                placeholder="Ajoutez des notes..."
                minRows={4}
                autosize
                maxRows={12}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionDirty(true);
                }}
                onBlur={handleDescriptionBlur}
                rightSection={
                  updateDescriptionMutation.isPending ? (
                    <IconLoader size={16} className="animate-spin" />
                  ) : null
                }
              />
              {descriptionDirty && (
                <Text size="xs" c="dimmed" mt={4}>
                  Modifications non sauvegardées (cliquez ailleurs pour sauvegarder)
                </Text>
              )}
            </Box>

            <Divider />

            {/* Attachments */}
            <Box>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600}>
                  Pièces jointes ({task.attachments?.length || 0})
                </Text>
                <FileButton onChange={handleFileSelect} accept="*/*">
                  {(props) => (
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconPaperclip size={14} />}
                      loading={uploadMutation.isPending}
                      {...props}
                    >
                      Ajouter
                    </Button>
                  )}
                </FileButton>
              </Group>

              {task.attachments && task.attachments.length > 0 ? (
                <Stack gap="xs">
                  {task.attachments.map((attachment) => (
                    <Paper key={attachment.id} withBorder p="xs" radius="sm">
                      <Group justify="space-between">
                        <Group gap="xs">
                          <ThemeIcon variant="light" size="sm">
                            <IconPaperclip size={14} />
                          </ThemeIcon>
                          <Box>
                            <Text size="sm" fw={500} lineClamp={1}>
                              {attachment.file_name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatFileSize(attachment.file_size)}
                            </Text>
                          </Box>
                        </Group>
                        <Group gap={4}>
                          <Tooltip label="Télécharger">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => handleDownloadAttachment(attachment)}
                            >
                              <IconDownload size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Supprimer">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                              loading={deleteAttachmentMutation.isPending}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  Aucune pièce jointe
                </Text>
              )}
            </Box>

            <Divider />

            {/* Dates */}
            <Group gap="lg">
              <Box>
                <Text size="xs" c="dimmed">
                  Créée le
                </Text>
                <Text size="sm">{formatDate(task.created)}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">
                  Modifiée le
                </Text>
                <Text size="sm">{formatDate(task.updated)}</Text>
              </Box>
            </Group>
          </Stack>
        )}
      </Drawer>

      {/* Edit Modal */}
      <TaskModal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        task={task || null}
        onSuccess={() => {
          refetch();
          onUpdate?.();
        }}
      />
    </>
  );
}
