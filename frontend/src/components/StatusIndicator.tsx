'use client';

import { Tooltip, Box } from '@mantine/core';
import { URLStatus } from '@/lib/api';
import { getStatusColor, getStatusLabel } from '@/hooks/useUrlStatus';

interface StatusIndicatorProps {
  status: URLStatus | undefined;
  size?: 'xs' | 'sm' | 'md';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showPulse?: boolean;
}

const sizeMap = {
  xs: 8,
  sm: 10,
  md: 12,
};

const positionMap = {
  'top-left': { top: 8, left: 8 },
  'top-right': { top: 8, right: 8 },
  'bottom-left': { bottom: 8, left: 8 },
  'bottom-right': { bottom: 8, right: 8 },
};

export function StatusIndicator({
  status,
  size = 'sm',
  position = 'top-right',
  showPulse = true,
}: StatusIndicatorProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  const dotSize = sizeMap[size];
  const positionStyles = positionMap[position];

  const colorMap: Record<string, { bg: string; pulse: string }> = {
    green: { bg: 'bg-green-500', pulse: 'bg-green-400' },
    red: { bg: 'bg-red-500', pulse: 'bg-red-400' },
    gray: { bg: 'bg-gray-400', pulse: 'bg-gray-300' },
  };

  const colors = colorMap[color] || colorMap.gray;
  const isLoading = !status;
  const isUp = status?.is_up;

  return (
    <Tooltip label={label} position="top" withArrow>
      <Box
        style={{
          position: 'absolute',
          ...positionStyles,
          zIndex: 10,
          width: dotSize,
          height: dotSize,
        }}
      >
        {/* Pulse animation for online status */}
        {showPulse && isUp && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${colors.pulse} opacity-75 animate-ping`}
            style={{ animationDuration: '2s' }}
          />
        )}
        {/* Loading animation */}
        {isLoading && (
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-gray-300 opacity-75 animate-pulse"
          />
        )}
        {/* Status dot */}
        <span
          className={`relative inline-flex rounded-full h-full w-full ${colors.bg}`}
          style={{ width: dotSize, height: dotSize }}
        />
      </Box>
    </Tooltip>
  );
}

// Inline status badge variant
interface StatusBadgeProps {
  status: URLStatus | undefined;
  showLabel?: boolean;
}

export function StatusBadge({ status, showLabel = false }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  const colorMap: Record<string, string> = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };

  return (
    <Tooltip label={label} position="top" withArrow disabled={showLabel}>
      <div className="inline-flex items-center gap-1.5">
        <span
          className={`inline-block w-2 h-2 rounded-full ${colorMap[color]}`}
        />
        {showLabel && (
          <span className="text-xs text-gray-500">
            {status?.is_up ? 'En ligne' : 'Hors ligne'}
          </span>
        )}
      </div>
    </Tooltip>
  );
}
