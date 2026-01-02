'use client';

import { useRef, useState, useCallback } from 'react';
import { Card, ActionIcon, Group, Text, Menu, Tooltip } from '@mantine/core';
import { IconSettings, IconTrash, IconEye, IconEyeOff, IconWorld, IconGripVertical, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { ExportMenu } from './ExportMenu';
import { supportsExport } from '@/lib/exporters';
import { ClockWidget } from './ClockWidget';
import { CalendarWidget } from './CalendarWidget';
import { WeatherWidget } from './WeatherWidget';
import { ProxmoxWidget } from './ProxmoxWidget';
import { VMStatusWidget } from './VMStatusWidget';
import { VikunjaWidget } from './VikunjaWidget';
import { CrowdSecWidget } from './CrowdSecWidget';
import { UptimePingWidget } from './UptimePingWidget';
import { DockerWidget } from './DockerWidget';
import { LogsWidget } from './LogsWidget';
import { RssWidget } from './RssWidget';
import { NotesWidget } from './NotesWidget';
import { GrafanaWidget } from './GrafanaWidget';

export interface Widget {
  id: number;
  widget_type: string;
  title: string | null;
  position: number;
  column: number;
  size: 'small' | 'medium' | 'large';
  col_span: number;
  row_span: number;
  config: Record<string, unknown>;
  is_visible: boolean;
  is_public: boolean;
}

interface WidgetCardProps {
  widget: Widget;
  isAdmin?: boolean;
  isTabWidget?: boolean;  // True if this widget is in a custom tab (uses direct config, not DB ID)
  onEdit?: (widget: Widget) => void;
  onDelete?: (widget: Widget) => void;
  onToggleVisibility?: (widget: Widget) => void;
  onTogglePublic?: (widget: Widget) => void;
  onRemoveFromTab?: () => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

// Base height for 1 row_span
const BASE_HEIGHT = 180;

// Calculate height based on row_span
const getHeight = (rowSpan: number) => {
  return BASE_HEIGHT * rowSpan + (rowSpan - 1) * 16; // 16px gap between rows
};

const widgetTitles: Record<string, string> = {
  clock: 'Horloge',
  calendar: 'Calendrier',
  weather: 'Météo',
  proxmox_node: 'Noeud Proxmox',
  proxmox_vm: 'VM Proxmox',
  proxmox_summary: 'Résumé Proxmox',
  system_stats: 'Statistiques Système',
  iframe: 'Iframe',
  vm_status: 'VM / Serveur',
  vikunja: 'Vikunja',
  crowdsec: 'CrowdSec',
  uptime_ping: 'Uptime / Ping',
  docker: 'Docker',
  logs: 'Logs Docker',
  rss_feed: 'Flux RSS',
  notes: 'Notes',
  grafana: 'Grafana',
};

export function WidgetCard({
  widget,
  isAdmin = false,
  isTabWidget = false,
  onEdit,
  onDelete,
  onToggleVisibility,
  onTogglePublic,
  onRemoveFromTab,
  isDragging = false,
  dragHandleProps,
}: WidgetCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [widgetData, setWidgetData] = useState<unknown>(null);

  // Callback to capture widget data for export
  const handleWidgetDataReady = useCallback((data: unknown) => {
    setWidgetData(data);
  }, []);

  const renderWidgetContent = () => {
    // All widgets now have a DB ID - use widget.id directly
    // widget.id will be 0 or undefined only for legacy widgets without DB backing
    const effectiveWidgetId = widget.id && widget.id > 0 ? widget.id : undefined;

    switch (widget.widget_type) {
      case 'clock':
        return <ClockWidget config={widget.config} size={widget.size} />;
      case 'weather':
        return <WeatherWidget widgetId={effectiveWidgetId} config={widget.config} size={widget.size} />;
      case 'proxmox_node':
      case 'proxmox_vm':
      case 'proxmox_summary':
        return (
          <ProxmoxWidget
            widgetId={effectiveWidgetId}
            widgetType={widget.widget_type as 'proxmox_node' | 'proxmox_vm' | 'proxmox_summary'}
            config={widget.config}
            size={widget.size}
          />
        );
      case 'vm_status':
        return (
          <VMStatusWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'vikunja':
        return (
          <VikunjaWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'crowdsec':
        return (
          <CrowdSecWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'uptime_ping':
        return (
          <UptimePingWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            colSpan={widget.col_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'docker':
        return (
          <DockerWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'logs':
        return (
          <LogsWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'rss_feed':
        return (
          <RssWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'calendar':
        return (
          <CalendarWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            colSpan={widget.col_span}
            rowSpan={widget.row_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'notes':
        return (
          <NotesWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      case 'iframe':
        return (
          <iframe
            src={widget.config.url as string}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={widget.title || 'Widget'}
          />
        );
      case 'grafana':
        return (
          <GrafanaWidget
            widgetId={effectiveWidgetId}
            config={widget.config}
            size={widget.size}
            rowSpan={widget.row_span}
            colSpan={widget.col_span}
            onDataReady={handleWidgetDataReady}
          />
        );
      default:
        return (
          <Text c="dimmed" size="sm" ta="center">
            Type de widget inconnu: {widget.widget_type}
          </Text>
        );
    }
  };

  const title = widget.title || widgetTitles[widget.widget_type] || widget.widget_type;

  // Check if widget supports export
  const canExport = supportsExport(widget.widget_type);

  return (
    <Card
      ref={cardRef}
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      className={`relative group transition-all ${isDragging ? 'opacity-50' : ''}`}
      style={{
        height: '100%',
        opacity: widget.is_visible ? 1 : 0.5,
      }}
    >
      {isAdmin && (
        <Group
          gap={4}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Tooltip label="Glisser pour réorganiser">
            <ActionIcon
              variant="subtle"
              size="sm"
              className="cursor-grab"
              {...dragHandleProps}
            >
              <IconGripVertical size={14} />
            </ActionIcon>
          </Tooltip>

          {/* Export Menu */}
          {canExport && widgetData !== null && (
            <ExportMenu
              widgetType={widget.widget_type}
              widgetTitle={title}
              data={widgetData}
              containerRef={cardRef}
              size="sm"
            />
          )}

          <Tooltip label={widget.is_public ? 'Widget public' : 'Widget privé'}>
            <ActionIcon
              variant={widget.is_public ? 'filled' : 'subtle'}
              size="sm"
              color={widget.is_public ? 'green' : 'gray'}
              onClick={() => onTogglePublic?.(widget)}
            >
              <IconWorld size={14} />
            </ActionIcon>
          </Tooltip>

          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm">
                <IconSettings size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {onEdit ? (
                <Menu.Item
                  leftSection={<IconSettings size={14} />}
                  onClick={() => onEdit(widget)}
                >
                  Configurer
                </Menu.Item>
              ) : (
                <Menu.Item
                  leftSection={<IconSettings size={14} />}
                  component={Link}
                  href="/dashboard/widgets"
                >
                  Configurer
                </Menu.Item>
              )}
              {onToggleVisibility && (
                <Menu.Item
                  leftSection={widget.is_visible ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  onClick={() => onToggleVisibility(widget)}
                >
                  {widget.is_visible ? 'Masquer' : 'Afficher'}
                </Menu.Item>
              )}
              {onRemoveFromTab && (
                <Menu.Item
                  leftSection={<IconX size={14} />}
                  onClick={onRemoveFromTab}
                >
                  Retirer de l'onglet
                </Menu.Item>
              )}
              {onDelete && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconTrash size={14} />}
                    color="red"
                    onClick={() => onDelete(widget)}
                  >
                    Supprimer
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      )}

      {widget.title && (
        <Text size="xs" fw={600} c="dimmed" mb="xs">
          {title}
        </Text>
      )}

      <div style={{ height: widget.title ? 'calc(100% - 24px)' : '100%' }}>
        {renderWidgetContent()}
      </div>
    </Card>
  );
}
