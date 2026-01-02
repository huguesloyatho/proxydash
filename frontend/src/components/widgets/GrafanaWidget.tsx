'use client';

import { useMemo, useState } from 'react';
import { Box, Text, Center, Loader, ActionIcon, Tooltip, Group } from '@mantine/core';
import { IconRefresh, IconExternalLink, IconAlertCircle } from '@tabler/icons-react';

interface GrafanaWidgetProps {
  widgetId?: number;
  config: Record<string, unknown>;
  size?: 'small' | 'medium' | 'large';
  rowSpan?: number;
  colSpan?: number;
  onDataReady?: (data: unknown) => void;
}

export function GrafanaWidget({
  widgetId,
  config,
  size = 'medium',
  rowSpan = 1,
  colSpan = 1,
  onDataReady,
}: GrafanaWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Build the Grafana embed URL
  const embedUrl = useMemo(() => {
    const grafanaUrl = (config.grafana_url as string)?.replace(/\/$/, '');
    const dashboardUid = config.dashboard_uid as string;
    const panelId = config.panel_id as string;

    if (!grafanaUrl || !dashboardUid || !panelId) {
      return null;
    }

    // Build base URL for panel embed
    // Format: {grafana_url}/d-solo/{dashboard_uid}?panelId={panel_id}&...
    const url = new URL(`${grafanaUrl}/d-solo/${dashboardUid}`);

    // Add panel ID
    url.searchParams.set('panelId', panelId);

    // Organization ID
    if (config.org_id) {
      url.searchParams.set('orgId', String(config.org_id));
    }

    // Theme
    const theme = (config.theme as string) || 'dark';
    url.searchParams.set('theme', theme);

    // Time range
    const from = (config.from as string) || 'now-6h';
    const to = (config.to as string) || 'now';
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);

    // Refresh rate
    if (config.refresh) {
      url.searchParams.set('refresh', config.refresh as string);
    }

    // Timezone
    if (config.timezone && config.timezone !== 'browser') {
      url.searchParams.set('tz', config.timezone as string);
    }

    // Variables (format: var-name=value)
    const variables = config.variables as string;
    if (variables) {
      variables.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          const [name, value] = trimmed.split('=');
          if (name && value) {
            url.searchParams.set(`var-${name.trim()}`, value.trim());
          }
        }
      });
    }

    // Kiosk mode for cleaner embed (no header/footer)
    url.searchParams.set('kiosk', '1');

    return url.toString();
  }, [config, refreshKey]);

  // Dashboard URL for external link
  const dashboardUrl = useMemo(() => {
    const grafanaUrl = (config.grafana_url as string)?.replace(/\/$/, '');
    const dashboardUid = config.dashboard_uid as string;
    if (!grafanaUrl || !dashboardUid) return null;
    return `${grafanaUrl}/d/${dashboardUid}`;
  }, [config]);

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    setRefreshKey((k) => k + 1);
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    if (onDataReady) {
      onDataReady({
        grafana_url: config.grafana_url,
        dashboard_uid: config.dashboard_uid,
        panel_id: config.panel_id,
        loaded_at: new Date().toISOString(),
      });
    }
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!embedUrl) {
    return (
      <Center h="100%">
        <Box ta="center">
          <IconAlertCircle size={32} color="var(--mantine-color-yellow-6)" />
          <Text size="sm" c="dimmed" mt="xs">
            Configuration Grafana incomplète
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Renseignez l'URL Grafana, l'UID du dashboard et l'ID du panel
          </Text>
        </Box>
      </Center>
    );
  }

  if (hasError) {
    return (
      <Center h="100%">
        <Box ta="center">
          <IconAlertCircle size={32} color="var(--mantine-color-red-6)" />
          <Text size="sm" c="dimmed" mt="xs">
            Impossible de charger le panel Grafana
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Vérifiez la configuration et les permissions CORS
          </Text>
          <ActionIcon
            variant="light"
            color="blue"
            size="sm"
            mt="sm"
            onClick={handleRefresh}
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Box>
      </Center>
    );
  }

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: config.transparent ? 'transparent' : undefined,
      }}
    >
      {/* Controls overlay */}
      <Group
        gap={4}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 10,
          opacity: 0.7,
        }}
        className="hover:opacity-100 transition-opacity"
      >
        <Tooltip label="Rafraîchir">
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={handleRefresh}
          >
            <IconRefresh size={12} />
          </ActionIcon>
        </Tooltip>
        {dashboardUrl && (
          <Tooltip label="Ouvrir dans Grafana">
            <ActionIcon
              variant="subtle"
              size="xs"
              component="a"
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconExternalLink size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {/* Loading overlay */}
      {isLoading && (
        <Center
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 5,
          }}
        >
          <Loader size="sm" />
        </Center>
      )}

      {/* Grafana iframe */}
      <iframe
        key={refreshKey}
        src={embedUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: 'var(--mantine-radius-sm)',
        }}
        title="Grafana Panel"
        onLoad={handleLoad}
        onError={handleError}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </Box>
  );
}
