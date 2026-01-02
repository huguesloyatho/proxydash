'use client';

import { useEffect } from 'react';
import {
  Modal,
  TextInput,
  Select,
  NumberInput,
  Switch,
  Text,
  Divider,
  Stack,
  Button,
  Group,
  PasswordInput,
  Alert,
  Textarea,
  SegmentedControl,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconInfoCircle } from '@tabler/icons-react';
import { ServerSelect } from './ServerSelect';

// TabWidget interface (matches CustomTabContent)
export interface TabWidget {
  id: string;
  widget_type: string;
  title: string | null;
  position: number;
  size: 'small' | 'medium' | 'large';
  col_span: number;
  row_span: number;
  config: Record<string, unknown>;
  is_visible: boolean;
  is_public: boolean;
  source_widget_id?: number;
  db_widget_id?: number;  // Real DB widget ID for data persistence
}

interface TabWidgetConfigModalProps {
  widget: TabWidget | null;
  opened: boolean;
  onClose: () => void;
  onSave: (widgetId: string, updates: Partial<TabWidget>) => void;
}

interface FormValues {
  title: string;
  size: 'small' | 'medium' | 'large';
  col_span: number;
  row_span: number;
  // Clock config
  timezone?: string;
  format_24h?: boolean;
  show_seconds?: boolean;
  show_date?: boolean;
  // Calendar config
  first_day_monday?: boolean;
  ical_urls?: string;
  show_events_list?: boolean;
  days_ahead?: number;
  // Weather config
  city?: string;
  api_key?: string;
  units?: 'metric' | 'imperial';
  // Server selection (for widgets using SSH)
  connection_mode?: 'server' | 'manual';
  server_id?: number | null;
  // VM Status config
  vm_name?: string;
  vm_host?: string;
  check_ports?: string;
  icon_url?: string;
  vm_description?: string;
  ssh_enabled?: boolean;
  ssh_port?: number;
  ssh_user?: string;
  ssh_key?: string;
  ssh_password?: string;
  show_docker?: boolean;
  // Vikunja config
  vikunja_api_url?: string;
  vikunja_api_token?: string;
  vikunja_project_id?: number;
  vikunja_show_completed?: boolean;
  vikunja_max_tasks?: number;
  vikunja_filter?: string;
  // Proxmox config
  proxmox_host?: string;
  proxmox_token_id?: string;
  proxmox_token_secret?: string;
  node_name?: string;
  vm_id?: number;
  // CrowdSec config
  crowdsec_api_url?: string;
  crowdsec_api_key?: string;
  crowdsec_max_decisions?: number;
  crowdsec_max_alerts?: number;
  crowdsec_show_metrics?: boolean;
  crowdsec_show_decisions?: boolean;
  crowdsec_show_alerts?: boolean;
  crowdsec_refresh_interval?: number;
  // Uptime/Ping config
  ping_targets?: string;
  ping_target_names?: string;
  ping_count?: number;
  ping_interval?: number;
  ping_timeout?: number;
  ping_history_hours?: number;
  ping_graph_height?: number;
  ping_show_jitter?: boolean;
  ping_show_packet_loss?: boolean;
  ping_show_statistics?: boolean;
  ping_latency_warning?: number;
  ping_latency_critical?: number;
  ping_loss_warning?: number;
  ping_loss_critical?: number;
  // Iframe config
  url?: string;
  // Docker config
  docker_containers?: string;
  docker_show_stats?: boolean;
  docker_show_actions?: boolean;
  docker_refresh_interval?: number;
  // Logs config
  logs_container_name?: string;
  logs_max_lines?: number;
  logs_auto_scroll?: boolean;
  logs_show_timestamps?: boolean;
  logs_filter_pattern?: string;
  logs_refresh_interval?: number;
  // RSS config
  rss_feed_urls?: string;
  rss_max_display?: number;
  rss_max_articles_per_feed?: number;
  rss_show_images?: boolean;
  rss_show_summary?: boolean;
  rss_show_author?: boolean;
  rss_show_date?: boolean;
  rss_show_source?: boolean;
  rss_open_in_new_tab?: boolean;
  rss_refresh_interval?: number;
  rss_compact_mode?: boolean;
}

const sizeOptions = [
  { value: 'small', label: 'Petit' },
  { value: 'medium', label: 'Moyen' },
  { value: 'large', label: 'Grand' },
];

const timezoneOptions = [
  { value: 'Europe/Paris', label: 'Paris (Europe/Paris)' },
  { value: 'Europe/London', label: 'Londres (Europe/London)' },
  { value: 'America/New_York', label: 'New York (America/New_York)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (America/Los_Angeles)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (Asia/Tokyo)' },
  { value: 'UTC', label: 'UTC' },
];

