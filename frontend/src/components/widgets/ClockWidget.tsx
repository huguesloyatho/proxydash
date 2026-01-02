'use client';

import { useState, useEffect } from 'react';
import { Text, Stack } from '@mantine/core';

interface ClockWidgetProps {
  config?: {
    timezone?: string;
    format_24h?: boolean;
    show_seconds?: boolean;
    show_date?: boolean;
  };
  size?: 'small' | 'medium' | 'large';
}

export function ClockWidget({ config = {}, size = 'medium' }: ClockWidgetProps) {
  const [time, setTime] = useState(new Date());

  const {
    timezone = 'Europe/Paris',
    format_24h = true,
    show_seconds = true,
    show_date = true,
  } = config;

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = () => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      ...(show_seconds && { second: '2-digit' }),
      hour12: !format_24h,
    };
    return time.toLocaleTimeString('fr-FR', options);
  };

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return time.toLocaleDateString('fr-FR', options);
  };

  const timeSize = size === 'large' ? 48 : size === 'medium' ? 36 : 24;
  const dateSize = size === 'large' ? 'lg' : size === 'medium' ? 'md' : 'sm';

  return (
    <Stack gap="xs" align="center" justify="center" h="100%">
      <Text
        fw={700}
        style={{ fontSize: timeSize, fontFamily: 'monospace' }}
        className="tabular-nums"
      >
        {formatTime()}
      </Text>
      {show_date && (
        <Text size={dateSize} c="dimmed" tt="capitalize">
          {formatDate()}
        </Text>
      )}
    </Stack>
  );
}
