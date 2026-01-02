/**
 * Module d'export universel pour les widgets
 * Factory pattern pour gérer les différents types de widgets
 */

// Types
export type {
  ExportFormat,
  ExportOptions,
  ExportMetadata,
  PDFContent,
  PDFSection,
  PDFTable,
  IWidgetExportAdapter,
  DockerWidgetData,
  PingWidgetData,
  VikunjaWidgetData,
  CrowdSecWidgetData,
  LogsWidgetData,
  RssWidgetData,
  VMStatusWidgetData,
  CalendarWidgetData,
  NotesWidgetData,
  NoteData,
} from './types';

// Exporters
export { exportToCSV, formatDateForCSV, formatPercentForCSV, formatBytesForCSV } from './csvExporter';
export { exportToJSON, sanitizeDataForExport } from './jsonExporter';
export { exportToPDF } from './pdfExporter';
export {
  exportToImage,
  captureToCanvas,
  captureToDataURL,
  exportCanvasToImage,
  canvasToDataURL,
  generateImageFilename,
  prepareElementForCapture,
  cleanupCapturedElement,
} from './imageExporter';

// Adapters
import { dockerExportAdapter } from './adapters/dockerAdapter';
import { pingExportAdapter } from './adapters/pingAdapter';
import { vikunjaExportAdapter } from './adapters/vikunjaAdapter';
import { crowdsecExportAdapter } from './adapters/crowdsecAdapter';
import { logsExportAdapter } from './adapters/logsAdapter';
import { rssExportAdapter } from './adapters/rssAdapter';
import { vmStatusExportAdapter } from './adapters/vmStatusAdapter';
import { calendarExportAdapter } from './adapters/calendarAdapter';
import { notesExportAdapter } from './adapters/notesAdapter';

import type { IWidgetExportAdapter } from './types';

// Registry of all adapters
const adapters: Record<string, IWidgetExportAdapter<unknown>> = {
  docker: dockerExportAdapter as IWidgetExportAdapter<unknown>,
  uptime_ping: pingExportAdapter as IWidgetExportAdapter<unknown>,
  vikunja: vikunjaExportAdapter as IWidgetExportAdapter<unknown>,
  crowdsec: crowdsecExportAdapter as IWidgetExportAdapter<unknown>,
  logs: logsExportAdapter as IWidgetExportAdapter<unknown>,
  rss: rssExportAdapter as IWidgetExportAdapter<unknown>,
  vm_status: vmStatusExportAdapter as IWidgetExportAdapter<unknown>,
  calendar: calendarExportAdapter as IWidgetExportAdapter<unknown>,
  notes: notesExportAdapter as IWidgetExportAdapter<unknown>,
};

/**
 * Get the export adapter for a specific widget type
 */
export function getExportAdapter(widgetType: string): IWidgetExportAdapter<unknown> | null {
  return adapters[widgetType] || null;
}

/**
 * Check if a widget type supports export
 */
export function supportsExport(widgetType: string): boolean {
  return widgetType in adapters;
}

/**
 * Get list of supported widget types
 */
export function getSupportedWidgetTypes(): string[] {
  return Object.keys(adapters);
}

/**
 * Get adapter display name
 */
export function getAdapterDisplayName(widgetType: string): string {
  const adapter = adapters[widgetType];
  return adapter?.displayName || widgetType;
}

/**
 * Check if widget type supports image export (PNG)
 */
export function supportsImageExport(widgetType: string): boolean {
  const adapter = adapters[widgetType];
  return adapter?.supportsImageExport || false;
}

/**
 * Check if widget type supports graph export
 */
export function supportsGraphExport(widgetType: string): boolean {
  const adapter = adapters[widgetType];
  return adapter?.supportsGraphExport || false;
}

/**
 * Generate a standardized filename for exports
 */
export function generateExportFilename(
  widgetType: string,
  widgetTitle: string,
  format: string,
  suffix?: string
): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const sanitizedTitle = widgetTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '')
    .substring(0, 30);

  const suffixPart = suffix ? `_${suffix}` : '';
  return `${widgetType}_${sanitizedTitle}${suffixPart}_${timestamp}.${format}`;
}

// Re-export individual adapters for direct use if needed
export {
  dockerExportAdapter,
  pingExportAdapter,
  vikunjaExportAdapter,
  crowdsecExportAdapter,
  logsExportAdapter,
  rssExportAdapter,
  vmStatusExportAdapter,
  calendarExportAdapter,
  notesExportAdapter,
};
