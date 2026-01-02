/**
 * Adaptateur d'export pour le widget UptimePing
 */

import type {
  IWidgetExportAdapter,
  PingWidgetData,
  PDFContent,
  PDFSection,
  ExportMetadata,
} from '../types';
import { formatDateForCSV } from '../csvExporter';

export const pingExportAdapter: IWidgetExportAdapter<PingWidgetData> = {
  widgetType: 'uptime_ping',
  displayName: 'Uptime / Ping',
  supportsImageExport: true,
  supportsGraphExport: true,

  getCSVHeaders(): string[] {
    return [
      'Timestamp',
      'Cible',
      'Nom',
      'Latence Min (ms)',
      'Latence Avg (ms)',
      'Latence Max (ms)',
      'Jitter (ms)',
      'Packet Loss (%)',
      'Accessible',
    ];
  },

  toCSVRows(data: PingWidgetData): string[][] {
    const rows: string[][] = [];

    // Pour chaque cible, exporter l'historique complet
    for (const target of data.targets) {
      for (const point of target.history) {
        rows.push([
          formatDateForCSV(point.timestamp),
          target.target,
          target.name,
          point.latency_min !== null ? point.latency_min.toFixed(2) : '',
          point.latency_avg !== null ? point.latency_avg.toFixed(2) : '',
          point.latency_max !== null ? point.latency_max.toFixed(2) : '',
          point.jitter !== null ? point.jitter.toFixed(2) : '',
          point.packet_loss_percent.toFixed(2),
          point.is_reachable ? 'Oui' : 'Non',
        ]);
      }
    }

    return rows;
  },

  toJSON(data: PingWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'uptime_ping',
        ...metadata,
      },
      targets: data.targets.map((t) => ({
        target: t.target,
        name: t.name,
        current: t.current,
        statistics: t.statistics,
        history_count: t.history.length,
        history: t.history,
      })),
      fetched_at: data.fetched_at,
    };
  },

  toPDFContent(data: PingWidgetData, title?: string): PDFContent {
    const sections: PDFSection[] = data.targets.map((target) => ({
      title: `${target.name} (${target.target})`,
      type: 'stats' as const,
      content: [
        `Status: ${target.current.status.toUpperCase()}`,
        `Latence moyenne: ${target.statistics.avg_latency !== null ? target.statistics.avg_latency.toFixed(2) + ' ms' : 'N/A'}`,
        `Latence min: ${target.statistics.min_latency !== null ? target.statistics.min_latency.toFixed(2) + ' ms' : 'N/A'}`,
        `Latence max: ${target.statistics.max_latency !== null ? target.statistics.max_latency.toFixed(2) + ' ms' : 'N/A'}`,
        `Jitter moyen: ${target.statistics.avg_jitter !== null ? target.statistics.avg_jitter.toFixed(2) + ' ms' : 'N/A'}`,
        `Perte de paquets: ${target.statistics.avg_packet_loss.toFixed(2)}%`,
        `Uptime: ${target.statistics.uptime_percent.toFixed(2)}%`,
        `Nombre de pannes: ${target.statistics.outages}`,
        `Mesures totales: ${target.statistics.total_measurements}`,
      ],
    }));

    return {
      title: title || 'Rapport Uptime / Ping',
      subtitle: `${data.targets.length} cible(s) surveillée(s)`,
      generatedAt: new Date().toISOString(),
      sections,
      tables: [
        {
          title: 'État Actuel',
          headers: ['Cible', 'Status', 'Latence', 'Perte', 'Uptime'],
          rows: data.targets.map((t) => [
            t.name,
            t.current.status.toUpperCase(),
            t.current.latency_avg !== null ? `${t.current.latency_avg.toFixed(1)} ms` : 'N/A',
            `${t.current.packet_loss_percent.toFixed(1)}%`,
            `${t.statistics.uptime_percent.toFixed(1)}%`,
          ]),
        },
      ],
      footer: `Données récupérées le ${formatDateForCSV(data.fetched_at)}`,
    };
  },
};
