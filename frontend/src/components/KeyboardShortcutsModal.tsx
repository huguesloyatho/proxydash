'use client';

import {
  Modal,
  Stack,
  Group,
  Text,
  Kbd,
  Box,
  Title,
  Divider,
  SimpleGrid,
} from '@mantine/core';
import {
  KeyboardShortcut,
  formatShortcutKey,
  groupShortcutsByCategory,
} from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  opened: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

export function KeyboardShortcutsModal({
  opened,
  onClose,
  shortcuts,
}: KeyboardShortcutsModalProps) {
  const groupedShortcuts = groupShortcutsByCategory(shortcuts);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600} size="lg">
            Raccourcis clavier
          </Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="lg">
        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <Box key={category}>
            <Text fw={600} size="sm" c="dimmed" mb="xs" tt="uppercase">
              {category}
            </Text>
            <Stack gap="xs">
              {categoryShortcuts.map((shortcut, index) => (
                <Group key={index} justify="space-between" py={4}>
                  <Text size="sm">{shortcut.description}</Text>
                  <ShortcutKeys shortcut={shortcut} />
                </Group>
              ))}
            </Stack>
            <Divider mt="md" />
          </Box>
        ))}

        <Text size="xs" c="dimmed" ta="center">
          Appuyez sur <Kbd size="xs">?</Kbd> pour afficher ce panneau à tout moment
        </Text>
      </Stack>
    </Modal>
  );
}

function ShortcutKeys({ shortcut }: { shortcut: KeyboardShortcut }) {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }

  // Format the key
  let keyDisplay = shortcut.key.toUpperCase();
  if (shortcut.key === 'Escape') keyDisplay = 'Esc';
  if (shortcut.key === 'ArrowUp') keyDisplay = '↑';
  if (shortcut.key === 'ArrowDown') keyDisplay = '↓';
  if (shortcut.key === 'ArrowLeft') keyDisplay = '←';
  if (shortcut.key === 'ArrowRight') keyDisplay = '→';
  if (shortcut.key === 'Enter') keyDisplay = '↵';
  if (shortcut.key === ' ') keyDisplay = 'Space';
  if (shortcut.key === '/') keyDisplay = '/';
  if (shortcut.key === '?') keyDisplay = '?';

  parts.push(keyDisplay);

  return (
    <Group gap={4}>
      {parts.map((part, index) => (
        <span key={index}>
          <Kbd size="sm">{part}</Kbd>
          {index < parts.length - 1 && !isMac && (
            <Text span size="xs" c="dimmed" mx={2}>
              +
            </Text>
          )}
        </span>
      ))}
    </Group>
  );
}
