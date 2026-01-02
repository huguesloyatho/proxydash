'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Text,
  Paper,
  SimpleGrid,
  Loader,
  Center,
  Badge,
  Box,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconLayoutDashboard,
  IconServer,
  IconCheck,
  IconShield,
  IconCircleDot,
} from '@tabler/icons-react';
import { appDashboardApi, serversApi } from '@/lib/api';
import { AppTemplateListItem, Server, ConfigSchemaField } from '@/types';

interface CreateAppDashboardModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  IconShield,
  IconCircleDot,
  IconLayoutDashboard,
};

export function CreateAppDashboardModal({
  opened,
  onClose,
  onSuccess,
}: CreateAppDashboardModalProps) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplateListItem | null>(null);
  const [templateConfig, setTemplateConfig] = useState<Record<string, ConfigSchemaField>>({});

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['app-templates'],
    queryFn: appDashboardApi.listTemplates,
    enabled: opened,
  });

  // Fetch servers
  const { data: servers = [], isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
    enabled: opened,
  });

  // Form
  const form = useForm({
    initialValues: {
      name: '',
      server_id: '',
      variables: {} as Record<string, string>,
    },
    validate: {
      name: (value) => (!value.trim() ? 'Le nom est requis' : null),
      server_id: (value) => (!value ? 'Sélectionnez un serveur' : null),
    },
  });

  // Load template config when selected
  useEffect(() => {
    if (selectedTemplate) {
      appDashboardApi.getTemplate(selectedTemplate.id).then((template) => {
        setTemplateConfig(template.config_schema || {});
        // Set default variable values
        const defaults: Record<string, string> = {};
        Object.entries(template.config_schema || {}).forEach(([key, field]) => {
          if (field.default) {
            defaults[key] = field.default;
          }
        });
        form.setFieldValue('variables', defaults);
        // Set default name if empty
        if (!form.values.name) {
          form.setFieldValue('name', `Dashboard ${template.name}`);
        }
      });
    }
  }, [selectedTemplate]);

  // Reset when modal closes
  useEffect(() => {
    if (!opened) {
      form.reset();
      setSelectedTemplate(null);
      setTemplateConfig({});
    }
  }, [opened]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      template_id: number;
      server_id: number;
      variables: Record<string, string>;
    }) => appDashboardApi.createDashboardTab(data),
    onSuccess: () => {
      notifications.show({
        title: 'Dashboard créé',
        message: 'Votre dashboard a été créé avec succès',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de créer le dashboard',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    if (!selectedTemplate) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez sélectionner un template',
        color: 'red',
      });
      return;
    }

    createMutation.mutate({
      name: values.name,
      template_id: selectedTemplate.id,
      server_id: parseInt(values.server_id),
      variables: values.variables,
    });
  };

  const renderTemplateIcon = (iconName?: string) => {
    const Icon = iconName ? TEMPLATE_ICONS[iconName] : IconLayoutDashboard;
    return Icon ? <Icon size={24} /> : <IconLayoutDashboard size={24} />;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconLayoutDashboard size={20} />
          <Text fw={600}>Nouveau Dashboard App</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Template Selection */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              1. Choisir un template
            </Text>
            {templatesLoading ? (
              <Center p="md">
                <Loader size="sm" />
              </Center>
            ) : templates.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" p="md">
                Aucun template disponible
              </Text>
            ) : (
              <SimpleGrid cols={2} spacing="sm">
                {templates.map((template) => (
                  <Paper
                    key={template.id}
                    p="sm"
                    withBorder
                    radius="md"
                    style={{
                      cursor: 'pointer',
                      borderColor:
                        selectedTemplate?.id === template.id
                          ? 'var(--mantine-color-blue-6)'
                          : undefined,
                      borderWidth: selectedTemplate?.id === template.id ? 2 : 1,
                    }}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <Box c="blue">{renderTemplateIcon(template.icon)}</Box>
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>
                            {template.name}
                          </Text>
                          {template.is_builtin && (
                            <Badge size="xs" variant="light">
                              Officiel
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {template.description || 'Pas de description'}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>
            )}
          </Box>

          <Divider />

          {/* Configuration */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              2. Configuration
            </Text>
            <Stack gap="sm">
              <TextInput
                label="Nom du dashboard"
                placeholder="Mon dashboard CrowdSec"
                required
                {...form.getInputProps('name')}
              />

              <Select
                label="Serveur cible"
                placeholder="Sélectionnez un serveur"
                required
                leftSection={<IconServer size={16} />}
                data={servers.map((s: Server) => ({
                  value: String(s.id),
                  label: `${s.name} (${s.host})`,
                }))}
                {...form.getInputProps('server_id')}
              />

              {/* Template Variables */}
              {Object.entries(templateConfig).length > 0 && (
                <>
                  <Divider label="Variables du template" labelPosition="left" />
                  {Object.entries(templateConfig).map(([key, field]) => (
                    <TextInput
                      key={key}
                      label={field.label}
                      description={field.description}
                      placeholder={field.default || ''}
                      required={field.required}
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={form.values.variables[key] || ''}
                      onChange={(e) =>
                        form.setFieldValue('variables', {
                          ...form.values.variables,
                          [key]: e.target.value,
                        })
                      }
                    />
                  ))}
                </>
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Actions */}
          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={!selectedTemplate}
              leftSection={<IconCheck size={16} />}
            >
              Créer le dashboard
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
