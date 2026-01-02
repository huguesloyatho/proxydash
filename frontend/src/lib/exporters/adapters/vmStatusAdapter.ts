/**
 * Adaptateur d'export pour le widget VM Status
 */

import type {
  IWidgetExportAdapter,
  VMStatusWidgetData,
  PDFContent,
  PDFSection,
  ExportMetadata,
} from '../types';
import { formatDateForCSV, formatBytesForCSV, formatPercentForCSV } from '../csvExporter';

const PORT_LABELS: Record<number, string> = {
  22: 'SSH',
  80: 'HTTP',
  443: 'HTTPS',
  3389: 'RDP',
  5900: 'VNC',
  8080: 'Web',
  3306: 'MySQL',
  5432: 'PostgreSQL',
  27017: 'MongoDB',
  6379: 'Redis',
};

export const vmStatusExportAdapter: IWidgetExportAdapter<VMStatusWidgetData> = {
  widgetType: 'vm_status',
  displayName: 'Statut VM',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'Nom',
      'Hôte',
      'Statut',
      'CPU %',
      'RAM Utilisée',
      'RAM Total',
      'RAM %',
      'Disque Utilisé',
      'Disque Total',
      'Disque %',
      'Containers Actifs',
      'Containers Total',
      'Dernière vérification',
    ];
  },

  toCSVRows(data: VMStatusWidgetData): string[][] {
    const runningContainers = data.containers?.filter(
      (c) => c.status.includes('Up')
    ).length || 0;
    const totalContainers = data.containers?.length || 0;

    return [[
      data.name,
      data.host,
      data.is_online ? 'En ligne' : 'Hors ligne',
      data.cpu_percent !== undefined ? formatPercentForCSV(data.cpu_percent) : '',
      data.memory ? formatBytesForCSV(data.memory.used) : '',
      data.memory ? formatBytesForCSV(data.memory.total) : '',
      data.memory ? formatPercentForCSV(data.memory.percent) : '',
      data.disk ? formatBytesForCSV(data.disk.used) : '',
      data.disk ? formatBytesForCSV(data.disk.total) : '',
      data.disk ? formatPercentForCSV(data.disk.percent) : '',
      runningContainers.toString(),
      totalContainers.toString(),
      formatDateForCSV(data.checked_at),
    ]];
  },

  toJSON(data: VMStatusWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'vm_status',
        ...metadata,
      },
      server: {
        name: data.name,
        host: data.host,
        description: data.description,
        is_online: data.is_online,
        checked_at: data.checked_at,
      },
      metrics: {
        cpu_percent: data.cpu_percent,
        memory: data.memory ? {
          used: data.memory.used,
          total: data.memory.total,
          percent: data.memory.percent,
          used_formatted: formatBytesForCSV(data.memory.used),
          total_formatted: formatBytesForCSV(data.memory.total),
        } : null,
        disk: data.disk ? {
          used: data.disk.used,
          total: data.disk.total,
          percent: data.disk.percent,
          used_formatted: formatBytesForCSV(data.disk.used),
          total_formatted: formatBytesForCSV(data.disk.total),
        } : null,
      },
      ports: Object.entries(data.ports || {}).map(([port, isOpen]) => ({
        port: parseInt(port, 10),
        label: PORT_LABELS[parseInt(port, 10)] || 'Custom',
        is_open: isOpen,
      })),
      containers: data.containers?.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        ports: c.ports,
        is_running: c.status.includes('Up'),
      })) || [],
      ssh: {
        enabled: data.ssh_enabled,
        error: data.ssh_error,
      },
    };
  },

  toPDFContent(data: VMStatusWidgetData, title?: string): PDFContent {
    const runningContainers = data.containers?.filter(
      (c) => c.status.includes('Up')
    ).length || 0;
    const totalContainers = data.containers?.length || 0;

    const sections: PDFSection[] = [
      {
        title: 'Informations Serveur',
        type: 'stats' as const,
        content: [
          `Nom: ${data.name}`,
          `Hôte: ${data.host}`,
          `Statut: ${data.is_online ? 'En ligne' : 'Hors ligne'}`,
          data.description ? `Description: ${data.description}` : '',
        ].filter(Boolean),
      },
    ];

    // Metrics section
    if (data.cpu_percent !== undefined || data.memory || data.disk) {
      const metricsContent = [];
      if (data.cpu_percent !== undefined) {
        metricsContent.push(`CPU: ${data.cpu_percent}%`);
      }
      if (data.memory) {
        metricsContent.push(
          `RAM: ${formatBytesForCSV(data.memory.used)} / ${formatBytesForCSV(data.memory.total)} (${data.memory.percent}%)`
        );
      }
      if (data.disk) {
        metricsContent.push(
          `Disque: ${formatBytesForCSV(data.disk.used)} / ${formatBytesForCSV(data.disk.total)} (${data.disk.percent}%)`
        );
      }

      sections.push({
        title: 'Métriques',
        type: 'stats' as const,
        content: metricsContent,
      });
    }

    // Ports section
    const openPorts = Object.entries(data.ports || {});
    if (openPorts.length > 0) {
      sections.push({
        title: 'Ports',
        type: 'list' as const,
        content: openPorts.map(([port, isOpen]) => {
          const label = PORT_LABELS[parseInt(port, 10)] || 'Custom';
          const status = isOpen ? '✓ Ouvert' : '✗ Fermé';
          return `Port ${port} (${label}): ${status}`;
        }),
      });
    }

    // Containers summary
    if (totalContainers > 0) {
      sections.push({
        title: 'Containers Docker',
        type: 'stats' as const,
        content: [
          `Total: ${totalContainers}`,
          `En cours: ${runningContainers}`,
          `Arrêtés: ${totalContainers - runningContainers}`,
        ],
      });
    }

    const tables = [];

    // Containers table
    if (data.containers && data.containers.length > 0) {
      tables.push({
        title: 'Liste des Containers',
        headers: ['Nom', 'Statut', 'Ports'],
        rows: data.containers.map((c) => [
          c.name,
          c.status.includes('Up') ? 'Running' : 'Stopped',
          c.ports.length > 0 ? c.ports.join(', ') : '-',
        ]),
      });
    }

    return {
      title: title || `Rapport Serveur - ${data.name}`,
      subtitle: data.host,
      generatedAt: new Date().toISOString(),
      sections,
      tables,
      footer: `Dernière vérification: ${formatDateForCSV(data.checked_at)}`,
    };
  },
};
