'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Stack,
  Title,
  Text,
  Select,
  Button,
  Group,
  Badge,
  Card,
  Divider,
  Alert,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconMicrophone,
  IconCheck,
  IconX,
  IconRefresh,
  IconVolume,
} from '@tabler/icons-react';
import { api } from '@/lib/api';

interface SpeechConfig {
  available: boolean;
  model_size: string;
  supported_formats: string[];
}

const speechApi = {
  getConfig: async (): Promise<SpeechConfig> => {
    const response = await api.get('/speech/config');
    return response.data;
  },
  updateConfig: async (data: { model_size: string }): Promise<SpeechConfig> => {
    const response = await api.put('/speech/config', data);
    return response.data;
  },
};

const modelOptions = [
  {
    value: 'tiny',
    label: 'Tiny - Très rapide',
    description: '~1s de traitement, moins précis',
    size: '~75 MB',
  },
  {
    value: 'base',
    label: 'Base - Équilibré',
    description: '~3s de traitement, bon équilibre',
    size: '~150 MB',
  },
  {
    value: 'small',
    label: 'Small - Précis',
    description: '~6s de traitement, très précis',
    size: '~500 MB',
  },
  {
    value: 'medium',
    label: 'Medium - Très précis',
    description: '~12s de traitement, excellent',
    size: '~1.5 GB',
  },
  {
    value: 'large-v3',
    label: 'Large V3 - Maximum',
    description: '~20s de traitement, le meilleur',
    size: '~3 GB',
  },
];

export function SpeechSettings() {
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<string>('tiny');

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['speechConfig'],
    queryFn: speechApi.getConfig,
  });

  useEffect(() => {
    if (config) {
      setSelectedModel(config.model_size);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: speechApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speechConfig'] });
      notifications.show({
        title: 'Configuration sauvegardée',
        message: 'Le modèle de reconnaissance vocale a été mis à jour. Le nouveau modèle sera chargé lors de la prochaine transcription.',
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

  const handleSave = () => {
    updateMutation.mutate({ model_size: selectedModel });
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

  const currentModelInfo = modelOptions.find((m) => m.value === config?.model_size);
  const selectedModelInfo = modelOptions.find((m) => m.value === selectedModel);

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg">
        <Group mb="md">
          <IconMicrophone size={24} />
          <Title order={3}>Reconnaissance vocale (STT)</Title>
        </Group>

        <Text size="sm" c="dimmed" mb="lg">
          Configurez le modèle Whisper utilisé pour la transcription audio en texte.
          Un modèle plus grand sera plus précis mais plus lent.
        </Text>

        {/* Status */}
        <Card withBorder mb="lg" p="md">
          <Group justify="space-between">
            <Group>
              <IconVolume size={20} />
              <Text fw={500}>Statut du service</Text>
            </Group>
            <Group>
              <Badge
                color={config?.available ? 'green' : 'red'}
                variant="dot"
                size="lg"
              >
                {config?.available ? 'Disponible' : 'Non disponible'}
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
          {config?.available && currentModelInfo && (
            <Text size="sm" c="dimmed" mt="xs">
              Modèle actif: <strong>{currentModelInfo.label}</strong> ({currentModelInfo.size})
            </Text>
          )}
        </Card>

        {!config?.available && (
          <Alert color="orange" icon={<IconX size={16} />} mb="lg">
            Le module faster-whisper n'est pas installé sur le serveur.
            Exécutez: <code>pip install faster-whisper</code>
          </Alert>
        )}

        <Divider my="lg" label="Choix du modèle" labelPosition="center" />

        <Stack gap="md">
          <Select
            label="Modèle Whisper"
            description="Choisissez le modèle selon vos besoins de vitesse et de précision"
            placeholder="Sélectionner un modèle"
            leftSection={<IconMicrophone size={16} />}
            data={modelOptions.map((m) => ({
              value: m.value,
              label: m.label,
            }))}
            value={selectedModel}
            onChange={(value) => setSelectedModel(value || 'tiny')}
            disabled={!config?.available}
          />

          {/* Model Details */}
          {selectedModelInfo && (
            <Card withBorder p="sm" bg="dark.6">
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  {selectedModelInfo.label}
                </Text>
                <Badge color="blue" variant="light">
                  {selectedModelInfo.size}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {selectedModelInfo.description}
              </Text>
            </Card>
          )}

          {/* Model Comparison */}
          <Card withBorder p="sm">
            <Text size="sm" fw={500} mb="xs">
              Comparaison des modèles
            </Text>
            <Stack gap="xs">
              {modelOptions.map((m) => (
                <Group
                  key={m.value}
                  justify="space-between"
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    backgroundColor:
                      m.value === selectedModel
                        ? 'var(--mantine-color-blue-9)'
                        : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedModel(m.value)}
                >
                  <Group gap="xs">
                    <Badge
                      size="xs"
                      color={m.value === config?.model_size ? 'green' : 'gray'}
                      variant={m.value === config?.model_size ? 'filled' : 'light'}
                    >
                      {m.value === config?.model_size ? 'Actif' : m.value}
                    </Badge>
                    <Text size="sm">{m.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {m.size}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </Stack>

        <Divider my="lg" />

        {/* Save Button */}
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={updateMutation.isPending}
            leftSection={<IconCheck size={16} />}
            disabled={!config?.available || selectedModel === config?.model_size}
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
            <strong>Qu'est-ce que Whisper ?</strong>
          </Text>
          <Text size="sm" c="dimmed">
            Whisper est un modèle de reconnaissance vocale open-source développé par OpenAI.
            Il fonctionne entièrement en local sur votre serveur.
          </Text>
          <Text size="sm" mt="sm">
            <strong>Quel modèle choisir ?</strong>
          </Text>
          <Text size="sm" c="dimmed">
            • <strong>Tiny</strong> - Pour des dictées rapides, quelques mots
            <br />
            • <strong>Base</strong> - Bon pour la plupart des usages
            <br />
            • <strong>Small</strong> - Recommandé pour des textes plus longs
            <br />
            • <strong>Medium/Large</strong> - Pour une précision maximale
          </Text>
          <Text size="sm" mt="sm">
            <strong>Formats supportés</strong>
          </Text>
          <Text size="sm" c="dimmed">
            {config?.supported_formats?.join(', ') || 'wav, mp3, webm, ogg, m4a, flac'}
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
