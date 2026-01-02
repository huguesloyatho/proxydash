/**
 * Adaptateur d'export pour le widget Logs
 */

import type {
  IWidgetExportAdapter,
  LogsWidgetData,
  PDFContent,
  PDFSection,
  ExportMetadata,
} from '../types';
import { formatDateForCSV } from '../csvExporter';

const LEVEL_LABELS: Record<string, string> = {
  error: 'ERREUR',
  warning: 'AVERTISSEMENT',
  info: 'INFO',
  debug: 'DEBUG',
  default: 'LOG',
};

export const logsExportAdapter: IWidgetExportAdapter<LogsWidgetData> = {
  widgetType: 'logs',
  displayName: 'Logs Docker',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'Timestamp',
      'Niveau',
      'Message',
    ];
  },

  toCSVRows(data: LogsWidgetData): string[][] {
    return data.logs.map((log) => [
      log.timestamp ? formatDateForCSV(log.timestamp) : '',
      LEVEL_LABELS[log.level] || log.level,
      log.message,
    ]);
  },

  toJSON(data: LogsWidgetData, metadata?: Partial<ExportMetadata>): object {
    // Compter les logs par niveau
    const levelCounts = data.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'logs',
        ...metadata,
      },
      container: data.container,
      host: data.host,
      summary: {
        total_lines: data.line_count,
        by_level: levelCounts,
      },
      logs: data.logs.map((l) => ({
        timestamp: l.timestamp,
        level: l.level,
        message: l.message,
      })),
      fetched_at: data.fetched_at,
    };
  },

  toPDFContent(data: LogsWidgetData, title?: string): PDFContent {
    // Compter les logs par niveau
    const levelCounts = data.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sections: PDFSection[] = [
      {
        title: 'Informations',
        type: 'stats',
        content: [
          `Container: ${data.container}`,
          `Serveur: ${data.host}`,
          `Lignes de log: ${data.line_count}`,
        ],
      },
      {
        title: 'Répartition par Niveau',
        type: 'stats',
        content: Object.entries(levelCounts).map(
          ([level, count]) => `${LEVEL_LABELS[level] || level}: ${count}`
        ),
      },
    ];

    // Filtrer les erreurs et warnings pour le rapport
    const importantLogs = data.logs.filter(
      (l) => l.level === 'error' || l.level === 'warning'
    );

    if (importantLogs.length > 0) {
      sections.push({
        title: 'Erreurs et Avertissements',
        type: 'list',
        content: importantLogs.slice(0, 15).map((l) => {
          const timestamp = l.timestamp
            ? new Date(l.timestamp).toLocaleTimeString('fr-FR')
            : '';
          const prefix = l.level === 'error' ? '[ERR]' : '[WARN]';
          const msg = l.message.length > 80 ? l.message.substring(0, 77) + '...' : l.message;
          return `${prefix} ${timestamp} ${msg}`;
        }),
      });
    }

    return {
      title: title || `Rapport Logs - ${data.container}`,
      subtitle: `Serveur: ${data.host}`,
      generatedAt: new Date().toISOString(),
      sections,
      tables: [
        {
          title: 'Derniers Logs',
          headers: ['Heure', 'Niveau', 'Message'],
          rows: data.logs.slice(0, 30).map((l) => [
            l.timestamp ? new Date(l.timestamp).toLocaleTimeString('fr-FR') : '-',
            LEVEL_LABELS[l.level] || l.level,
            l.message.length > 50 ? l.message.substring(0, 47) + '...' : l.message,
          ]),
        },
      ],
      footer: `Données récupérées le ${formatDateForCSV(data.fetched_at)}`,
    };
  },
};
