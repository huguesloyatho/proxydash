/**
 * Adaptateur d'export pour le widget Vikunja
 */

import type {
  IWidgetExportAdapter,
  VikunjaWidgetData,
  PDFContent,
  PDFSection,
  ExportMetadata,
} from '../types';
import { formatDateForCSV } from '../csvExporter';

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Aucune',
  1: 'Basse',
  2: 'Moyenne',
  3: 'Haute',
  4: 'Urgente',
  5: 'Critique',
};

export const vikunjaExportAdapter: IWidgetExportAdapter<VikunjaWidgetData> = {
  widgetType: 'vikunja',
  displayName: 'Vikunja',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'ID',
      'Titre',
      'Terminée',
      'Priorité',
      'Date d\'échéance',
      'Projet ID',
      'Labels',
      'Assignés',
    ];
  },

  toCSVRows(data: VikunjaWidgetData): string[][] {
    return data.tasks.map((task) => [
      String(task.id),
      task.title,
      task.done ? 'Oui' : 'Non',
      PRIORITY_LABELS[task.priority] || String(task.priority),
      task.due_date ? formatDateForCSV(task.due_date) : '',
      String(task.project_id),
      task.labels?.map((l) => l.title).join(', ') || '',
      task.assignees?.map((a) => a.username).join(', ') || '',
    ]);
  },

  toJSON(data: VikunjaWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'vikunja',
        ...metadata,
      },
      summary: {
        total: data.total,
        completed: data.completed_count,
        incomplete: data.incomplete_count,
      },
      tasks: data.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        priority: t.priority,
        priority_label: PRIORITY_LABELS[t.priority] || 'Inconnue',
        due_date: t.due_date,
        project_id: t.project_id,
        labels: t.labels,
        assignees: t.assignees,
      })),
    };
  },

  toPDFContent(data: VikunjaWidgetData, title?: string): PDFContent {
    const incompleteTasks = data.tasks.filter((t) => !t.done);
    const completedTasks = data.tasks.filter((t) => t.done);

    const sections: PDFSection[] = [
      {
        title: 'Résumé',
        type: 'stats' as const,
        content: [
          `Total: ${data.total} tâches`,
          `Terminées: ${data.completed_count}`,
          `En cours: ${data.incomplete_count}`,
          `Progression: ${data.total > 0 ? ((data.completed_count / data.total) * 100).toFixed(1) : 0}%`,
        ],
      },
    ];

    // Section tâches en cours
    if (incompleteTasks.length > 0) {
      sections.push({
        title: 'Tâches en cours',
        type: 'list' as const,
        content: incompleteTasks.slice(0, 20).map((t) => {
          const priority = PRIORITY_LABELS[t.priority] || '';
          const dueDate = t.due_date ? ` - Échéance: ${formatDateForCSV(t.due_date)}` : '';
          return `[${priority}] ${t.title}${dueDate}`;
        }),
      });
    }

    // Section tâches terminées
    if (completedTasks.length > 0) {
      sections.push({
        title: 'Tâches terminées',
        type: 'list' as const,
        content: completedTasks.slice(0, 10).map((t) => `✓ ${t.title}`),
      });
    }

    return {
      title: title || 'Liste des Tâches - Vikunja',
      subtitle: `${data.incomplete_count} tâche(s) en cours`,
      generatedAt: new Date().toISOString(),
      sections,
      tables: [
        {
          title: 'Détail des Tâches',
          headers: ['Titre', 'Status', 'Priorité', 'Échéance'],
          rows: data.tasks.slice(0, 30).map((t) => [
            t.title.length > 40 ? t.title.substring(0, 37) + '...' : t.title,
            t.done ? '✓' : '○',
            PRIORITY_LABELS[t.priority] || '-',
            t.due_date ? new Date(t.due_date).toLocaleDateString('fr-FR') : '-',
          ]),
        },
      ],
      footer: 'Export depuis ProxyDash - Vikunja Widget',
    };
  },
};