const widgetTypeLabels: Record<string, string> = {
  clock: 'Horloge',
  calendar: 'Calendrier',
  weather: 'Météo',
  proxmox_node: 'Noeud Proxmox',
  proxmox_vm: 'VM Proxmox',
  proxmox_summary: 'Résumé Proxmox',
  vm_status: 'VM / Serveur',
  vikunja: 'Vikunja',
  crowdsec: 'CrowdSec',
  uptime_ping: 'Uptime / Ping',
  docker: 'Docker',
  logs: 'Logs Docker',
  iframe: 'Iframe',
  rss_feed: 'Flux RSS',
};

const defaultValues: FormValues = {
  title: '',
  size: 'medium',
  col_span: 1,
  row_span: 1,
  timezone: 'Europe/Paris',
  format_24h: true,
  show_seconds: true,
  show_date: true,
  first_day_monday: true,
  ical_urls: '',
  show_events_list: true,
  days_ahead: 7,
  city: '',
  api_key: '',
  units: 'metric',
  // Server selection
  connection_mode: 'manual',
  server_id: null,
  // VM Status
  vm_name: '',
  vm_host: '',
  check_ports: '',
  icon_url: '',
  vm_description: '',
  ssh_enabled: false,
  ssh_port: 22,
  ssh_user: 'root',
  ssh_key: '',
  ssh_password: '',
  show_docker: true,
  vikunja_api_url: '',
  vikunja_api_token: '',
  vikunja_project_id: 0,
  vikunja_show_completed: false,
  vikunja_max_tasks: 10,
  vikunja_filter: 'all',
  proxmox_host: '',
  proxmox_token_id: '',
  proxmox_token_secret: '',
  node_name: '',
  vm_id: undefined,
  crowdsec_api_url: '',
  crowdsec_api_key: '',
  crowdsec_max_decisions: 10,
  crowdsec_max_alerts: 10,
  crowdsec_show_metrics: true,
  crowdsec_show_decisions: true,
  crowdsec_show_alerts: true,
  crowdsec_refresh_interval: 60,
  ping_targets: '',
  ping_target_names: '',
  ping_count: 5,
  ping_interval: 60,
  ping_timeout: 5,
  ping_history_hours: 24,
  ping_graph_height: 100,
  ping_show_jitter: true,
  ping_show_packet_loss: true,
  ping_show_statistics: true,
  ping_latency_warning: 100,
  ping_latency_critical: 500,
  ping_loss_warning: 5,
  ping_loss_critical: 20,
  url: '',
  // Docker defaults
  docker_containers: '',
  docker_show_stats: true,
  docker_show_actions: true,
  docker_refresh_interval: 30,
  // Logs defaults
  logs_container_name: '',
  logs_max_lines: 100,
  logs_auto_scroll: true,
  logs_show_timestamps: true,
  logs_filter_pattern: '',
  logs_refresh_interval: 5,
  // RSS defaults
  rss_feed_urls: '',
  rss_max_display: 10,
  rss_max_articles_per_feed: 20,
  rss_show_images: true,
  rss_show_summary: true,
  rss_show_author: false,
  rss_show_date: true,
  rss_show_source: true,
  rss_open_in_new_tab: true,
  rss_refresh_interval: 300,
  rss_compact_mode: false,
};

