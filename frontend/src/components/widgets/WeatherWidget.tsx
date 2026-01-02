'use client';

import { useEffect, useState } from 'react';
import { Text, Stack, Group, Loader, Center } from '@mantine/core';
import {
  IconSun,
  IconCloud,
  IconCloudRain,
  IconCloudSnow,
  IconCloudStorm,
  IconMist,
  IconWind,
  IconDroplet,
} from '@tabler/icons-react';
import { widgetsApi } from '@/lib/api';

interface WeatherData {
  temp: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  city: string;
  country?: string;
  error?: string;
}

interface WeatherWidgetProps {
  widgetId?: number;  // Optional - if not provided, uses config directly
  config?: {
    city?: string;
    api_key?: string;
    units?: 'metric' | 'imperial';
  };
  size?: 'small' | 'medium' | 'large';
}

const weatherIcons: Record<string, React.ReactNode> = {
  '01d': <IconSun size={48} className="text-yellow-500" />,
  '01n': <IconSun size={48} className="text-yellow-300" />,
  '02d': <IconCloud size={48} className="text-gray-400" />,
  '02n': <IconCloud size={48} className="text-gray-500" />,
  '03d': <IconCloud size={48} className="text-gray-400" />,
  '03n': <IconCloud size={48} className="text-gray-500" />,
  '04d': <IconCloud size={48} className="text-gray-500" />,
  '04n': <IconCloud size={48} className="text-gray-600" />,
  '09d': <IconCloudRain size={48} className="text-blue-400" />,
  '09n': <IconCloudRain size={48} className="text-blue-500" />,
  '10d': <IconCloudRain size={48} className="text-blue-400" />,
  '10n': <IconCloudRain size={48} className="text-blue-500" />,
  '11d': <IconCloudStorm size={48} className="text-purple-500" />,
  '11n': <IconCloudStorm size={48} className="text-purple-600" />,
  '13d': <IconCloudSnow size={48} className="text-blue-200" />,
  '13n': <IconCloudSnow size={48} className="text-blue-300" />,
  '50d': <IconMist size={48} className="text-gray-400" />,
  '50n': <IconMist size={48} className="text-gray-500" />,
};

export function WeatherWidget({ widgetId, config = {}, size = 'medium' }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { units = 'metric' } = config;
  const hasValidWidgetId = widgetId && widgetId > 0 && Number.isFinite(widgetId);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        if (!hasValidWidgetId) {
          setError('Widget ID manquant - veuillez reconfigurer le widget');
          setLoading(false);
          return;
        }

        if (!weather) setLoading(true);
        const response = await widgetsApi.getData(widgetId!);
        const data = response.data;

        if (data?.error) {
          // Handle specific API errors
          if (data.error.includes('401')) {
            setError('Clé API invalide. Vérifiez votre clé OpenWeatherMap.');
          } else if (data.error.includes('404')) {
            setError('Ville non trouvée');
          } else {
            setError(data.error);
          }
        } else if (data?.temp !== undefined) {
          setWeather(data);
          setError(null);
        } else {
          setError('Configuration requise');
        }
      } catch {
        setError('Impossible de charger la météo');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000); // Refresh every 15 minutes
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, hasValidWidgetId]);

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    );
  }

  if (error || !weather) {
    return (
      <Center h="100%">
        <Text size="sm" c="dimmed">
          {error || 'Configuration requise'}
        </Text>
      </Center>
    );
  }

  const tempUnit = units === 'metric' ? '°C' : '°F';
  const windUnit = units === 'metric' ? 'km/h' : 'mph';

  return (
    <Stack gap="xs" align="center" justify="center" h="100%">
      <Text size="sm" c="dimmed" fw={500}>
        {weather.city}
      </Text>

      <Group gap="md" align="center">
        {weatherIcons[weather.icon] || <IconCloud size={48} />}
        <Stack gap={0}>
          <Text size={size === 'large' ? 'xl' : 'lg'} fw={700}>
            {Math.round(weather.temp)}{tempUnit}
          </Text>
          <Text size="xs" c="dimmed" tt="capitalize">
            {weather.description}
          </Text>
        </Stack>
      </Group>

      {size !== 'small' && (
        <Group gap="lg" mt="xs">
          <Group gap={4}>
            <IconDroplet size={14} className="text-blue-400" />
            <Text size="xs">{weather.humidity}%</Text>
          </Group>
          <Group gap={4}>
            <IconWind size={14} className="text-gray-400" />
            <Text size="xs">{Math.round(weather.wind_speed)} {windUnit}</Text>
          </Group>
        </Group>
      )}

      {size === 'large' && (
        <Text size="xs" c="dimmed">
          Ressenti: {Math.round(weather.feels_like)}{tempUnit}
        </Text>
      )}
    </Stack>
  );
}
