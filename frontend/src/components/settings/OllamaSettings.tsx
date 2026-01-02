'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Stack,
  Title,
  Text,
  TextInput,
  Select,
  Button,
  Group,
  Badge,
  Alert,
  Loader,
  Card,
  Divider,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconRobot,
  IconPlug,
  IconCheck,
  IconX,
  IconRefresh,
  IconBrain,
  IconServer,
} from '@tabler/icons-react';
import { api } from '@/lib/api';

interface OllamaConfig {
  url: string;
  model: string;
  available: boolean;
  models: Array<{
    name: string;
    model: string;
    size: number;
    details?: {
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

interface TestResult {
  success: boolean;
  message: string;
  models: Array<{
    name: string;
    model: string;
    size: number;
    details?: {
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

const ollamaApi = {
  getConfig: async (): Promise<OllamaConfig> => {
    const response = await api.get('/chat/config');
    return response.data;
  },
  updateConfig: async (data: { url?: string; model?: string }): Promise<OllamaConfig> => {
    const response = await api.put('/chat/config', data);
    return response.data;
  },
  testConnection: async (url: string): Promise<TestResult> => {
    const response = await api.post('/chat/test-connection', { url });
    return response.data;
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function OllamaSettings() {
  const queryClient = useQueryClient();
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [availableModels, setAvailableModels] = useState<OllamaConfig['models']>([]);

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['ollamaConfig'],
    queryFn: ollamaApi.getConfig,
  });

  const form = useForm({
    initialValues: {
      url: '',
      model: '',
    },
  });

  // Update form when config loads
  useEffect(() => {
    if (config) {
      form.setValues({
        url: config.url,
        model: config.model,
      });
      setTestUrl(config.url);
      setAvailableModels(config.models);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: ollamaApi.updateConfig,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ollamaConfig'] });
      queryClient.invalidateQueries({ queryKey: ['ollamaStatus'] });
      setAvailableModels(data.models);
      notifications.show({
        title: 'Configuration sauvegardée',
        message: 'La configuration Ollama a été mise à jour.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Impossible de sauvegarder la configuration.',
        color: 'red',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: ollamaApi.testConnection,
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        setAvailableModels(data.models);
      }
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        message: error.message || 'Erreur de connexion',
        models: [],
      });
    },
  });

  const handleTest = () => {
    setTestResult(null);
    testMutation.mutate(testUrl);
  };

  const handleSave = () => {
    updateMutation.mutate({
      url: form.values.url,
      model: form.values.model,
    });
  };

  if (isLoading) {
    return (
      <Paper withBorder p="xl">
        <Group justify="center" py="xl">
          <Loader />
          <Text>Chargement de la configuration...</Text>
        </Group>
      </Paper>
    );
  }

  const modelOptions = availableModels.map((m) => ({
    value: m.name,
    label: `${m.name} (${formatBytes(m.size)}${m.details?.parameter_size ? ` - ${m.details.parameter_size}` : ''})`,
  }));

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg">
        <Group mb="md">
          <IconRobot size={24} />
          <Title order={3}>Configuration Ollama</Title>
        </Group>

        <Text size="sm" c="dimmed" mb="lg">
          Configurez la connexion à votre instance Ollama pour utiliser l'assistant IA self-hosted.
        </Text>

        {/* Status */}
        <Card withBorder mb="lg" p="md">
          <Group justify="space-between">
            <Group>
              <IconServer size={20} />
              <Text fw={500}>Statut de la connexion</Text>
            </Group>
            <Group>
              <Badge
                color={config?.available ? 'green' : 'red'}
                variant="dot"
                size="lg"
              >
                {config?.available ? 'Connecté' : 'Déconnecté'}
              </Badge>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={() => refetch()}
              >
                Actualiser
              </Button>
            </Group>
          </Group>
          {config?.available && (
            <Text size="sm" c="dimmed" mt="xs">
              Modèle actif: <strong>{config.model}</strong> - {config.models.length} modèle(s) disponible(s)
            </Text>
          )}
        </Card>

        <Divider my="lg" label="Paramètres de connexion" labelPosition="center" />

        <Stack gap="md">
          {/* URL Input with Test */}
          <Box>
            <TextInput
              label="URL de l'instance Ollama"
              description="L'adresse de votre serveur Ollama (ex: http://192.168.1.100:11434)"
              placeholder="http://localhost:11434"
              leftSection={<IconPlug size={16} />}
              value={testUrl}
              onChange={(e) => {
                setTestUrl(e.target.value);
                form.setFieldValue('url', e.target.value);
                setTestResult(null);
              }}
            />
            <Group mt="xs">
              <Button
                variant="light"
                size="xs"
                onClick={handleTest}
                loading={testMutation.isPending}
                leftSection={<IconPlug size={14} />}
              >
                Tester la connexion
              </Button>
            </Group>
          </Box>

          {/* Test Result */}
          {testResult && (
            <Alert
              color={testResult.success ? 'green' : 'red'}
              icon={testResult.success ? <IconCheck size={16} /> : <IconX size={16} />}
              title={testResult.success ? 'Connexion réussie' : 'Échec de la connexion'}
            >
              {testResult.message}
            </Alert>
          )}

          {/* Model Selection */}
          <Select
            label="Modèle à utiliser"
            description="Sélectionnez le modèle LLM pour l'assistant"
            placeholder={availableModels.length === 0 ? "Testez d'abord la connexion" : "Choisir un modèle"}
            leftSection={<IconBrain size={16} />}
            data={modelOptions}
            value={form.values.model}
            onChange={(value) => form.setFieldValue('model', value || '')}
            disabled={availableModels.length === 0}
            searchable
          />

          {/* Available Models Info */}
          {availableModels.length > 0 && (
            <Card withBorder p="sm" bg="dark.6">
              <Text size="sm" fw={500} mb="xs">
                Modèles disponibles ({availableModels.length})
              </Text>
              <Group gap="xs" wrap="wrap">
                {availableModels.map((m) => (
                  <Badge
                    key={m.name}
                    variant={m.name === form.values.model ? 'filled' : 'light'}
                    color={m.name === form.values.model ? 'blue' : 'gray'}
                    size="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => form.setFieldValue('model', m.name)}
                  >
                    {m.name}
                  </Badge>
                ))}
              </Group>
            </Card>
          )}
        </Stack>

        <Divider my="lg" />

        {/* Save Button */}
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={updateMutation.isPending}
            leftSection={<IconCheck size={16} />}
            disabled={!form.values.url || !form.values.model}
          >
            Sauvegarder
          </Button>
        </Group>
      </Paper>

      {/* Help Section */}
      <Paper withBorder p="lg">
        <Title order={4} mb="md">
          Aide
        </Title>
        <Stack gap="xs">
          <Text size="sm">
            <strong>Qu'est-ce qu'Ollama ?</strong>
          </Text>
          <Text size="sm" c="dimmed">
            Ollama est un outil open-source permettant d'exécuter des modèles de langage (LLM) localement.
            Il supporte de nombreux modèles comme Mistral, Llama, Phi, etc.
          </Text>
          <Text size="sm" mt="sm">
            <strong>Installation</strong>
          </Text>
          <Text size="sm" c="dimmed">
            Pour installer Ollama sur votre serveur, visitez{' '}
            <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-blue-4)' }}>
              ollama.ai
            </a>
          </Text>
          <Text size="sm" mt="sm">
            <strong>Modèles recommandés</strong>
          </Text>
          <Text size="sm" c="dimmed">
            • <strong>mistral:7b</strong> - Bon équilibre performance/qualité (4.1 GB)
            <br />
            • <strong>llama3:8b</strong> - Très performant (4.7 GB)
            <br />
            • <strong>phi3:3.8b</strong> - Léger et rapide (2.2 GB)
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
