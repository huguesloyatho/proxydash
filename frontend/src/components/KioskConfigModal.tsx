'use client';

import {
  Modal,
  Stack,
  Switch,
  NumberInput,
  Text,
  Button,
  Group,
  Checkbox,
  Box,
  Badge,
  Paper,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconClock,
  IconRefresh,
  IconLayoutDashboard,
} from '@tabler/icons-react';
import { useKioskStore } from '@/lib/store';
import { Tab } from '@/types';

interface KioskConfigModalProps {
  opened: boolean;
  onClose: () => void;
  onStart: () => void;
  tabs: Tab[];
}

export function KioskConfigModal({ opened, onClose, onStart, tabs }: KioskConfigModalProps) {
  const {
    kioskAutoRotate,
    kioskRotationInterval,
    kioskShowClock,
    kioskTabOrder,
    setKioskAutoRotate,
    setKioskRotationInterval,
    setKioskShowClock,
    setKioskTabOrder,
  } = useKioskStore();

  // Handle tab selection for rotation
  const handleTabToggle = (tabSlug: string, checked: boolean) => {
    if (checked) {
      setKioskTabOrder([...kioskTabOrder, tabSlug]);
    } else {
      setKioskTabOrder(kioskTabOrder.filter((slug) => slug !== tabSlug));
    }
  };

  // Select all tabs
  const selectAllTabs = () => {
    setKioskTabOrder(tabs.map((t) => t.slug));
  };

  // Clear tab selection
  const clearTabSelection = () => {
    setKioskTabOrder([]);
  };

  const effectiveTabs = kioskTabOrder.length > 0 ? kioskTabOrder : tabs.map((t) => t.slug);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconLayoutDashboard size={24} />
          <Text fw={600}>Configuration Mode Kiosk</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="lg">
        {/* Auto-rotation settings */}
        <Paper withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <IconRefresh size={18} />
                <Text fw={500}>Rotation automatique</Text>
              </Group>
              <Switch
                checked={kioskAutoRotate}
                onChange={(e) => setKioskAutoRotate(e.currentTarget.checked)}
              />
            </Group>

            {kioskAutoRotate && (
              <NumberInput
                label="Intervalle de rotation"
                description="Temps en secondes entre chaque changement d'onglet"
                value={kioskRotationInterval}
                onChange={(val) => setKioskRotationInterval(Number(val) || 30)}
                min={5}
                max={300}
                step={5}
                suffix=" sec"
                leftSection={<IconClock size={16} />}
              />
            )}
          </Stack>
        </Paper>

        {/* Display settings */}
        <Paper withBorder p="md">
          <Stack gap="md">
            <Text fw={500}>Affichage</Text>
            <Switch
              label="Afficher l'horloge"
              description="Affiche l'heure actuelle en haut à droite"
              checked={kioskShowClock}
              onChange={(e) => setKioskShowClock(e.currentTarget.checked)}
            />
          </Stack>
        </Paper>

        {/* Tab selection for rotation */}
        <Paper withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Onglets à afficher</Text>
              <Group gap="xs">
                <Button variant="subtle" size="xs" onClick={selectAllTabs}>
                  Tout sélectionner
                </Button>
                <Button variant="subtle" size="xs" color="gray" onClick={clearTabSelection}>
                  Effacer
                </Button>
              </Group>
            </Group>

            <Text size="sm" c="dimmed">
              {kioskTabOrder.length === 0
                ? 'Tous les onglets seront affichés'
                : `${kioskTabOrder.length} onglet(s) sélectionné(s)`}
            </Text>

            <Box>
              {tabs.map((tab) => (
                <Checkbox
                  key={tab.id}
                  label={
                    <Group gap="xs">
                      <span>{tab.name}</span>
                      {tab.tab_type === 'default' && (
                        <Badge size="xs" variant="light">
                          Principal
                        </Badge>
                      )}
                    </Group>
                  }
                  checked={
                    kioskTabOrder.length === 0 || kioskTabOrder.includes(tab.slug)
                  }
                  onChange={(e) => handleTabToggle(tab.slug, e.currentTarget.checked)}
                  mb="xs"
                />
              ))}
            </Box>
          </Stack>
        </Paper>

        {/* Preview info */}
        <Paper withBorder p="md" bg="blue.9">
          <Group gap="md">
            <IconLayoutDashboard size={24} className="text-blue-400" />
            <Box>
              <Text size="sm" fw={500}>
                Mode Kiosk
              </Text>
              <Text size="xs" c="dimmed">
                {effectiveTabs.length} onglet(s) •{' '}
                {kioskAutoRotate
                  ? `Rotation toutes les ${kioskRotationInterval}s`
                  : 'Rotation manuelle'}
              </Text>
            </Box>
          </Group>
        </Paper>

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button
            leftSection={<IconPlayerPlay size={18} />}
            onClick={() => {
              onStart();
              onClose();
            }}
          >
            Démarrer le mode Kiosk
          </Button>
        </Group>

        {/* Keyboard shortcuts hint */}
        <Text size="xs" c="dimmed" ta="center">
          Raccourcis: Échap (quitter) • Espace (pause) • ←→ (naviguer)
        </Text>
      </Stack>
    </Modal>
  );
}
