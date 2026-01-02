/**
 * Adaptateur d'export pour le widget CrowdSec
 */

import type {
  IWidgetExportAdapter,
  CrowdSecWidgetData,
  PDFContent,
  PDFSection,
  PDFTable,
  ExportMetadata,
} from '../types';
import { formatDateForCSV } from '../csvExporter';

export const crowdsecExportAdapter: IWidgetExportAdapter<CrowdSecWidgetData> = {
  widgetType: 'crowdsec',
  displayName: 'CrowdSec',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'Type',
      'IP',
      'Pays',
      'Scénario',
      'Origine',
      'Action/Type',
      'Durée',
      'Événements',
      'Créé le',
    ];
  },

  toCSVRows(data: CrowdSecWidgetData): string[][] {
    const rows: string[][] = [];

    // Exporter les décisions
    for (const decision of data.decisions) {
      rows.push([
        'Décision',
        decision.value,
        '',
        decision.scenario,
        decision.origin,
        decision.type,
        decision.duration,
        '',
        '',
      ]);
    }

    // Exporter les alertes
    for (const alert of data.alerts) {
      rows.push([
        'Alerte',
        alert.ip,
        alert.country,
        alert.scenario,
        '',
        '',
        '',
        String(alert.events_count),
        formatDateForCSV(alert.created_at),
      ]);
    }

    return rows;
  },

  toJSON(data: CrowdSecWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'crowdsec',
        ...metadata,
      },
      summary: {
        total_decisions: data.decisions_count,
        total_alerts: data.alerts_count,
      },
      metrics: data.metrics,
      decisions: data.decisions,
      alerts: data.alerts,
      fetched_at: data.fetched_at,
    };
  },

  toPDFContent(data: CrowdSecWidgetData, title?: string): PDFContent {
    const { metrics } = data;

    // Top scénarios
    const topScenarios = Object.entries(metrics.by_scenario || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Top pays
    const topCountries = Object.entries(metrics.by_country || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const sections: PDFSection[] = [
      {
        title: 'Métriques Globales',
        type: 'stats',
        content: [
          `Total décisions actives: ${metrics.total_decisions}`,
          `Total alertes: ${metrics.total_alerts}`,
        ],
      },
    ];

    if (topScenarios.length > 0) {
      sections.push({
        title: 'Top Scénarios',
        type: 'list',
        content: topScenarios.map(([scenario, count]) => `${scenario}: ${count}`),
      });
    }

    if (topCountries.length > 0) {
      sections.push({
        title: 'Top Pays',
        type: 'list',
        content: topCountries.map(([country, count]) => `${country}: ${count}`),
      });
    }

    const tables: PDFTable[] = [];

    // Table des décisions
    if (data.decisions.length > 0) {
      tables.push({
        title: 'Décisions Actives (Bans)',
        headers: ['IP', 'Type', 'Scénario', 'Durée'],
        rows: data.decisions.slice(0, 20).map((d) => [
          d.value,
          d.type,
          d.scenario.length > 25 ? d.scenario.substring(0, 22) + '...' : d.scenario,
          d.duration,
        ]),
      });
    }

    // Table des alertes
    if (data.alerts.length > 0) {
      tables.push({
        title: 'Alertes Récentes',
        headers: ['IP', 'Pays', 'Scénario', 'Événements'],
        rows: data.alerts.slice(0, 20).map((a) => [
          a.ip,
          a.country || '-',
          a.scenario.length > 25 ? a.scenario.substring(0, 22) + '...' : a.scenario,
          String(a.events_count),
        ]),
      });
    }

    return {
      title: title || 'Rapport Sécurité - CrowdSec',
      subtitle: `${data.decisions_count} décisions actives, ${data.alerts_count} alertes`,
      generatedAt: new Date().toISOString(),
      sections,
      tables,
      footer: `Données récupérées le ${formatDateForCSV(data.fetched_at)}`,
    };
  },
};
