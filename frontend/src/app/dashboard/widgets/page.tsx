'use client';

import { useState } from 'react';
import {
  Title,
  Card,
  Button,
  Group,
  Stack,
  Modal,
  TextInput,
  Select,
  NumberInput,
  Switch,
  Text,
  Divider,
  SimpleGrid,
  Tooltip,
  PasswordInput,
  Alert,
  Textarea,
  Slider,
  ActionIcon,
  SegmentedControl,
  Box,
} from '@mantine/core';
import { ServerSelect } from '@/components/ServerSelect';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconClock,
  IconCalendar,
  IconCloud,
  IconServer,
  IconDeviceDesktop,
  IconChartBar,
  IconBrandTabler,
  IconInfoCircle,
  IconChecklist,
  IconServer2,
  IconArrowLeft,
  IconAdjustments,
  IconEye,
  IconSettings,
  IconTrash,
  IconShield,
  IconActivityHeartbeat,
  IconNote,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { widgetsApi } from '@/lib/api';
import { SortableWidgetGrid, EditableWidgetGrid, Widget } from '@/components/widgets';

const widgetTypes = [
  { value: 'clock', label: 'Horloge', icon: IconClock, description: "Affiche l'heure et la date" },
  { value: 'calendar', label: 'Calendrier', icon: IconCalendar, description: 'Calendrier avec événements iCal' },
  { value: 'weather', label: 'Météo', icon: IconCloud, description: 'Conditions météo actuelles' },
  { value: 'notes', label: 'Notes', icon: IconNote, description: 'Notes rapides (locales ou Nextcloud)' },
  { value: 'vm_status', label: 'VM / Serveur', icon: IconServer2, description: 'État via ping et ports' },
  { value: 'uptime_ping', label: 'Uptime / Ping', icon: IconActivityHeartbeat, description: 'Monitoring SmokePing avec graphes latence/jitter' },
  { value: 'vikunja', label: 'Vikunja', icon: IconChecklist, description: 'Tâches depuis Vikunja' },
  { value: 'crowdsec', label: 'CrowdSec', icon: IconShield, description: 'Sécurité - Décisions et alertes' },
  { value: 'proxmox_node', label: 'Noeud Proxmox', icon: IconServer, description: "État d'un noeud Proxmox" },
  { value: 'proxmox_vm', label: 'VM Proxmox', icon: IconDeviceDesktop, description: "État d'une VM ou conteneur" },
  { value: 'proxmox_summary', label: 'Résumé Proxmox', icon: IconChartBar, description: "Vue d'ensemble du cluster" },
  { value: 'iframe', label: 'Iframe', icon: IconBrandTabler, description: 'Intégrer une page externe' },
];

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

interface WidgetFormValues {
  widget_type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  col_span: number;
  row_span: number;
  is_visible: boolean;
  is_public: boolean;
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
  // Proxmox config
  proxmox_host?: string;
  proxmox_token_id?: string;
  proxmox_token_secret?: string;
  node_name?: string;
  vm_id?: number;
  // Server selection (for widgets using SSH)
  connection_mode?: 'server' | 'manual';
  server_id?: number | null;
  // VM Status config
  vm_name?: string;
  vm_host?: string;
  check_ports?: string;
  icon_url?: string;
  vm_description?: string;
  // VM SSH config
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
  // Notes config
  notes_source?: 'local' | 'nextcloud';
  notes_nextcloud_url?: string;
  notes_nextcloud_username?: string;
  notes_nextcloud_password?: string;
  notes_nextcloud_category?: string;
  notes_default_color?: string;
  notes_show_pinned_first?: boolean;
  notes_show_archived?: boolean;
  notes_compact_mode?: boolean;
  notes_max_display?: number;
}

const defaultFormValues: WidgetFormValues = {
  widget_type: 'clock',
  title: '',
  size: 'medium',
  col_span: 1,
  row_span: 1,
  is_visible: true,
  is_public: false,
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
  proxmox_host: '',
  proxmox_token_id: '',
  proxmox_token_secret: '',
  node_name: '',
  vm_id: undefined,
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
  // Notes defaults
  notes_source: 'local',
  notes_nextcloud_url: '',
  notes_nextcloud_username: '',
  notes_nextcloud_password: '',
  notes_nextcloud_category: '',
  notes_default_color: '#fef3c7',
  notes_show_pinned_first: true,
  notes_show_archived: false,
  notes_compact_mode: false,
  notes_max_display: 10,
};

