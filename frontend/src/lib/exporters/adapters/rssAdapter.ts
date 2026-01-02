/**
 * Adaptateur d'export pour le widget RSS
 */

import type {
  IWidgetExportAdapter,
  RssWidgetData,
  PDFContent,
  PDFSection,
  ExportMetadata,
} from '../types';
import { formatDateForCSV } from '../csvExporter';

export const rssExportAdapter: IWidgetExportAdapter<RssWidgetData> = {
  widgetType: 'rss',
  displayName: 'Flux RSS',
  supportsImageExport: false,
  supportsGraphExport: false,

  getCSVHeaders(): string[] {
    return [
      'Titre',
      'Source',
      'Auteur',
      'Date de publication',
      'URL',
      'Résumé',
      'Lu',
    ];
  },

  toCSVRows(data: RssWidgetData): string[][] {
    return data.articles.map((article) => [
      article.title,
      extractDomain(article.feed_url),
      article.author || '',
      article.published_at ? formatDateForCSV(article.published_at) : '',
      article.article_url || '',
      article.summary || '',
      article.is_read ? 'Oui' : 'Non',
    ]);
  },

  toJSON(data: RssWidgetData, metadata?: Partial<ExportMetadata>): object {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        widgetType: 'rss',
        ...metadata,
      },
      summary: {
        total_articles: data.counts.total,
        unread: data.counts.unread,
        archived: data.counts.archived,
        feeds: data.feed_urls,
        feeds_count: data.feed_urls.length,
      },
      articles: data.articles.map((a) => ({
        id: a.id,
        title: a.title,
        source: extractDomain(a.feed_url),
        feed_url: a.feed_url,
        article_url: a.article_url,
        author: a.author,
        summary: a.summary,
        image_url: a.image_url,
        published_at: a.published_at,
        fetched_at: a.fetched_at,
        is_read: a.is_read,
        is_archived: a.is_archived,
      })),
    };
  },

  toPDFContent(data: RssWidgetData, title?: string): PDFContent {
    // Group articles by source
    const articlesBySource = data.articles.reduce((acc, article) => {
      const source = extractDomain(article.feed_url);
      if (!acc[source]) acc[source] = [];
      acc[source].push(article);
      return acc;
    }, {} as Record<string, typeof data.articles>);

    const sections: PDFSection[] = [
      {
        title: 'Résumé',
        type: 'stats' as const,
        content: [
          `Total articles: ${data.counts.total}`,
          `Non lus: ${data.counts.unread}`,
          `Archivés: ${data.counts.archived}`,
          `Sources: ${data.feed_urls.length}`,
        ],
      },
      {
        title: 'Sources',
        type: 'list' as const,
        content: data.feed_urls.map((url) => extractDomain(url)),
      },
    ];

    // Add top articles by source
    Object.entries(articlesBySource)
      .slice(0, 3)
      .forEach(([source, articles]) => {
        sections.push({
          title: `Articles - ${source}`,
          type: 'list' as const,
          content: articles.slice(0, 5).map((a) => {
            const date = a.published_at
              ? new Date(a.published_at).toLocaleDateString('fr-FR')
              : '';
            return `${a.title} (${date})`;
          }),
        });
      });

    return {
      title: title || 'Rapport Flux RSS',
      subtitle: `${data.counts.total} articles de ${data.feed_urls.length} source(s)`,
      generatedAt: new Date().toISOString(),
      sections,
      tables: [
        {
          title: 'Articles Récents',
          headers: ['Titre', 'Source', 'Date', 'Lu'],
          rows: data.articles.slice(0, 20).map((a) => [
            a.title.length > 40 ? a.title.substring(0, 37) + '...' : a.title,
            extractDomain(a.feed_url),
            a.published_at
              ? new Date(a.published_at).toLocaleDateString('fr-FR')
              : '-',
            a.is_read ? 'Oui' : 'Non',
          ]),
        },
      ],
    };
  },
};

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return url;
  }
}
