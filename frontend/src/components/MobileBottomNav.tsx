'use client';

import { Box, Group, ActionIcon, Text, Stack, Badge } from '@mantine/core';
import {
  IconHome,
  IconChecklist,
  IconNote,
  IconCalendar,
  IconRobot,
} from '@tabler/icons-react';

interface MobileBottomNavProps {
  activeView: 'home' | 'tasks' | 'notes' | 'calendar' | 'chat';
  onViewChange: (view: 'home' | 'tasks' | 'notes' | 'calendar' | 'chat') => void;
  taskCount?: number;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

function NavItem({ icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <Box
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '8px 4px',
        borderRadius: 8,
        backgroundColor: active ? 'var(--mantine-color-blue-light)' : 'transparent',
        transition: 'all 0.2s ease',
      }}
    >
      <Box pos="relative">
        <ActionIcon
          variant={active ? 'filled' : 'subtle'}
          color={active ? 'blue' : 'gray'}
          size="lg"
        >
          {icon}
        </ActionIcon>
        {badge !== undefined && badge > 0 && (
          <Badge
            size="xs"
            color="red"
            variant="filled"
            style={{
              position: 'absolute',
              top: -4,
              right: -8,
              padding: '0 4px',
              minWidth: 16,
              height: 16,
            }}
          >
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </Box>
      <Text
        size="xs"
        c={active ? 'blue' : 'dimmed'}
        fw={active ? 600 : 400}
        mt={4}
      >
        {label}
      </Text>
    </Box>
  );
}

export function MobileBottomNav({ activeView, onViewChange, taskCount }: MobileBottomNavProps) {
  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: 'var(--mantine-color-body)',
        borderTop: '1px solid var(--mantine-color-default-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <Group gap={0} justify="space-around" py="xs" px="xs">
        <NavItem
          icon={<IconHome size={22} />}
          label="Accueil"
          active={activeView === 'home'}
          onClick={() => onViewChange('home')}
        />
        <NavItem
          icon={<IconChecklist size={22} />}
          label="Tâches"
          active={activeView === 'tasks'}
          onClick={() => onViewChange('tasks')}
          badge={taskCount}
        />
        <NavItem
          icon={<IconNote size={22} />}
          label="Notes"
          active={activeView === 'notes'}
          onClick={() => onViewChange('notes')}
        />
        <NavItem
          icon={<IconCalendar size={22} />}
          label="Agenda"
          active={activeView === 'calendar'}
          onClick={() => onViewChange('calendar')}
        />
        <NavItem
          icon={<IconRobot size={22} />}
          label="Chat"
          active={activeView === 'chat'}
          onClick={() => onViewChange('chat')}
        />
      </Group>
    </Box>
  );
}