export function TabWidgetConfigModal({
  widget,
  opened,
  onClose,
  onSave,
}: TabWidgetConfigModalProps) {
  const form = useForm<FormValues>({
    initialValues: defaultValues,
  });

  // Load widget values when opened
  useEffect(() => {
    if (widget && opened) {
      const config = widget.config || {};
      form.setValues({
        title: widget.title || '',
        size: widget.size,
        col_span: widget.col_span || 1,
        row_span: widget.row_span || 1,
        timezone: (config.timezone as string) || 'Europe/Paris',
        format_24h: config.format_24h !== false,
        show_seconds: config.show_seconds !== false,
        show_date: config.show_date !== false,
        first_day_monday: config.first_day_monday !== false,
        ical_urls: (config.ical_urls as string) || '',
        show_events_list: config.show_events_list !== false,
        days_ahead: (config.days_ahead as number) || 7,
        city: (config.city as string) || '',
        api_key: (config.api_key as string) || '',
        units: (config.units as 'metric' | 'imperial') || 'metric',
        // Server selection
        connection_mode: config.server_id ? 'server' : 'manual',
        server_id: (config.server_id as number) || null,
        // VM Status
        vm_name: (config.name as string) || '',
        vm_host: (config.host as string) || '',
        check_ports: (config.check_ports as string) || '',
        icon_url: (config.icon_url as string) || '',
        vm_description: (config.description as string) || '',
        ssh_enabled: config.ssh_enabled === true,
        ssh_port: (config.ssh_port as number) || 22,
        ssh_user: (config.ssh_user as string) || 'root',
        ssh_key: (config.ssh_key as string) || '',
        ssh_password: (config.ssh_password as string) || '',
        show_docker: config.show_docker !== false,
        vikunja_api_url: (config.api_url as string) || '',
        vikunja_api_token: (config.api_token as string) || '',
        vikunja_project_id: (config.project_id as number) || 0,
        vikunja_show_completed: config.show_completed === true,
        vikunja_max_tasks: (config.max_tasks as number) || 10,
        vikunja_filter: (config.filter as string) || 'all',
        proxmox_host: (config.host as string) || '',
        proxmox_token_id: (config.api_token_id as string) || '',
        proxmox_token_secret: (config.api_token_secret as string) || '',
        node_name: (config.node as string) || '',
        vm_id: config.vmid as number | undefined,
        crowdsec_api_url: (config.api_url as string) || '',
        crowdsec_api_key: (config.api_key as string) || '',
        crowdsec_max_decisions: (config.max_decisions as number) || 10,
        crowdsec_max_alerts: (config.max_alerts as number) || 10,
        crowdsec_show_metrics: config.show_metrics !== false,
        crowdsec_show_decisions: config.show_decisions !== false,
        crowdsec_show_alerts: config.show_alerts !== false,
        crowdsec_refresh_interval: (config.refresh_interval as number) || 60,
        ping_targets: (config.targets as string) || '',
        ping_target_names: (config.target_names as string) || '',
        ping_count: (config.ping_count as number) || 5,
        ping_interval: (config.ping_interval as number) || 60,
        ping_timeout: (config.ping_timeout as number) || 5,
        ping_history_hours: (config.history_hours as number) || 24,
        ping_graph_height: (config.graph_height as number) || 100,
        ping_show_jitter: config.show_jitter !== false,
        ping_show_packet_loss: config.show_packet_loss !== false,
        ping_show_statistics: config.show_statistics !== false,
        ping_latency_warning: (config.latency_warning as number) || 100,
        ping_latency_critical: (config.latency_critical as number) || 500,
        ping_loss_warning: (config.loss_warning as number) || 5,
        ping_loss_critical: (config.loss_critical as number) || 20,
        url: (config.url as string) || '',
        // Docker
        docker_containers: (config.containers as string) || '',
        docker_show_stats: config.show_stats !== false,
        docker_show_actions: config.show_actions !== false,
        docker_refresh_interval: (config.refresh_interval as number) || 30,
        // Logs
        logs_container_name: (config.container_name as string) || '',
        logs_max_lines: (config.max_lines as number) || 100,
        logs_auto_scroll: config.auto_scroll !== false,
        logs_show_timestamps: config.show_timestamps !== false,
        logs_filter_pattern: (config.filter_pattern as string) || '',
        logs_refresh_interval: (config.refresh_interval as number) || 5,
        // RSS
        rss_feed_urls: Array.isArray(config.feed_urls) ? (config.feed_urls as string[]).join('\n') : (config.feed_urls as string) || '',
        rss_max_display: (config.max_display as number) || 10,
        rss_max_articles_per_feed: (config.max_articles_per_feed as number) || 20,
        rss_show_images: config.show_images !== false,
        rss_show_summary: config.show_summary !== false,
        rss_show_author: config.show_author === true,
        rss_show_date: config.show_date !== false,
        rss_show_source: config.show_source !== false,
        rss_open_in_new_tab: config.open_in_new_tab !== false,
        rss_refresh_interval: (config.refresh_interval as number) || 300,
        rss_compact_mode: config.compact_mode === true,
      });
    }
  }, [widget, opened]);

  const buildConfig = (values: FormValues, widgetType: string): Record<string, unknown> => {
    switch (widgetType) {
      case 'clock':
        return {
          timezone: values.timezone,
          format_24h: values.format_24h,
          show_seconds: values.show_seconds,
          show_date: values.show_date,
        };
      case 'calendar':
        return {
          timezone: values.timezone,
          first_day_monday: values.first_day_monday,
          ical_urls: values.ical_urls,
          show_events_list: values.show_events_list,
          days_ahead: values.days_ahead,
        };
      case 'weather':
        return {
          city: values.city,
          api_key: values.api_key,
          units: values.units,
        };
      case 'vm_status':
        // Si mode serveur, on utilise server_id et on ne stocke que les options spécifiques
        if (values.connection_mode === 'server' && values.server_id) {
          return {
            server_id: values.server_id,
            name: values.vm_name,
            check_ports: values.check_ports,
            icon_url: values.icon_url,
            description: values.vm_description,
            show_docker: values.show_docker,
          };
        }
        // Mode manuel: configuration SSH complète
        return {
          name: values.vm_name,
          host: values.vm_host,
          check_ports: values.check_ports,
          icon_url: values.icon_url,
          description: values.vm_description,
          ssh_enabled: values.ssh_enabled,
          ssh_port: values.ssh_port,
          ssh_user: values.ssh_user,
          ssh_key: values.ssh_key,
          ssh_password: values.ssh_password,
          show_docker: values.show_docker,
        };
      case 'vikunja':
        return {
          api_url: values.vikunja_api_url,
          api_token: values.vikunja_api_token,
          project_id: values.vikunja_project_id,
          show_completed: values.vikunja_show_completed,
          max_tasks: values.vikunja_max_tasks,
          filter: values.vikunja_filter,
        };
      case 'crowdsec':
        return {
          api_url: values.crowdsec_api_url,
          api_key: values.crowdsec_api_key,
          max_decisions: values.crowdsec_max_decisions,
          max_alerts: values.crowdsec_max_alerts,
          show_metrics: values.crowdsec_show_metrics,
          show_decisions: values.crowdsec_show_decisions,
          show_alerts: values.crowdsec_show_alerts,
          refresh_interval: values.crowdsec_refresh_interval,
        };
      case 'uptime_ping':
        return {
          targets: values.ping_targets,
          target_names: values.ping_target_names,
          ping_count: values.ping_count,
          ping_interval: values.ping_interval,
          ping_timeout: values.ping_timeout,
          history_hours: values.ping_history_hours,
          graph_height: values.ping_graph_height,
          show_jitter: values.ping_show_jitter,
          show_packet_loss: values.ping_show_packet_loss,
          show_statistics: values.ping_show_statistics,
          latency_warning: values.ping_latency_warning,
          latency_critical: values.ping_latency_critical,
          loss_warning: values.ping_loss_warning,
          loss_critical: values.ping_loss_critical,
        };
      case 'proxmox_node':
      case 'proxmox_summary':
        return {
          host: values.proxmox_host,
          api_token_id: values.proxmox_token_id,
          api_token_secret: values.proxmox_token_secret,
          node: values.node_name,
        };
      case 'proxmox_vm':
        return {
          host: values.proxmox_host,
          api_token_id: values.proxmox_token_id,
          api_token_secret: values.proxmox_token_secret,
          node: values.node_name,
          vmid: values.vm_id,
        };
      case 'iframe':
        return {
          url: values.url,
        };
      case 'docker':
        return {
          server_id: values.server_id,
          containers: values.docker_containers,
          show_stats: values.docker_show_stats,
          show_actions: values.docker_show_actions,
          refresh_interval: values.docker_refresh_interval,
        };
      case 'logs':
        return {
          server_id: values.server_id,
          max_lines: values.logs_max_lines,
          auto_scroll: values.logs_auto_scroll,
          show_timestamps: values.logs_show_timestamps,
          filter_pattern: values.logs_filter_pattern,
          refresh_interval: values.logs_refresh_interval,
        };
      case 'rss_feed':
        return {
          feed_urls: values.rss_feed_urls,
          max_display: values.rss_max_display,
          max_articles_per_feed: values.rss_max_articles_per_feed,
          show_images: values.rss_show_images,
          show_summary: values.rss_show_summary,
          show_author: values.rss_show_author,
          show_date: values.rss_show_date,
          show_source: values.rss_show_source,
          open_in_new_tab: values.rss_open_in_new_tab,
          refresh_interval: values.rss_refresh_interval,
          compact_mode: values.rss_compact_mode,
        };
      default:
        return {};
    }
  };

  const handleSave = () => {
    if (!widget) return;

    const config = buildConfig(form.values, widget.widget_type);
    onSave(widget.id, {
      title: form.values.title || null,
      size: form.values.size,
      col_span: form.values.col_span,
      row_span: form.values.row_span,
      config,
    });
    onClose();
  };

  const renderConfigFields = () => {
    if (!widget) return null;

    switch (widget.widget_type) {
      case 'clock':
        return (
          <Stack gap="sm">
            <Select
              label="Fuseau horaire"
              data={timezoneOptions}
              {...form.getInputProps('timezone')}
            />
            <Switch
              label="Format 24h"
              {...form.getInputProps('format_24h', { type: 'checkbox' })}
            />
            <Switch
              label="Afficher les secondes"
              {...form.getInputProps('show_seconds', { type: 'checkbox' })}
            />
            <Switch
              label="Afficher la date"
              {...form.getInputProps('show_date', { type: 'checkbox' })}
            />
          </Stack>
        );

      case 'calendar':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              Ajoutez vos URLs iCal (Nextcloud, Google, Apple). Une URL par ligne.
            </Alert>
            <Textarea
              label="URLs iCal"
              placeholder="https://nextcloud.example.com/remote.php/dav/calendars/user/personal?export"
              minRows={3}
              {...form.getInputProps('ical_urls')}
            />
            <Select
              label="Fuseau horaire"
              data={timezoneOptions}
              {...form.getInputProps('timezone')}
            />
            <Switch
              label="Semaine commence le lundi"
              {...form.getInputProps('first_day_monday', { type: 'checkbox' })}
            />
            <Switch
              label="Afficher la liste des événements"
              {...form.getInputProps('show_events_list', { type: 'checkbox' })}
            />
            <NumberInput
              label="Jours à afficher"
              min={1}
              max={30}
              {...form.getInputProps('days_ahead')}
            />
          </Stack>
        );

      case 'weather':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              <Text size="sm">
                Créez une clé API gratuite sur openweathermap.org
              </Text>
            </Alert>
            <TextInput
              label="Ville"
              placeholder="Paris, FR"
              description="Format: Ville, CodePays (ex: Paris, FR)"
              {...form.getInputProps('city')}
            />
            <PasswordInput
              label="Clé API OpenWeatherMap"
              placeholder="Votre clé API"
              {...form.getInputProps('api_key')}
            />
            <Select
              label="Unités"
              data={[
                { value: 'metric', label: 'Celsius (métrique)' },
                { value: 'imperial', label: 'Fahrenheit (impérial)' },
              ]}
              {...form.getInputProps('units')}
            />
          </Stack>
        );

      case 'vm_status':
        return (
          <Stack gap="sm">
            <TextInput
              label="Nom"
              placeholder="Mon serveur"
              {...form.getInputProps('vm_name')}
            />

            <Divider label="Connexion" labelPosition="center" />

            <Box>
              <Text size="sm" fw={500} mb="xs">Mode de connexion</Text>
              <SegmentedControl
                fullWidth
                data={[
                  { value: 'server', label: 'Serveur configuré' },
                  { value: 'manual', label: 'Configuration manuelle' },
                ]}
                {...form.getInputProps('connection_mode')}
              />
            </Box>

            {form.values.connection_mode === 'server' ? (
              <>
                <ServerSelect
                  value={form.values.server_id}
                  onChange={(val) => form.setFieldValue('server_id', val)}
                  label="Serveur"
                  description="Les identifiants SSH sont centralisés dans la configuration du serveur"
                  filterDocker
                  required
                />
                <TextInput
                  label="Ports à vérifier (séparés par des virgules)"
                  placeholder="22, 80, 443"
                  {...form.getInputProps('check_ports')}
                />
                <TextInput
                  label="URL icône (optionnel)"
                  placeholder="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/..."
                  {...form.getInputProps('icon_url')}
                />
                <TextInput
                  label="Description (optionnel)"
                  placeholder="Serveur de développement"
                  {...form.getInputProps('vm_description')}
                />
                <Switch
                  label="Afficher les containers Docker"
                  {...form.getInputProps('show_docker', { type: 'checkbox' })}
                />
              </>
            ) : (
              <>
                <TextInput
                  label="Adresse IP ou hostname"
                  placeholder="192.168.1.100"
                  {...form.getInputProps('vm_host')}
                />
                <TextInput
                  label="Ports à vérifier (séparés par des virgules)"
                  placeholder="22, 80, 443"
                  {...form.getInputProps('check_ports')}
                />
                <TextInput
                  label="URL icône (optionnel)"
                  placeholder="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/..."
                  {...form.getInputProps('icon_url')}
                />
                <TextInput
                  label="Description (optionnel)"
                  placeholder="Serveur de développement"
                  {...form.getInputProps('vm_description')}
                />

                <Divider label="Métriques SSH (optionnel)" labelPosition="center" />

                <Switch
                  label="Activer les métriques SSH"
                  {...form.getInputProps('ssh_enabled', { type: 'checkbox' })}
                />

                {form.values.ssh_enabled && (
                  <>
                    <Group grow>
                      <TextInput
                        label="Utilisateur SSH"
                        placeholder="root"
                        {...form.getInputProps('ssh_user')}
                      />
                      <NumberInput
                        label="Port SSH"
                        min={1}
                        max={65535}
                        {...form.getInputProps('ssh_port')}
                      />
                    </Group>

                    <Textarea
                      label="Clé SSH privée (format PEM)"
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      minRows={3}
                      {...form.getInputProps('ssh_key')}
                    />

                    <PasswordInput
                      label="Mot de passe SSH (si pas de clé)"
                      placeholder="Mot de passe"
                      {...form.getInputProps('ssh_password')}
                    />

                    <Switch
                      label="Afficher les containers Docker"
                      {...form.getInputProps('show_docker', { type: 'checkbox' })}
                    />
                  </>
                )}
              </>
            )}
          </Stack>
        );

      case 'vikunja':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              Créez un token API dans Vikunja (Paramètres → Tokens API)
            </Alert>
            <TextInput
              label="URL API Vikunja"
              placeholder="https://vikunja.example.com"
              {...form.getInputProps('vikunja_api_url')}
            />
            <PasswordInput
              label="Token API"
              placeholder="Votre token API"
              {...form.getInputProps('vikunja_api_token')}
            />
            <NumberInput
              label="ID du projet (0 = tous les projets)"
              min={0}
              {...form.getInputProps('vikunja_project_id')}
            />
            <Select
              label="Filtre"
              data={[
                { value: 'all', label: 'Toutes les tâches' },
                { value: 'today', label: "Aujourd'hui" },
                { value: 'week', label: 'Cette semaine' },
                { value: 'overdue', label: 'En retard' },
              ]}
              {...form.getInputProps('vikunja_filter')}
            />
            <NumberInput
              label="Nombre max de tâches"
              min={1}
              max={50}
              {...form.getInputProps('vikunja_max_tasks')}
            />
            <Switch
              label="Afficher les tâches terminées"
              {...form.getInputProps('vikunja_show_completed', { type: 'checkbox' })}
            />
          </Stack>
        );

      case 'crowdsec':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              <Stack gap="xs">
                <Text size="sm" fw={500}>Configuration CrowdSec</Text>
                <Text size="sm">
                  Pour générer une clé API Bouncer, connectez-vous au serveur CrowdSec :
                </Text>
                <Text size="sm" ff="monospace" bg="dark.6" p="xs" style={{ borderRadius: 4 }}>
                  docker exec crowdsec cscli bouncers add proxydash-widget
                </Text>
                <Text size="xs" c="dimmed">
                  Ou sans Docker : <code>cscli bouncers add proxydash-widget</code>
                </Text>
              </Stack>
            </Alert>
            <TextInput
              label="URL API CrowdSec (LAPI)"
              placeholder="http://192.168.1.100:8080"
              description="URL de l'API locale CrowdSec (port 8080 ou 8180)"
              {...form.getInputProps('crowdsec_api_url')}
            />
            <PasswordInput
              label="Clé API Bouncer"
              placeholder="Ex: /0x7qm3ypSpQXdRiG/prGq4ze2m8zqswAyC0CTcHGYw"
              description="Clé générée par la commande cscli bouncers add"
              {...form.getInputProps('crowdsec_api_key')}
            />
            <Divider label="Options d'affichage" labelPosition="center" />
            <Switch
              label="Afficher les métriques"
              {...form.getInputProps('crowdsec_show_metrics', { type: 'checkbox' })}
            />
            <Switch
              label="Afficher les décisions (bans)"
              {...form.getInputProps('crowdsec_show_decisions', { type: 'checkbox' })}
            />
            <Switch
              label="Afficher les alertes"
              {...form.getInputProps('crowdsec_show_alerts', { type: 'checkbox' })}
            />
            <Group grow>
              <NumberInput
                label="Max décisions"
                min={1}
                max={50}
                {...form.getInputProps('crowdsec_max_decisions')}
              />
              <NumberInput
                label="Max alertes"
                min={1}
                max={50}
                {...form.getInputProps('crowdsec_max_alerts')}
              />
            </Group>
            <NumberInput
              label="Rafraîchissement (secondes)"
              min={10}
              max={300}
              {...form.getInputProps('crowdsec_refresh_interval')}
            />
          </Stack>
        );

      case 'uptime_ping':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              <Stack gap="xs">
                <Text size="sm" fw={500}>Monitoring Uptime / Ping</Text>
                <Text size="sm">
                  Surveillance de disponibilité avec graphiques SmokePing.
                  Affiche la latence, le jitter (variation) et la perte de paquets sur un historique.
                </Text>
              </Stack>
            </Alert>

            <Textarea
              label="Cibles (une par ligne)"
              description="Adresses IP ou hostnames à surveiller"
              placeholder="192.168.1.1&#10;google.com&#10;8.8.8.8"
              minRows={3}
              {...form.getInputProps('ping_targets')}
            />

            <Textarea
              label="Noms des cibles (optionnel, une par ligne)"
              description="Noms personnalisés pour chaque cible (même ordre)"
              placeholder="Routeur&#10;Google&#10;DNS Google"
              minRows={3}
              {...form.getInputProps('ping_target_names')}
            />

            <Divider label="Paramètres de ping" labelPosition="center" />

            <Group grow>
              <NumberInput
                label="Nombre de pings"
                description="Par requête"
                min={1}
                max={20}
                {...form.getInputProps('ping_count')}
              />
              <NumberInput
                label="Intervalle (secondes)"
                description="Entre chaque mesure"
                min={10}
                max={3600}
                {...form.getInputProps('ping_interval')}
              />
              <NumberInput
                label="Timeout (secondes)"
                min={1}
                max={30}
                {...form.getInputProps('ping_timeout')}
              />
            </Group>

            <NumberInput
              label="Historique (heures)"
              description="Durée de conservation des données"
              min={1}
              max={720}
              {...form.getInputProps('ping_history_hours')}
            />

            <Divider label="Seuils d'alerte" labelPosition="center" />

            <Group grow>
              <NumberInput
                label="Latence warning (ms)"
                min={1}
                {...form.getInputProps('ping_latency_warning')}
              />
              <NumberInput
                label="Latence critique (ms)"
                min={1}
                {...form.getInputProps('ping_latency_critical')}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="Perte warning (%)"
                min={0}
                max={100}
                {...form.getInputProps('ping_loss_warning')}
              />
              <NumberInput
                label="Perte critique (%)"
                min={0}
                max={100}
                {...form.getInputProps('ping_loss_critical')}
              />
            </Group>

            <Divider label="Affichage" labelPosition="center" />

            <Switch
              label="Afficher le jitter"
              {...form.getInputProps('ping_show_jitter', { type: 'checkbox' })}
            />
            <Switch
              label="Afficher la perte de paquets"
              {...form.getInputProps('ping_show_packet_loss', { type: 'checkbox' })}
            />
            <Switch
              label="Afficher les statistiques"
              {...form.getInputProps('ping_show_statistics', { type: 'checkbox' })}
            />

            <NumberInput
              label="Hauteur du graphique (pixels)"
              min={50}
              max={400}
              {...form.getInputProps('ping_graph_height')}
            />
          </Stack>
        );

      case 'proxmox_node':
      case 'proxmox_summary':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              Utilisez un token API Proxmox (Datacenter → API Tokens)
            </Alert>
            <TextInput
              label="Hôte Proxmox"
              placeholder="192.168.1.100"
              {...form.getInputProps('proxmox_host')}
            />
            <TextInput
              label="Token ID"
              placeholder="user@pam!tokenid"
              {...form.getInputProps('proxmox_token_id')}
            />
            <PasswordInput
              label="Token Secret"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              {...form.getInputProps('proxmox_token_secret')}
            />
            <TextInput
              label="Nom du noeud"
              placeholder="pve"
              {...form.getInputProps('node_name')}
            />
          </Stack>
        );

      case 'proxmox_vm':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              Utilisez un token API Proxmox (Datacenter → API Tokens)
            </Alert>
            <TextInput
              label="Hôte Proxmox"
              placeholder="192.168.1.100"
              {...form.getInputProps('proxmox_host')}
            />
            <TextInput
              label="Token ID"
              placeholder="user@pam!tokenid"
              {...form.getInputProps('proxmox_token_id')}
            />
            <PasswordInput
              label="Token Secret"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              {...form.getInputProps('proxmox_token_secret')}
            />
            <TextInput
              label="Nom du noeud"
              placeholder="pve"
              {...form.getInputProps('node_name')}
            />
            <NumberInput
              label="VM ID"
              min={100}
              {...form.getInputProps('vm_id')}
            />
          </Stack>
        );

      case 'iframe':
        return (
          <Stack gap="sm">
            <TextInput
              label="URL de la page à intégrer"
              placeholder="https://example.com/dashboard"
              {...form.getInputProps('url')}
            />
          </Stack>
        );

      case 'docker':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              <Stack gap="xs">
                <Text size="sm" fw={500}>Widget Docker</Text>
                <Text size="sm">
                  Surveillez vos containers Docker. Sélectionnez un serveur configuré dans les paramètres.
                </Text>
              </Stack>
            </Alert>

            <ServerSelect
              label="Serveur"
              description="Sélectionnez un serveur configuré"
              value={form.values.server_id}
              onChange={(value) => form.setFieldValue('server_id', value)}
              required
            />

            <TextInput
              label="Filtrer les containers (optionnel)"
              description="Noms séparés par des virgules, vide = tous"
              placeholder="nginx, redis, postgres"
              {...form.getInputProps('docker_containers')}
            />

            <NumberInput
              label="Rafraîchissement (secondes)"
              min={5}
              max={300}
              {...form.getInputProps('docker_refresh_interval')}
            />

            <Divider label="Options" labelPosition="center" />

            <Switch
              label="Afficher les statistiques"
              description="CPU, RAM, réseau"
              {...form.getInputProps('docker_show_stats', { type: 'checkbox' })}
            />

            <Switch
              label="Afficher les actions"
              description="Start, Stop, Restart"
              {...form.getInputProps('docker_show_actions', { type: 'checkbox' })}
            />
          </Stack>
        );

      case 'logs':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              <Stack gap="xs">
                <Text size="sm" fw={500}>Widget Logs Docker</Text>
                <Text size="sm">
                  Visualisez les logs d'un container Docker en temps réel.
                  Le container sera sélectionnable directement dans le widget via un menu déroulant.
                </Text>
              </Stack>
            </Alert>

            <ServerSelect
              label="Serveur"
              description="Sélectionnez un serveur configuré"
              value={form.values.server_id}
              onChange={(value) => form.setFieldValue('server_id', value)}
              required
            />

            <Group grow>
              <NumberInput
                label="Nombre de lignes"
                min={10}
                max={500}
                {...form.getInputProps('logs_max_lines')}
              />
              <NumberInput
                label="Rafraîchissement (sec)"
                min={1}
                max={60}
                {...form.getInputProps('logs_refresh_interval')}
              />
            </Group>

            <TextInput
              label="Filtre (regex, optionnel)"
              description="Filtrer les logs affichés"
              placeholder="error|warning"
              {...form.getInputProps('logs_filter_pattern')}
            />

            <Divider label="Options" labelPosition="center" />

            <Switch
              label="Défilement automatique"
              description="Suivre les nouveaux logs"
              {...form.getInputProps('logs_auto_scroll', { type: 'checkbox' })}
            />

            <Switch
              label="Afficher les timestamps"
              {...form.getInputProps('logs_show_timestamps', { type: 'checkbox' })}
            />
          </Stack>
        );

      case 'rss_feed':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              <Stack gap="xs">
                <Text size="sm" fw={500}>Agrégateur de flux RSS</Text>
                <Text size="sm">
                  Ajoutez vos flux RSS préférés. Les articles non lus s'affichent automatiquement.
                  Les articles cliqués sont archivés et conservés 6 mois.
                </Text>
              </Stack>
            </Alert>

            <Textarea
              label="URLs des flux RSS (une par ligne)"
              description="Ajoutez les URLs de vos flux RSS, Atom ou News"
              placeholder="https://news.ycombinator.com/rss&#10;https://www.lemonde.fr/rss/une.xml&#10;https://www.reddit.com/r/selfhosted/.rss"
              minRows={4}
              {...form.getInputProps('rss_feed_urls')}
            />

            <Group grow>
              <NumberInput
                label="Articles à afficher"
                description="Nombre max dans le widget"
                min={5}
                max={50}
                {...form.getInputProps('rss_max_display')}
              />
              <NumberInput
                label="Articles par flux"
                description="À stocker en base"
                min={5}
                max={50}
                {...form.getInputProps('rss_max_articles_per_feed')}
              />
            </Group>

            <NumberInput
              label="Rafraîchissement (secondes)"
              description="Intervalle de mise à jour des flux"
              min={60}
              max={3600}
              {...form.getInputProps('rss_refresh_interval')}
            />

            <Divider label="Options d'affichage" labelPosition="center" />

            <Switch
              label="Afficher les images"
              description="Miniatures des articles"
              {...form.getInputProps('rss_show_images', { type: 'checkbox' })}
            />

            <Switch
              label="Afficher le résumé"
              description="Extrait du contenu de l'article"
              {...form.getInputProps('rss_show_summary', { type: 'checkbox' })}
            />

            <Switch
              label="Afficher l'auteur"
              {...form.getInputProps('rss_show_author', { type: 'checkbox' })}
            />

            <Switch
              label="Afficher la date"
              {...form.getInputProps('rss_show_date', { type: 'checkbox' })}
            />

            <Switch
              label="Afficher la source"
              description="Nom du site d'origine"
              {...form.getInputProps('rss_show_source', { type: 'checkbox' })}
            />

            <Switch
              label="Ouvrir dans un nouvel onglet"
              {...form.getInputProps('rss_open_in_new_tab', { type: 'checkbox' })}
            />

            <Switch
              label="Mode compact"
              description="Affichage sans images, plus dense"
              {...form.getInputProps('rss_compact_mode', { type: 'checkbox' })}
            />
          </Stack>
        );

      default:
        return (
          <Text c="dimmed" size="sm">
            Configuration non disponible pour ce type de widget
          </Text>
        );
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Configurer: ${widget ? widgetTypeLabels[widget.widget_type] || widget.widget_type : ''}`}
      size="lg"
    >
      <Stack>
        <TextInput
          label="Titre (optionnel)"
          placeholder="Mon widget"
          {...form.getInputProps('title')}
        />

        <Group grow>
          <Select
            label="Taille"
            data={sizeOptions}
            {...form.getInputProps('size')}
          />
          <NumberInput
            label="Colonnes"
            min={1}
            max={4}
            {...form.getInputProps('col_span')}
          />
          <NumberInput
            label="Lignes"
            min={1}
            max={4}
            {...form.getInputProps('row_span')}
          />
        </Group>

        <Divider label="Configuration spécifique" labelPosition="center" />

        {renderConfigFields()}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