export default function WidgetsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const queryClient = useQueryClient();

  const { data: allWidgets = [], isLoading } = useQuery<Widget[]>({
    queryKey: ['widgets-all'],
    queryFn: widgetsApi.listAll,
  });

  // Separate visible and hidden widgets
  const widgets = allWidgets.filter(w => w.is_visible);
  const hiddenWidgets = allWidgets.filter(w => !w.is_visible);

  const createForm = useForm<WidgetFormValues>({
    initialValues: defaultFormValues,
  });

  const editForm = useForm<WidgetFormValues>({
    initialValues: defaultFormValues,
  });

  const buildConfig = (values: WidgetFormValues): Record<string, unknown> => {
    switch (values.widget_type) {
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
      case 'notes':
        return {
          source: values.notes_source,
          nextcloud_url: values.notes_nextcloud_url,
          nextcloud_username: values.notes_nextcloud_username,
          nextcloud_password: values.notes_nextcloud_password,
          nextcloud_category: values.notes_nextcloud_category,
          default_color: values.notes_default_color,
          show_pinned_first: values.notes_show_pinned_first,
          show_archived: values.notes_show_archived,
          compact_mode: values.notes_compact_mode,
          max_notes_display: values.notes_max_display,
        };
      default:
        return {};
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: WidgetFormValues) => {
      const config = buildConfig(values);
      return widgetsApi.create({
        widget_type: values.widget_type,
        title: values.title || undefined,
        size: values.size,
        col_span: values.col_span,
        row_span: values.row_span,
        is_visible: values.is_visible,
        is_public: values.is_public,
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets-all'] });
      notifications.show({
        title: 'Widget créé',
        message: 'Le widget a été créé avec succès',
        color: 'green',
      });
      setCreateModalOpen(false);
      createForm.reset();
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de créer le widget',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: WidgetFormValues }) => {
      const config = buildConfig(values);
      return widgetsApi.update(id, {
        title: values.title || undefined,
        size: values.size,
        col_span: values.col_span,
        row_span: values.row_span,
        is_visible: values.is_visible,
        is_public: values.is_public,
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets-all'] });
      notifications.show({
        title: 'Widget modifié',
        message: 'Le widget a été mis à jour',
        color: 'green',
      });
      setEditModalOpen(false);
      setSelectedWidget(null);
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de modifier le widget',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => widgetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets-all'] });
      notifications.show({
        title: 'Widget supprimé',
        message: 'Le widget a été supprimé',
        color: 'green',
      });
      setDeleteModalOpen(false);
      setSelectedWidget(null);
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de supprimer le widget',
        color: 'red',
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: (widget: Widget) =>
      widgetsApi.update(widget.id, { is_visible: !widget.is_visible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets-all'] });
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: (widget: Widget) =>
      widgetsApi.update(widget.id, { is_public: !widget.is_public }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets-all'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (widgetIds: number[]) => widgetsApi.reorder(widgetIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets-all'] });
      notifications.show({
        title: 'Ordre mis à jour',
        message: 'Les widgets ont été réorganisés',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de réorganiser les widgets',
        color: 'red',
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (updates: { id: number; position: number; col_span: number; row_span: number }[]) =>
      widgetsApi.bulkUpdate(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets-all'] });
      setIsEditMode(false);
      notifications.show({
        title: 'Widgets mis à jour',
        message: 'Les positions et tailles ont été enregistrées',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de mettre à jour les widgets',
        color: 'red',
      });
    },
  });

  const openEditModal = (widget: Widget) => {
    setSelectedWidget(widget);
    const config = widget.config || {};
    editForm.setValues({
      widget_type: widget.widget_type,
      title: widget.title || '',
      size: widget.size,
      col_span: widget.col_span || 1,
      row_span: widget.row_span || 1,
      is_visible: widget.is_visible,
      is_public: widget.is_public,
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
      proxmox_host: (config.host as string) || '',
      proxmox_token_id: (config.api_token_id as string) || '',
      proxmox_token_secret: (config.api_token_secret as string) || '',
      node_name: (config.node as string) || '',
      vm_id: config.vmid as number | undefined,
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
      // Notes
      notes_source: (config.source as 'local' | 'nextcloud') || 'local',
      notes_nextcloud_url: (config.nextcloud_url as string) || '',
      notes_nextcloud_username: (config.nextcloud_username as string) || '',
      notes_nextcloud_password: (config.nextcloud_password as string) || '',
      notes_nextcloud_category: (config.nextcloud_category as string) || '',
      notes_default_color: (config.default_color as string) || '#fef3c7',
      notes_show_pinned_first: config.show_pinned_first !== false,
      notes_show_archived: config.show_archived === true,
      notes_compact_mode: config.compact_mode === true,
      notes_max_display: (config.max_notes_display as number) || 10,
    });
    setEditModalOpen(true);
  };

  const openDeleteModal = (widget: Widget) => {
    setSelectedWidget(widget);
    setDeleteModalOpen(true);
  };

  const renderConfigFields = (form: typeof createForm, widgetType: string) => {
    switch (widgetType) {
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
              placeholder="https://nextcloud.example.com/remote.php/dav/calendars/user/personal?export&#10;https://calendar.google.com/calendar/ical/..."
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
                Créez une clé API gratuite sur{' '}
                <a
                  href="https://home.openweathermap.org/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--mantine-color-blue-6)' }}
                >
                  openweathermap.org/api_keys
                </a>
                . La clé peut prendre quelques minutes à être activée.
              </Text>
            </Alert>
            <TextInput
              label="Ville"
              placeholder="Paris, FR"
              description="Format: Ville, CodePays (ex: Paris, FR ou London, GB)"
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

                <Alert icon={<IconInfoCircle size={16} />} color="blue">
                  <Text size="sm">
                    Activez SSH pour récupérer CPU, RAM, disque et containers Docker.
                    Utilisez une clé SSH ou un mot de passe.
                  </Text>
                </Alert>

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
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
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
                  CrowdSec surveille votre infrastructure et bloque les attaques.
                  Pour générer une clé API Bouncer, connectez-vous au serveur CrowdSec et exécutez :
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
              description="URL de l'API locale CrowdSec (port 8080 par défaut, ou 8180 si configuré autrement)"
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
              placeholder={`google.com\n192.168.1.1\nserveur.local`}
              description="Adresses IP ou noms de domaine à surveiller"
              minRows={3}
              {...form.getInputProps('ping_targets')}
            />
            <Textarea
              label="Noms des cibles (optionnel, une par ligne)"
              placeholder={`Google DNS\nRouteur\nServeur Local`}
              description="Noms à afficher pour chaque cible (même ordre)"
              minRows={3}
              {...form.getInputProps('ping_target_names')}
            />
            <Divider label="Paramètres de ping" labelPosition="center" />
            <Group grow>
              <NumberInput
                label="Pings par mesure"
                min={1}
                max={20}
                description="Nombre de pings à chaque mesure"
                {...form.getInputProps('ping_count')}
              />
              <NumberInput
                label="Intervalle (secondes)"
                min={10}
                max={600}
                description="Fréquence des mesures"
                {...form.getInputProps('ping_interval')}
              />
            </Group>
            <Group grow>
              <NumberInput
                label="Timeout (secondes)"
                min={1}
                max={30}
                {...form.getInputProps('ping_timeout')}
              />
              <NumberInput
                label="Historique (heures)"
                min={1}
                max={168}
                description="Durée affichée dans le graphe"
                {...form.getInputProps('ping_history_hours')}
              />
            </Group>
            <Divider label="Seuils d'alerte" labelPosition="center" />
            <Group grow>
              <NumberInput
                label="Latence alerte (ms)"
                min={1}
                max={1000}
                description="Jaune au dessus"
                {...form.getInputProps('ping_latency_warning')}
              />
              <NumberInput
                label="Latence critique (ms)"
                min={1}
                max={5000}
                description="Rouge au dessus"
                {...form.getInputProps('ping_latency_critical')}
              />
            </Group>
            <Group grow>
              <NumberInput
                label="Perte alerte (%)"
                min={0}
                max={100}
                description="Jaune au dessus"
                {...form.getInputProps('ping_loss_warning')}
              />
              <NumberInput
                label="Perte critique (%)"
                min={0}
                max={100}
                description="Rouge au dessus"
                {...form.getInputProps('ping_loss_critical')}
              />
            </Group>
            <Divider label="Options d'affichage" labelPosition="center" />
            <Switch
              label="Afficher le jitter (bandes colorées)"
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
              max={300}
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
              placeholder="user@pam!tokenname"
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
              placeholder="user@pam!tokenname"
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
              label="ID de la VM/CT"
              placeholder="100"
              {...form.getInputProps('vm_id')}
            />
          </Stack>
        );

      case 'iframe':
        return (
          <Stack gap="sm">
            <TextInput
              label="URL"
              placeholder="https://example.com"
              {...form.getInputProps('url')}
            />
          </Stack>
        );

      case 'notes':
        return (
          <Stack gap="sm">
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              <Stack gap="xs">
                <Text size="sm" fw={500}>Widget Notes</Text>
                <Text size="sm">
                  Créez des notes rapides stockées localement ou synchronisées avec Nextcloud Notes.
                </Text>
              </Stack>
            </Alert>

            <SegmentedControl
              fullWidth
              data={[
                { label: 'Notes locales', value: 'local' },
                { label: 'Nextcloud Notes', value: 'nextcloud' },
              ]}
              {...form.getInputProps('notes_source')}
            />

            {form.values.notes_source === 'nextcloud' && (
              <Box p="sm" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 8 }}>
                <Stack gap="sm">
                  <Text size="sm" fw={500}>Configuration Nextcloud</Text>
                  <TextInput
                    label="URL Nextcloud"
                    placeholder="https://nextcloud.example.com"
                    description="URL de votre instance Nextcloud"
                    {...form.getInputProps('notes_nextcloud_url')}
                  />
                  <TextInput
                    label="Nom d'utilisateur"
                    placeholder="user"
                    {...form.getInputProps('notes_nextcloud_username')}
                  />
                  <PasswordInput
                    label="Mot de passe / Token"
                    placeholder="Mot de passe ou token d'application"
                    description="Utilisez un token d'application pour plus de sécurité"
                    {...form.getInputProps('notes_nextcloud_password')}
                  />
                  <TextInput
                    label="Catégorie (optionnel)"
                    placeholder="Dashboard"
                    description="Filtrer les notes par catégorie"
                    {...form.getInputProps('notes_nextcloud_category')}
                  />
                </Stack>
              </Box>
            )}

            <Divider label="Options d'affichage" labelPosition="center" />

            <TextInput
              label="Couleur par défaut"
              placeholder="#fef3c7"
              description="Couleur hexadécimale pour les nouvelles notes"
              {...form.getInputProps('notes_default_color')}
            />

            <NumberInput
              label="Nombre max de notes affichées"
              min={1}
              max={50}
              description="Limite le nombre de notes visibles"
              {...form.getInputProps('notes_max_display')}
            />

            <Switch
              label="Notes épinglées en premier"
              description="Afficher les notes épinglées en haut de la liste"
              {...form.getInputProps('notes_show_pinned_first', { type: 'checkbox' })}
            />

            <Switch
              label="Afficher les notes archivées"
              description="Inclure les notes archivées dans la liste"
              {...form.getInputProps('notes_show_archived', { type: 'checkbox' })}
            />

            <Switch
              label="Mode compact"
              description="Affichage plus dense des notes"
              {...form.getInputProps('notes_compact_mode', { type: 'checkbox' })}
            />
          </Stack>
        );

      default:
        return null;
    }
  };

  const renderSizeConfig = (form: typeof createForm) => (
    <Stack gap="sm">
      <Select
        label="Taille"
        data={sizeOptions}
        {...form.getInputProps('size')}
      />

      <Text size="sm" fw={500}>
        Largeur (colonnes): {form.values.col_span}
      </Text>
      <Slider
        min={1}
        max={4}
        step={1}
        marks={[
          { value: 1, label: '1' },
          { value: 2, label: '2' },
          { value: 3, label: '3' },
          { value: 4, label: '4' },
        ]}
        {...form.getInputProps('col_span')}
      />

      <Text size="sm" fw={500} mt="sm">
        Hauteur (lignes): {form.values.row_span}
      </Text>
      <Slider
        min={1}
        max={4}
        step={1}
        marks={[
          { value: 1, label: '1' },
          { value: 2, label: '2' },
          { value: 3, label: '3' },
          { value: 4, label: '4' },
        ]}
        {...form.getInputProps('row_span')}
      />
    </Stack>
  );

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Title order={2}>Widgets</Title>
        <Text c="dimmed">Chargement...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <ActionIcon
            component={Link}
            href="/dashboard"
            variant="subtle"
            size="lg"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2}>Widgets</Title>
            <Text c="dimmed" size="sm">
              {widgets.length} widget{widgets.length > 1 ? 's' : ''} configuré{widgets.length > 1 ? 's' : ''}
            </Text>
          </div>
        </Group>
        <Group gap="sm">
          {!isEditMode && widgets.length > 0 && (
            <Button
              variant="light"
              color="blue"
              leftSection={<IconAdjustments size={16} />}
              onClick={() => setIsEditMode(true)}
            >
              Personnaliser
            </Button>
          )}
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
            Ajouter un widget
          </Button>
        </Group>
      </Group>

      {/* Widget type selector */}
      <Card withBorder>
        <Text fw={500} mb="md">
          Types de widgets disponibles
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
          {widgetTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Tooltip key={type.value} label={type.description} position="bottom">
                <Card
                  withBorder
                  padding="sm"
                  className="cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => {
                    createForm.setFieldValue('widget_type', type.value);
                    setCreateModalOpen(true);
                  }}
                >
                  <Stack gap="xs" align="center">
                    <Icon size={24} className="text-blue-500" />
                    <Text size="xs" ta="center">
                      {type.label}
                    </Text>
                  </Stack>
                </Card>
              </Tooltip>
            );
          })}
        </SimpleGrid>
      </Card>

      {/* Existing widgets */}
      <Card withBorder>
        <Text fw={500} mb="md">
          Widgets configurés ({widgets.length})
        </Text>
        {isEditMode ? (
          <EditableWidgetGrid
            widgets={widgets}
            onSave={(updates) => bulkUpdateMutation.mutate(updates)}
            onCancel={() => setIsEditMode(false)}
          />
        ) : (
          <SortableWidgetGrid
            widgets={widgets}
            isAdmin
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            onToggleVisibility={(w) => toggleVisibilityMutation.mutate(w)}
            onTogglePublic={(w) => togglePublicMutation.mutate(w)}
            onReorder={(ids) => reorderMutation.mutate(ids)}
          />
        )}
      </Card>

      {/* Hidden widgets */}
      {hiddenWidgets.length > 0 && (
        <Card withBorder>
          <Text fw={500} mb="md">
            Widgets masqués ({hiddenWidgets.length})
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {hiddenWidgets.map((widget) => {
              const typeInfo = widgetTypes.find(t => t.value === widget.widget_type);
              const Icon = typeInfo?.icon || IconBrandTabler;
              return (
                <Card key={widget.id} withBorder padding="sm" style={{ opacity: 0.7 }}>
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Icon size={20} className="text-gray-400" />
                      <div>
                        <Text size="sm" fw={500}>{widget.title || typeInfo?.label || widget.widget_type}</Text>
                        <Text size="xs" c="dimmed">{widget.col_span}×{widget.row_span}</Text>
                      </div>
                    </Group>
                    <Group gap={4}>
                      <Tooltip label="Afficher">
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          onClick={() => toggleVisibilityMutation.mutate(widget)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Configurer">
                        <ActionIcon variant="subtle" onClick={() => openEditModal(widget)}>
                          <IconSettings size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon variant="subtle" color="red" onClick={() => openDeleteModal(widget)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Créer un widget"
        size="lg"
      >
        <form onSubmit={createForm.onSubmit((values) => createMutation.mutate(values))}>
          <Stack gap="md">
            <Select
              label="Type de widget"
              data={widgetTypes.map((t) => ({ value: t.value, label: t.label }))}
              {...createForm.getInputProps('widget_type')}
            />

            <TextInput
              label="Titre (optionnel)"
              placeholder="Mon widget"
              {...createForm.getInputProps('title')}
            />

            <Divider label="Taille et disposition" />
            {renderSizeConfig(createForm)}

            <Group>
              <Switch
                label="Visible"
                {...createForm.getInputProps('is_visible', { type: 'checkbox' })}
              />
              <Switch
                label="Public"
                {...createForm.getInputProps('is_public', { type: 'checkbox' })}
              />
            </Group>

            <Divider label="Configuration" />

            {renderConfigFields(createForm, createForm.values.widget_type)}

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setCreateModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Créer
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Modifier le widget"
        size="lg"
      >
        <form
          onSubmit={editForm.onSubmit((values) => {
            if (selectedWidget) {
              updateMutation.mutate({ id: selectedWidget.id, values });
            }
          })}
        >
          <Stack gap="md">
            <TextInput
              label="Titre (optionnel)"
              placeholder="Mon widget"
              {...editForm.getInputProps('title')}
            />

            <Divider label="Taille et disposition" />
            {renderSizeConfig(editForm)}

            <Group>
              <Switch
                label="Visible"
                {...editForm.getInputProps('is_visible', { type: 'checkbox' })}
              />
              <Switch
                label="Public"
                {...editForm.getInputProps('is_public', { type: 'checkbox' })}
              />
            </Group>

            <Divider label="Configuration" />

            {selectedWidget && renderConfigFields(editForm, selectedWidget.widget_type)}

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setEditModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                Enregistrer
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Supprimer le widget"
        size="sm"
      >
        <Stack gap="md">
          <Text>Êtes-vous sûr de vouloir supprimer ce widget ?</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteModalOpen(false)}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={() => selectedWidget && deleteMutation.mutate(selectedWidget.id)}
              loading={deleteMutation.isPending}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
