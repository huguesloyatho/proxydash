'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
  category: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Hook for global keyboard shortcuts
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : true;
        const metaMatch = shortcut.meta ? event.metaKey : true;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

        // For shortcuts with modifiers, allow in input fields
        // For plain letter shortcuts, block in input fields
        const hasModifier = shortcut.ctrl || shortcut.meta || shortcut.alt;

        if (isInputField && !hasModifier) {
          continue;
        }

        if (keyMatch && ctrlMatch && metaMatch && altMatch && shiftMatch) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Format shortcut key for display
 */
export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  // Detect OS for proper key symbols
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

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

  parts.push(keyDisplay);

  return parts.join(isMac ? '' : '+');
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(
  shortcuts: KeyboardShortcut[]
): Record<string, KeyboardShortcut[]> {
  return shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);
}
