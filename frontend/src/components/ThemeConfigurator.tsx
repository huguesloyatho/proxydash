'use client';

import { useState } from 'react';
import {
  Modal,
  Box,
  Title,
  Text,
  Card,
  Group,
  Stack,
  SimpleGrid,
  TextInput,
  Slider,
  Button,
  Tabs,
  ActionIcon,
  Tooltip,
  Badge,
  Divider,
  SegmentedControl,
  Image,
} from '@mantine/core';
import {
  IconPalette,
  IconPhoto,
  IconCheck,
  IconRefresh,
  IconUpload,
  IconLink,
  IconX,
} from '@tabler/icons-react';
import { useThemeStore } from '@/lib/store';
import { PRESET_THEMES, ThemeConfig, DEFAULT_CUSTOM_SETTINGS } from '@/lib/themes';
import { notifications } from '@mantine/notifications';

interface ThemeConfiguratorProps {
  opened: boolean;
  onClose: () => void;
}

// Quelques fonds d'écran prédéfinis (URLs publiques)
const PRESET_BACKGROUNDS = [
  {
    id: 'none',
    name: 'Aucun',
    url: null,
  },
  {
    id: 'abstract-dark',
    name: 'Abstrait Sombre',
    url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&q=80',
  },
  {
    id: 'gradient-mesh',
    name: 'Gradient Mesh',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80',
  },
  {
    id: 'mountains-night',
    name: 'Montagnes Nuit',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80',
  },
  {
    id: 'northern-lights',
    name: 'Aurores Boréales',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80',
  },
  {
    id: 'space-nebula',
    name: 'Nébuleuse',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80',
  },
  {
    id: 'city-night',
    name: 'Ville Nocturne',
    url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80',
  },
];

