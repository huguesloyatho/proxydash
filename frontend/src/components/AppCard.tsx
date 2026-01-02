'use client';

import { Card, Image, Text, Tooltip, ActionIcon, Group, Badge, Box } from '@mantine/core';
import { IconEdit, IconExternalLink, IconWorld, IconWorldOff, IconEyeOff, IconAlertTriangle } from '@tabler/icons-react';
import { Application } from '@/types';
import { useUIStore } from '@/lib/store';
import { applicationsApi, URLStatus } from '@/lib/api';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusIndicator } from './StatusIndicator';

// Applications sensibles qui nécessitent une protection 2FA
// Ces types d'applications contiennent des données sensibles ou permettent des actions critiques
const SENSITIVE_APP_TYPES = [
  // Administration et infrastructure
  'portainer', 'portainer-ce', 'portainer-be',
  'proxmox', 'pve',
  'truenas', 'freenas',
  'unraid',
  'cockpit',
  'webmin',
  'opnsense', 'pfsense',
  'nginx-proxy-manager', 'npm',
  'traefik',
  'caddy',

  // Bases de données et stockage
  'phpmyadmin',
  'pgadmin', 'pgadmin4',
  'adminer',
  'mongo-express',
  'redis-commander',
  'minio',
  'nextcloud',
  'owncloud',
  'seafile',
  'syncthing',

  // Sécurité et accès
  'vaultwarden', 'bitwarden',
  'keycloak',
  'authentik',
  'ldap', 'openldap',
  'guacamole',
  'teleport',
  'headscale', 'headscale-ui',
  'wireguard',
  'vpn',

  // CI/CD et développement
  'gitlab',
  'gitea',
  'gogs',
  'jenkins',
  'drone',
  'argocd',
  'rancher',
  'kubernetes', 'k8s',

  // Monitoring avec accès sensible
  'grafana',
  'kibana',
  'graylog',

  // Communication et productivité
  'mailu',
  'mailcow',
  'roundcube',
  'vikunja',
  'bookstack',
  'wiki', 'wikijs',

  // Finance et comptabilité
  'firefly', 'firefly-iii',
  'actual', 'actual-budget',
  'invoice-ninja',

  // Domotique avec accès critique
  'home-assistant', 'homeassistant', 'hass',
  'openhab',
  'domoticz',
];

// Applications avec 2FA natif intégré (pas besoin d'Authelia)
const APPS_WITH_NATIVE_2FA = [
  'vaultwarden', 'bitwarden',
  'nextcloud',
  'gitlab',
  'gitea',
  'authentik',
  'keycloak',
  'proxmox', 'pve',
  'truenas',
  'guacamole',
  'grafana',
  'portainer', 'portainer-ce', 'portainer-be',
  'home-assistant', 'homeassistant', 'hass',
];

/**
 * Extrait le domaine principal (ex: masenam.fr, masenam.com) de l'URL
 */
function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      // Retourne les 2 dernières parties (ex: masenam.fr)
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Vérifie si une application est sensible et non protégée
 * Retourne true si l'app est sensible, n'a pas de 2FA natif, et n'est pas protégée par Authelia
 */
function isSensitiveAndUnprotected(app: Application): boolean {
  const appType = (app.detected_type || '').toLowerCase();
  const appName = app.name.toLowerCase();

  // Vérifie si c'est une app sensible (par type ou par nom)
  const isSensitive = SENSITIVE_APP_TYPES.some(
    type => appType.includes(type) || appName.includes(type)
  );

  if (!isSensitive) return false;

  // Vérifie si l'app a un 2FA natif
  const hasNative2FA = APPS_WITH_NATIVE_2FA.some(
    type => appType.includes(type) || appName.includes(type)
  );

  if (hasNative2FA) return false;

  // L'app est sensible, n'a pas de 2FA natif, vérifie si Authelia la protège
  return !app.is_authelia_protected;
}

interface AppCardProps {
  app: Application;
  isAdmin?: boolean;
  urlStatus?: URLStatus;
}

