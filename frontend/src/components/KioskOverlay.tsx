'use client';

import { useState, useEffect } from 'react';
import { Box, Text, Group, Badge, Progress, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
} from '@tabler/icons-react';
import { useKioskStore } from '@/lib/store';

interface KioskOverlayProps {
  currentTabName: string;
  timeUntilNext: number;
  totalTime: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
  onPrev: () => void;
  onNext: () => void;
  tabIndex: number;
  totalTabs: number;
}

export function KioskOverlay({
  currentTabName,
  timeUntilNext,
  totalTime,
  isPaused,
  onPause,
  onResume,
  onExit,
  onPrev,
  onNext,
  tabIndex,
  totalTabs,
}: KioskOverlayProps) {
  const { kioskShowClock, kioskAutoRotate } = useKioskStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHovered, setIsHovered] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Update clock every second
  useEffect(() => {
    if (!kioskShowClock) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [kioskShowClock]);

  // Auto-hide controls after 5 seconds of inactivity
  useEffect(() => {
    if (isHovered) {
      setShowControls(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isHovered]);

  // Show controls on mouse move
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const progressPercent = totalTime > 0 ? ((totalTime - timeUntilNext) / totalTime) * 100 : 0;

  return (
    <>
      {/* Top bar - always visible but subtle */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: showControls
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'
            : 'transparent',
          padding: showControls ? '12px 20px' : '4px 20px',
          transition: 'all 0.3s ease',
          pointerEvents: showControls ? 'auto' : 'none',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Group justify="space-between" align="center">
          {/* Left: Tab info */}
          <Group gap="md" style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s' }}>
            <Badge size="lg" variant="filled" color="blue">
              {currentTabName}
            </Badge>
            {totalTabs > 1 && (
              <Text size="sm" c="dimmed">
                {tabIndex + 1} / {totalTabs}
              </Text>
            )}
          </Group>

          {/* Center: Controls */}
          <Group
            gap="xs"
            style={{
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.3s',
              pointerEvents: showControls ? 'auto' : 'none',
            }}
          >
            {totalTabs > 1 && (
              <>
                <Tooltip label="Onglet précédent (←)">
                  <ActionIcon variant="subtle" color="white" onClick={onPrev}>
                    <IconChevronLeft size={20} />
                  </ActionIcon>
                </Tooltip>

                {kioskAutoRotate && (
                  <Tooltip label={isPaused ? 'Reprendre (Espace)' : 'Pause (Espace)'}>
                    <ActionIcon
                      variant="subtle"
                      color="white"
                      onClick={isPaused ? onResume : onPause}
                    >
                      {isPaused ? <IconPlayerPlay size={20} /> : <IconPlayerPause size={20} />}
                    </ActionIcon>
                  </Tooltip>
                )}

                <Tooltip label="Onglet suivant (→)">
                  <ActionIcon variant="subtle" color="white" onClick={onNext}>
                    <IconChevronRight size={20} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}

            <Tooltip label="Quitter (Échap)">
              <ActionIcon variant="subtle" color="red" onClick={onExit}>
                <IconX size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Right: Clock */}
          {kioskShowClock && (
            <Group
              gap="xs"
              style={{ opacity: showControls ? 1 : 0.6, transition: 'opacity 0.3s' }}
            >
              <IconClock size={16} style={{ color: 'white' }} />
              <Text size="lg" fw={600} c="white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {currentTime.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </Group>
          )}
        </Group>

        {/* Progress bar for auto-rotation */}
        {kioskAutoRotate && totalTabs > 1 && !isPaused && (
          <Progress
            value={progressPercent}
            size="xs"
            color="blue"
            style={{
              marginTop: 8,
              opacity: showControls ? 0.8 : 0.3,
              transition: 'opacity 0.3s',
            }}
          />
        )}
      </Box>

      {/* Keyboard hints - bottom left, very subtle */}
      <Box
        style={{
          position: 'fixed',
          bottom: 12,
          left: 12,
          zIndex: 1000,
          opacity: showControls ? 0.5 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: 'none',
        }}
      >
        <Text size="xs" c="dimmed">
          Échap: quitter • Espace: pause • ←→: naviguer
        </Text>
      </Box>
    </>
  );
}
