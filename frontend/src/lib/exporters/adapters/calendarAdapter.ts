/**
 * Adaptateur d'export pour le widget Calendrier
 */

import type {
  IWidgetExportAdapter,
  CalendarWidgetData,
  VikunjaTaskForCalendar,
  PDFContent,
  PDFSection,
  PDFTable,
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

export const calendarExportAdapter: IWidgetExportAdapter<CalendarWidgetData> = {
  widgetType: 'calendar',
  displayName: 'Calendrier',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'Type',
      'Titre',
      'Date de début',
      'Date de fin',
      'Journée entière',
      'Priorité',
      'Statut',
      'Labels',
    ];
  },

  toCSVRows(data: CalendarWidgetData): string[][] {
    const rows: string[][] = [];

    // Export iCal events
    data.events.forEach((event) => {
      rows.push([
        'Événement iCal',
        event.summary,
        formatDateForCSV(event.start),
        event.end ? formatDateForCSV(event.end) : '',
        event.all_day ? 'Oui' : 'Non',
        '',
        '',
        '',
      ]);
    });

    // Export Vikunja tasks
    data.upcomingTasks.forEach((task) => {
      rows.push([
        'Tâche Vikunja',
        task.title,
        task.due_date ? formatDateForCSV(task.due_date) : '',
        '',
        'Non',
        PRIORITY_LABELS[task.priority] || '',
        task.done ? 'Terminée' : 'En cours',
        task.labels?.map((l) => l.title).join(', ') || '',
      ]);
    });

    return rows;
  },

  toJSON(data: CalendarWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'calendar',
        ...metadata,
      },
      summary: {
        total_events: data.events.length,
        total_tasks: data.upcomingTasks.length,
        tasks_done: data.upcomingTasks.filter((t) => t.done).length,
        tasks_pending: data.upcomingTasks.filter((t) => !t.done).length,
      },
      events: data.events.map((e) => ({
        type: 'ical_event',
        summary: e.summary,
        start: e.start,
        end: e.end,
        all_day: e.all_day,
      })),
      tasks: data.upcomingTasks.map((t) => ({
        type: 'vikunja_task',
        id: t.id,
        title: t.title,
        done: t.done,
        priority: t.priority,
        priority_label: PRIORITY_LABELS[t.priority],
        due_date: t.due_date,
        project_id: t.project_id,
        labels: t.labels?.map((l) => ({
          id: l.id,
          title: l.title,
          color: l.hex_color,
        })),
      })),
    };
  },

  toPDFContent(data: CalendarWidgetData, title?: string): PDFContent {
    const pendingTasks = data.upcomingTasks.filter((t) => !t.done);
    const doneTasks = data.upcomingTasks.filter((t) => t.done);
    const highPriorityTasks = pendingTasks.filter((t) => t.priority >= 3);

    const sections: PDFSection[] = [
      {
        title: 'Résumé',
        type: 'stats',
        content: [
          `Événements iCal: ${data.events.length}`,
          `Tâches Vikunja: ${data.upcomingTasks.length}`,
          `Tâches en cours: ${pendingTasks.length}`,
          `Tâches terminées: ${doneTasks.length}`,
        ],
      },
    ];

    // High priority tasks
    if (highPriorityTasks.length > 0) {
      sections.push({
        title: 'Tâches Prioritaires',
        type: 'list',
        content: highPriorityTasks.slice(0, 10).map((t) => {
          const dueStr = t.due_date
            ? new Date(t.due_date).toLocaleDateString('fr-FR')
            : 'Pas de date';
          return `[P${t.priority}] ${t.title} - ${dueStr}`;
        }),
      });
    }

    // Upcoming events
    if (data.events.length > 0) {
      sections.push({
        title: 'Événements à venir',
        type: 'list',
        content: data.events.slice(0, 10).map((e) => {
          const startDate = new Date(e.start);
          const dateStr = startDate.toLocaleDateString('fr-FR');
          const timeStr = e.all_day
            ? 'Journée entière'
            : startDate.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });
          return `${e.summary} - ${dateStr} (${timeStr})`;
        }),
      });
    }

    const tables: PDFTable[] = [];

    // Tasks table
    if (pendingTasks.length > 0) {
      tables.push({
        title: 'Tâches en cours',
        headers: ['Titre', 'Date', 'Priorité', 'Labels'],
        rows: pendingTasks.slice(0, 20).map((t) => [
          t.title.length > 35 ? t.title.substring(0, 32) + '...' : t.title,
          t.due_date
            ? new Date(t.due_date).toLocaleDateString('fr-FR')
            : '-',
          PRIORITY_LABELS[t.priority] || '-',
          t.labels?.map((l) => l.title).join(', ') || '-',
        ]),
      });
    }

    // Events table
    if (data.events.length > 0) {
      tables.push({
        title: 'Événements iCal',
        headers: ['Événement', 'Date', 'Heure', 'Type'],
        rows: data.events.slice(0, 15).map((e) => {
          const startDate = new Date(e.start);
          return [
            e.summary.length > 35
              ? e.summary.substring(0, 32) + '...'
              : e.summary,
            startDate.toLocaleDateString('fr-FR'),
            e.all_day
              ? 'Journée'
              : startDate.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
            e.all_day ? 'Journée entière' : 'Ponctuel',
          ];
        }),
      });
    }

    return {
      title: title || 'Rapport Calendrier',
      subtitle: `${data.events.length} événements, ${data.upcomingTasks.length} tâches`,
      generatedAt: new Date().toISOString(),
      sections,
      tables,
    };
  },
};