export function AppCard({ app, isAdmin = false, urlStatus }: AppCardProps) {
  const setEditingApp = useUIStore((state) => state.setEditingApp);
  const queryClient = useQueryClient();

  const togglePublicMutation = useMutation({
    mutationFn: (isPublic: boolean) => applicationsApi.update(app.id, { is_public: isPublic }),
    onSuccess: (_, isPublic) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      notifications.show({
        title: isPublic ? 'Application publique' : 'Application privée',
        message: isPublic
          ? `${app.name} est maintenant visible publiquement`
          : `${app.name} est maintenant privée`,
        color: isPublic ? 'green' : 'orange',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier la visibilité',
        color: 'red',
      });
    },
  });

  const hideAppMutation = useMutation({
    mutationFn: () => applicationsApi.update(app.id, { is_visible: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      notifications.show({
        title: 'Application masquée',
        message: `${app.name} a été masquée. Vous pouvez la réafficher depuis la gestion des applications.`,
        color: 'blue',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de masquer l\'application',
        color: 'red',
      });
    },
  });

  const handleClick = () => {
    window.open(app.url, '_blank', 'noopener,noreferrer');
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingApp(app.id);
  };

  const handleTogglePublic = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePublicMutation.mutate(!app.is_public);
  };

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    hideAppMutation.mutate();
  };

  const cardContent = (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 hover:border-blue-400 relative group"
      onClick={handleClick}
      style={{ height: '160px' }}
    >
      {isAdmin && (
        <Group
          gap={4}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Tooltip label="Masquer" position="top">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={handleHide}
              loading={hideAppMutation.isPending}
            >
              <IconEyeOff size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={app.is_public ? 'Rendre privée' : 'Rendre publique'} position="top">
            <ActionIcon
              variant={app.is_public ? 'filled' : 'subtle'}
              size="sm"
              color={app.is_public ? 'green' : 'gray'}
              onClick={handleTogglePublic}
              loading={togglePublicMutation.isPending}
            >
              {app.is_public ? <IconWorld size={14} /> : <IconWorldOff size={14} />}
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleEdit}
          >
            <IconEdit size={16} />
          </ActionIcon>
        </Group>
      )}

      {/* Status indicator - always top-left */}
      <StatusIndicator
        status={urlStatus}
        size="sm"
        position="top-left"
      />

      {/* Public indicator badge - next to status indicator */}
      {app.is_public && (
        <Badge
          size="xs"
          variant="filled"
          color="green"
          className="absolute top-2 left-6"
          leftSection={<IconWorld size={10} />}
        >
          Public
        </Badge>
      )}

      {/* Domain indicator - bottom right of card */}
      {extractDomain(app.url) && (
        <Tooltip label={app.url} position="top">
          <Badge
            size="xs"
            variant="filled"
            color="dark"
            className="absolute bottom-2 right-2"
            style={{ fontSize: '9px', padding: '2px 6px' }}
          >
            {extractDomain(app.url)}
          </Badge>
        </Tooltip>
      )}

      {/* Security warning indicator */}
      {isSensitiveAndUnprotected(app) && (
        <Tooltip
          label="Application sensible sans protection 2FA. Activez Authelia ou configurez le 2FA natif."
          position="right"
          withArrow
          multiline
          w={220}
          color="red"
        >
          <Box
            className="absolute bottom-2 right-2 z-10 cursor-help"
            style={{
              animation: 'pulse 2s infinite',
            }}
          >
            <div className="flex items-center justify-center w-6 h-6 bg-red-500 rounded-full shadow-lg">
              <IconAlertTriangle size={14} className="text-white" />
            </div>
          </Box>
        </Tooltip>
      )}

      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="relative">
          {app.icon ? (
            <Image
              src={app.icon}
              alt={app.name}
              w={48}
              h={48}
              fit="contain"
              fallbackSrc="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/default.svg"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
              <IconExternalLink size={24} className="text-gray-500" />
            </div>
          )}
          {/* Authelia badge */}
          {app.is_authelia_protected && (
            <Tooltip label="Protégé par Authelia" position="right">
              <div className="absolute -bottom-1 -right-1">
                <Image
                  src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/authelia.svg"
                  alt="Authelia"
                  w={18}
                  h={18}
                  className="rounded-full bg-white shadow-sm"
                />
              </div>
            </Tooltip>
          )}
        </div>

        <Text fw={500} size="sm" ta="center" lineClamp={2}>
          {app.name}
        </Text>

        {app.is_manual && (
          <Badge size="xs" variant="light" color="grape">
            Manuel
          </Badge>
        )}
      </div>
    </Card>
  );

  if (app.description) {
    return (
      <Tooltip
        label={app.description}
        position="bottom"
        withArrow
        multiline
        w={220}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
}
