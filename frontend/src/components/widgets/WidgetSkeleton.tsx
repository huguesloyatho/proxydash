'use client';

import { Skeleton, Stack, Group, Box } from '@mantine/core';

interface WidgetSkeletonProps {
  variant?: 'default' | 'list' | 'stats' | 'chart' | 'grid';
  rows?: number;
}

/**
 * Skeleton loader for widgets - provides visual feedback during data loading
 * instead of showing a black/empty screen
 */
export function WidgetSkeleton({ variant = 'default', rows = 4 }: WidgetSkeletonProps) {
  switch (variant) {
    case 'list':
      return (
        <Stack gap="xs">
          {Array.from({ length: rows }).map((_, i) => (
            <Group key={i} gap="sm" wrap="nowrap">
              <Skeleton height={24} width={24} radius="sm" />
              <Skeleton height={16} style={{ flex: 1 }} radius="sm" />
              <Skeleton height={16} width={60} radius="sm" />
            </Group>
          ))}
        </Stack>
      );

    case 'stats':
      return (
        <Stack gap="md">
          <Group justify="space-between">
            <Skeleton height={32} width={100} radius="sm" />
            <Skeleton height={24} width={60} radius="sm" />
          </Group>
          <Skeleton height={8} radius="xl" />
          <Group gap="xs">
            <Skeleton height={20} width={80} radius="sm" />
            <Skeleton height={20} width={80} radius="sm" />
          </Group>
        </Stack>
      );

    case 'chart':
      return (
        <Stack gap="sm" h="100%">
          <Group justify="space-between">
            <Skeleton height={20} width={120} radius="sm" />
            <Skeleton height={16} width={80} radius="sm" />
          </Group>
          <Box style={{ flex: 1, minHeight: 100 }}>
            <Skeleton height="100%" radius="sm" />
          </Box>
        </Stack>
      );

    case 'grid':
      return (
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} height={60} radius="sm" />
          ))}
        </Box>
      );

    default:
      return (
        <Stack gap="sm">
          <Skeleton height={20} width="60%" radius="sm" />
          <Skeleton height={16} width="80%" radius="sm" />
          <Skeleton height={16} width="40%" radius="sm" />
          {rows > 3 && <Skeleton height={60} radius="sm" />}
        </Stack>
      );
  }
}

/**
 * Docker widget skeleton
 */
export function DockerWidgetSkeleton() {
  return (
    <Stack gap="xs" h="100%">
      <Group justify="space-between" mb="xs">
        <Skeleton height={18} width={100} radius="sm" />
        <Skeleton height={18} width={40} radius="sm" />
      </Group>
      {Array.from({ length: 5 }).map((_, i) => (
        <Group key={i} gap="sm" wrap="nowrap" p={4}>
          <Skeleton height={10} width={10} circle />
          <Skeleton height={14} style={{ flex: 1 }} radius="sm" />
          <Skeleton height={20} width={50} radius="sm" />
        </Group>
      ))}
    </Stack>
  );
}

/**
 * VM Status widget skeleton
 */
export function VMStatusWidgetSkeleton() {
  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Group gap="xs">
          <Skeleton height={20} width={20} circle />
          <Skeleton height={18} width={100} radius="sm" />
        </Group>
        <Skeleton height={16} width={60} radius="sm" />
      </Group>
      <Stack gap="xs">
        <Group justify="space-between">
          <Skeleton height={14} width={40} radius="sm" />
          <Skeleton height={14} width={50} radius="sm" />
        </Group>
        <Skeleton height={6} radius="xl" />
        <Group justify="space-between">
          <Skeleton height={14} width={40} radius="sm" />
          <Skeleton height={14} width={50} radius="sm" />
        </Group>
        <Skeleton height={6} radius="xl" />
        <Group justify="space-between">
          <Skeleton height={14} width={40} radius="sm" />
          <Skeleton height={14} width={50} radius="sm" />
        </Group>
        <Skeleton height={6} radius="xl" />
      </Stack>
    </Stack>
  );
}

/**
 * Uptime/Ping widget skeleton
 */
export function PingWidgetSkeleton() {
  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Skeleton height={18} width={80} radius="sm" />
        <Skeleton height={24} width={60} radius="sm" />
      </Group>
      <Skeleton height={60} radius="sm" />
      <Group justify="space-around">
        <Stack gap={4} align="center">
          <Skeleton height={12} width={50} radius="sm" />
          <Skeleton height={16} width={40} radius="sm" />
        </Stack>
        <Stack gap={4} align="center">
          <Skeleton height={12} width={50} radius="sm" />
          <Skeleton height={16} width={40} radius="sm" />
        </Stack>
      </Group>
    </Stack>
  );
}

/**
 * Vikunja widget skeleton
 */
export function VikunjaWidgetSkeleton() {
  return (
    <Stack gap="xs" h="100%">
      <Group justify="space-between" mb="xs">
        <Skeleton height={18} width={80} radius="sm" />
        <Skeleton height={20} width={30} radius="sm" />
      </Group>
      {Array.from({ length: 4 }).map((_, i) => (
        <Group key={i} gap="sm" wrap="nowrap" py={4}>
          <Skeleton height={16} width={16} radius="sm" />
          <Skeleton height={14} style={{ flex: 1 }} radius="sm" />
          <Skeleton height={18} width={50} radius="sm" />
        </Group>
      ))}
    </Stack>
  );
}

/**
 * CrowdSec widget skeleton
 */
export function CrowdSecWidgetSkeleton() {
  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Skeleton height={24} width={60} radius="sm" />
        <Skeleton height={18} width={80} radius="sm" />
      </Group>
      <Skeleton height={40} radius="sm" />
      <Stack gap="xs">
        {Array.from({ length: 3 }).map((_, i) => (
          <Group key={i} justify="space-between">
            <Skeleton height={14} width={100} radius="sm" />
            <Skeleton height={14} width={40} radius="sm" />
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * Logs widget skeleton
 */
export function LogsWidgetSkeleton() {
  return (
    <Stack gap="xs" h="100%">
      <Group justify="space-between" mb="xs">
        <Skeleton height={18} width={100} radius="sm" />
        <Skeleton height={24} width={80} radius="sm" />
      </Group>
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={14} width={`${70 + Math.random() * 30}%`} radius="sm" />
        ))}
      </Box>
    </Stack>
  );
}

/**
 * RSS widget skeleton
 */
export function RssWidgetSkeleton() {
  return (
    <Stack gap="sm" h="100%">
      {Array.from({ length: 4 }).map((_, i) => (
        <Box key={i} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
          <Skeleton height={16} width="90%" radius="sm" mb={6} />
          <Skeleton height={12} width="60%" radius="sm" />
        </Box>
      ))}
    </Stack>
  );
}

/**
 * Calendar widget skeleton
 */
export function CalendarWidgetSkeleton() {
  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Skeleton height={20} width={120} radius="sm" />
        <Group gap="xs">
          <Skeleton height={24} width={24} radius="sm" />
          <Skeleton height={24} width={24} radius="sm" />
        </Group>
      </Group>
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`h-${i}`} height={14} radius="sm" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={`d-${i}`} height={28} radius="sm" />
        ))}
      </Box>
    </Stack>
  );
}

/**
 * Notes widget skeleton
 */
export function NotesWidgetSkeleton() {
  return (
    <Stack gap="sm" h="100%">
      <Skeleton height={32} radius="sm" />
      <Skeleton height="100%" style={{ minHeight: 100 }} radius="sm" />
    </Stack>
  );
}
