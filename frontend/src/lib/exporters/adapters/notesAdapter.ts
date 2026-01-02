/**
 * Adaptateur d'export pour le widget Notes
 */

import type {
  IWidgetExportAdapter,
  PDFContent,
  PDFSection,
  ExportMetadata,
} from '../types';
import { formatDateForCSV } from '../csvExporter';

// Note type
export interface NoteData {
  id: number | string;
  title: string;
  content: string;
  color: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  // Nextcloud specific
  category?: string;
  favorite?: boolean;
}

export interface NotesWidgetData {
  notes: NoteData[];
  source: 'local' | 'nextcloud';
  counts: {
    total: number;
    pinned: number;
    archived: number;
  };
}

export const notesExportAdapter: IWidgetExportAdapter<NotesWidgetData> = {
  widgetType: 'notes',
  displayName: 'Notes',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'Titre',
      'Contenu',
      'Couleur',
      'Epinglé',
      'Archivé',
      'Catégorie',
      'Date de création',
      'Date de modification',
    ];
  },

  toCSVRows(data: NotesWidgetData): string[][] {
    return data.notes.map((note) => [
      note.title || 'Sans titre',
      note.content.replace(/\n/g, ' ').replace(/"/g, '""'), // Escape for CSV
      note.color || '',
      note.is_pinned ? 'Oui' : 'Non',
      note.is_archived ? 'Oui' : 'Non',
      note.category || '',
      formatDateForCSV(note.created_at),
      formatDateForCSV(note.updated_at),
    ]);
  },

  toJSON(data: NotesWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'notes',
        ...metadata,
      },
      summary: {
        total: data.counts.total,
        pinned: data.counts.pinned,
        archived: data.counts.archived,
        source: data.source,
      },
      notes: data.notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        color: n.color,
        is_pinned: n.is_pinned,
        is_archived: n.is_archived,
        category: n.category,
        created_at: n.created_at,
        updated_at: n.updated_at,
      })),
    };
  },

  toPDFContent(data: NotesWidgetData, title?: string): PDFContent {
    const pinnedNotes = data.notes.filter((n) => n.is_pinned && !n.is_archived);
    const regularNotes = data.notes.filter((n) => !n.is_pinned && !n.is_archived);
    const archivedNotes = data.notes.filter((n) => n.is_archived);

    const sections: PDFSection[] = [
      {
        title: 'Résumé',
        type: 'stats' as const,
        content: [
          `Total notes: ${data.counts.total}`,
          `Épinglées: ${data.counts.pinned}`,
          `Archivées: ${data.counts.archived}`,
          `Source: ${data.source === 'nextcloud' ? 'Nextcloud' : 'Locale'}`,
        ],
      },
    ];

    // Pinned notes section
    if (pinnedNotes.length > 0) {
      sections.push({
        title: 'Notes épinglées',
        type: 'list' as const,
        content: pinnedNotes.map((n) => {
          const preview = n.content.length > 100
            ? n.content.substring(0, 97) + '...'
            : n.content;
          return `${n.title || 'Sans titre'}: ${preview.replace(/\n/g, ' ')}`;
        }),
      });
    }

    // Regular notes section
    if (regularNotes.length > 0) {
      sections.push({
        title: 'Notes',
        type: 'list' as const,
        content: regularNotes.slice(0, 20).map((n) => {
          const preview = n.content.length > 100
            ? n.content.substring(0, 97) + '...'
            : n.content;
          return `${n.title || 'Sans titre'}: ${preview.replace(/\n/g, ' ')}`;
        }),
      });
    }

    // Archived notes count
    if (archivedNotes.length > 0) {
      sections.push({
        title: 'Archives',
        type: 'stats' as const,
        content: [
          `${archivedNotes.length} note(s) archivée(s)`,
        ],
      });
    }

    return {
      title: title || 'Rapport Notes',
      subtitle: `${data.counts.total} note(s) - Source: ${data.source === 'nextcloud' ? 'Nextcloud' : 'Locale'}`,
      generatedAt: new Date().toISOString(),
      sections,
      tables: [
        {
          title: 'Liste des Notes',
          headers: ['Titre', 'Aperçu', 'Statut', 'Modifié'],
          rows: data.notes
            .filter((n) => !n.is_archived)
            .slice(0, 30)
            .map((n) => [
              (n.title || 'Sans titre').length > 30
                ? (n.title || 'Sans titre').substring(0, 27) + '...'
                : n.title || 'Sans titre',
              n.content.length > 50
                ? n.content.substring(0, 47).replace(/\n/g, ' ') + '...'
                : n.content.replace(/\n/g, ' '),
              n.is_pinned ? 'Épinglée' : '-',
              new Date(n.updated_at).toLocaleDateString('fr-FR'),
            ]),
        },
      ],
    };
  },
};
