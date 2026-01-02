/**
 * Adaptateur d'export pour le widget Docker
 */

import type {
  IWidgetExportAdapter,
  DockerWidgetData,
  PDFContent,
  ExportMetadata,
} from '../types';
import { formatDateForCSV, formatPercentForCSV, formatBytesForCSV } from '../csvExporter';

export const dockerExportAdapter: IWidgetExportAdapter<DockerWidgetData> = {
  widgetType: 'docker',
  displayName: 'Docker',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'Nom',
      'Image',
      'État',
      'Status',
      'Ports',
      'CPU %',
      'RAM Utilisée',
      'RAM Limite',
      'RAM %',
      'Créé le',
    ];
  },

  toCSVRows(data: DockerWidgetData): string[][] {
    return data.containers.map((container) => [
      container.name,
      container.image,
      container.state,
      container.status,
      container.ports.join('; '),
      container.cpu_percent !== undefined ? formatPercentForCSV(container.cpu_percent) : '',
      container.memory_usage !== undefined ? formatBytesForCSV(container.memory_usage) : '',
      container.memory_limit !== undefined ? formatBytesForCSV(container.memory_limit) : '',
      container.memory_percent !== undefined ? formatPercentForCSV(container.memory_percent) : '',
      formatDateForCSV(container.created),
    ]);
  },

  toJSON(data: DockerWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'docker',
        ...metadata,
      },
      host: data.host,
      summary: data.summary,
      containers: data.containers.map((c) => ({
        name: c.name,
        image: c.image,
        state: c.state,
        status: c.status,
        ports: c.ports,
        resources: {
          cpu_percent: c.cpu_percent,
          memory_usage: c.memory_usage,
          memory_limit: c.memory_limit,
          memory_percent: c.memory_percent,
        },
        created: c.created,
      })),
      fetched_at: data.fetched_at,
    };
  },

  toPDFContent(data: DockerWidgetData, title?: string): PDFContent {
    const { summary, containers } = data;

    return {
      title: title || 'Rapport Docker',
      subtitle: `Serveur: ${data.host}`,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          title: 'Résumé',
          type: 'stats',
          content: [
            `Total containers: ${summary.total}`,
            `En cours d'exécution: ${summary.running}`,
            `Arrêtés: ${summary.stopped}`,
            `En pause: ${summary.paused}`,
          ],
        },
      ],
      tables: [
        {
          title: 'Liste des Containers',
          headers: ['Nom', 'Image', 'État', 'CPU %', 'RAM %', 'Ports'],
          rows: containers.map((c) => [
            c.name,
            c.image.length > 30 ? c.image.substring(0, 27) + '...' : c.image,
            c.state,
            c.cpu_percent !== undefined ? `${c.cpu_percent.toFixed(1)}%` : '-',
            c.memory_percent !== undefined ? `${c.memory_percent.toFixed(1)}%` : '-',
            c.ports.slice(0, 2).join(', ') + (c.ports.length > 2 ? '...' : ''),
          ]),
        },
      ],
      footer: `Données récupérées le ${formatDateForCSV(data.fetched_at)}`,
    };
  },
};