export function ThemeConfigurator({ opened, onClose }: ThemeConfiguratorProps) {
  const {
    activeThemeId,
    customSettings,
    setActiveTheme,
    updateCustomSettings,
    resetCustomSettings,
  } = useThemeStore();

  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('themes');

  const handleSelectTheme = (themeId: string) => {
    setActiveTheme(themeId);
    notifications.show({
      title: 'Thème appliqué',
      message: `Le thème "${PRESET_THEMES.find(t => t.id === themeId)?.name}" a été appliqué`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const handleSelectBackground = (url: string | null) => {
    updateCustomSettings({ backgroundImage: url });
    if (url) {
      notifications.show({
        title: 'Fond d\'écran appliqué',
        message: 'Le fond d\'écran a été changé',
        color: 'green',
      });
    }
  };

  const handleCustomUrlSubmit = () => {
    if (!customUrl.trim()) return;

    // Vérifier si c'est une URL valide
    try {
      new URL(customUrl);
      updateCustomSettings({ backgroundImage: customUrl });
      setCustomUrl('');
      notifications.show({
        title: 'Fond d\'écran personnalisé',
        message: 'Votre image a été appliquée',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'URL invalide',
        message: 'Veuillez entrer une URL d\'image valide',
        color: 'red',
      });
    }
  };

  const handleReset = () => {
    resetCustomSettings();
    setActiveTheme('dark-default');
    notifications.show({
      title: 'Réinitialisation',
      message: 'Les paramètres de thème ont été réinitialisés',
      color: 'blue',
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPalette size={20} />
          <Text fw={600}>Personnalisation du thème</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="themes" leftSection={<IconPalette size={14} />}>
            Thèmes
          </Tabs.Tab>
          <Tabs.Tab value="background" leftSection={<IconPhoto size={14} />}>
            Fond d'écran
          </Tabs.Tab>
          <Tabs.Tab value="advanced" leftSection={<IconPalette size={14} />}>
            Avancé
          </Tabs.Tab>
        </Tabs.List>

        {/* Onglet Thèmes */}
        <Tabs.Panel value="themes">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Choisissez un thème de couleurs prédéfini
            </Text>

            <SimpleGrid cols={2} spacing="md">
              {PRESET_THEMES.map((theme) => (
                <Card
                  key={theme.id}
                  withBorder
                  padding="md"
                  radius="md"
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    activeThemeId === theme.id
                      ? 'ring-2 ring-blue-500 border-blue-500'
                      : 'hover:border-blue-400'
                  }`}
                  onClick={() => handleSelectTheme(theme.id)}
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={500} size="sm">
                      {theme.name}
                    </Text>
                    {activeThemeId === theme.id && (
                      <Badge size="xs" color="blue" variant="filled">
                        Actif
                      </Badge>
                    )}
                  </Group>

                  <Text size="xs" c="dimmed" mb="sm">
                    {theme.description}
                  </Text>

                  {/* Preview des couleurs */}
                  <Group gap={4}>
                    <Tooltip label="Couleur primaire">
                      <Box
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          backgroundColor: theme.preview.primary,
                        }}
                      />
                    </Tooltip>
                    <Tooltip label="Fond">
                      <Box
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          backgroundColor: theme.preview.background,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    </Tooltip>
                    <Tooltip label="Cartes">
                      <Box
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          backgroundColor: theme.preview.card,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    </Tooltip>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        {/* Onglet Fond d'écran */}
        <Tabs.Panel value="background">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Ajoutez un fond d'écran personnalisé
            </Text>

            {/* URL personnalisée */}
            <Group>
              <TextInput
                placeholder="https://example.com/image.jpg"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                leftSection={<IconLink size={14} />}
                style={{ flex: 1 }}
              />
              <Button
                onClick={handleCustomUrlSubmit}
                disabled={!customUrl.trim()}
                leftSection={<IconUpload size={14} />}
              >
                Appliquer
              </Button>
            </Group>

            <Divider label="ou choisissez un fond prédéfini" labelPosition="center" />

            {/* Fonds prédéfinis */}
            <SimpleGrid cols={3} spacing="sm">
              {PRESET_BACKGROUNDS.map((bg) => (
                <Card
                  key={bg.id}
                  withBorder
                  padding={0}
                  radius="md"
                  className={`cursor-pointer transition-all overflow-hidden ${
                    customSettings.backgroundImage === bg.url
                      ? 'ring-2 ring-blue-500 border-blue-500'
                      : 'hover:border-blue-400'
                  }`}
                  onClick={() => handleSelectBackground(bg.url)}
                  style={{ height: 80 }}
                >
                  {bg.url ? (
                    <Box style={{ position: 'relative', height: '100%' }}>
                      <Image
                        src={bg.url}
                        alt={bg.name}
                        fit="cover"
                        h={80}
                      />
                      <Box
                        className="absolute inset-0 bg-black/40 flex items-end p-2"
                      >
                        <Text size="xs" c="white" fw={500}>
                          {bg.name}
                        </Text>
                      </Box>
                      {customSettings.backgroundImage === bg.url && (
                        <Box className="absolute top-1 right-1">
                          <IconCheck size={16} className="text-green-400" />
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box className="h-full flex items-center justify-center bg-gray-800">
                      <Stack gap={4} align="center">
                        <IconX size={20} className="text-gray-500" />
                        <Text size="xs" c="dimmed">
                          {bg.name}
                        </Text>
                      </Stack>
                    </Box>
                  )}
                </Card>
              ))}
            </SimpleGrid>

            {/* Aperçu actuel */}
            {customSettings.backgroundImage && (
              <Card withBorder padding="sm" radius="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconPhoto size={16} />
                    <Text size="sm">Fond actuel</Text>
                  </Group>
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={() => handleSelectBackground(null)}
                  >
                    Supprimer
                  </Button>
                </Group>
                <Text size="xs" c="dimmed" mt="xs" lineClamp={1}>
                  {customSettings.backgroundImage}
                </Text>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        {/* Onglet Avancé */}
        <Tabs.Panel value="advanced">
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Ajustez les paramètres visuels
            </Text>

            {/* Opacité de l'overlay (seulement si fond d'écran) */}
            {customSettings.backgroundImage && (
              <>
                <Box>
                  <Text size="sm" fw={500} mb="xs">
                    Assombrissement du fond ({customSettings.overlayOpacity}%)
                  </Text>
                  <Slider
                    value={customSettings.overlayOpacity}
                    onChange={(value) => updateCustomSettings({ overlayOpacity: value })}
                    min={0}
                    max={90}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 45, label: '45%' },
                      { value: 90, label: '90%' },
                    ]}
                  />
                </Box>

                <Box>
                  <Text size="sm" fw={500} mb="xs">
                    Opacité des cartes ({customSettings.cardOpacity}%)
                  </Text>
                  <Slider
                    value={customSettings.cardOpacity}
                    onChange={(value) => updateCustomSettings({ cardOpacity: value })}
                    min={50}
                    max={100}
                    step={5}
                    marks={[
                      { value: 50, label: '50%' },
                      { value: 75, label: '75%' },
                      { value: 100, label: '100%' },
                    ]}
                  />
                </Box>
              </>
            )}

            {/* Arrondi des bords */}
            <Box>
              <Text size="sm" fw={500} mb="xs">
                Arrondi des bords
              </Text>
              <SegmentedControl
                value={customSettings.borderRadius}
                onChange={(value) =>
                  updateCustomSettings({
                    borderRadius: value as 'xs' | 'sm' | 'md' | 'lg' | 'xl',
                  })
                }
                data={[
                  { label: 'XS', value: 'xs' },
                  { label: 'SM', value: 'sm' },
                  { label: 'MD', value: 'md' },
                  { label: 'LG', value: 'lg' },
                  { label: 'XL', value: 'xl' },
                ]}
                fullWidth
              />
            </Box>

            <Divider />

            {/* Bouton réinitialisation */}
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconRefresh size={14} />}
              onClick={handleReset}
            >
              Réinitialiser tous les paramètres
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
