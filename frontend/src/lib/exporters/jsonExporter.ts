/**
 * Export JSON - Génère et télécharge des fichiers JSON
 */

import { saveAs } from 'file-saver';
import type { ExportMetadata } from './types';

/**
 * Génère et télécharge un fichier JSON
 */
export function exportToJSON(
  data: object,
  filename: string,
  metadata?: Partial<ExportMetadata>
): void {
  // Construire l'objet avec metadata si fournie
  const exportData = metadata
    ? {
        _metadata: {
          exportedAt: new Date().toISOString(),
          source: 'ProxyDash',
          version: '1.0.0',
          ...metadata,
        },
        data,
      }
    : data;

  // Générer le JSON formaté
  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });

  // S'assurer que le fichier a l'extension .json
  const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;

  saveAs(blob, finalFilename);
}

/**
 * Génère le nom de fichier avec timestamp
 */
export function generateJSONFilename(widgetType: string, widgetTitle?: string): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const sanitizedTitle = widgetTitle
    ? widgetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    : widgetType;

  return `${widgetType}_${sanitizedTitle}_${timestamp}.json`;
}

/**
 * Nettoie les données sensibles avant export
 * Supprime les clés contenant des credentials
 */
export function sanitizeDataForExport<T extends object>(data: T): T {
  const sensitiveKeys = [
    'password',
    'token',
    'api_key',
    'apiKey',
    'secret',
    'credential',
    'ssh_key',
    'ssh_password',
    'api_token',
  ];

  function sanitize(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        // Vérifier si la clé contient un terme sensible
        const isSensitive = sensitiveKeys.some(
          sensitiveKey => key.toLowerCase().includes(sensitiveKey.toLowerCase())
        );

        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitize(value);
        }
      }
      return result;
    }

    return obj;
  }

  return sanitize(data) as T;
}

/**
 * Prépare les données pour l'export JSON avec nettoyage automatique
 */
export function prepareJSONExport<T extends object>(
  data: T,
  options: {
    sanitize?: boolean;
    includeMetadata?: boolean;
    widgetType?: string;
    widgetTitle?: string;
  } = {}
): object {
  const { sanitize = true, includeMetadata = true, widgetType, widgetTitle } = options;

  const cleanData = sanitize ? sanitizeDataForExport(data) : data;

  if (includeMetadata) {
    return {
      _metadata: {
        exportedAt: new Date().toISOString(),
        source: 'ProxyDash',
        version: '1.0.0',
        widgetType: widgetType || 'unknown',
        widgetTitle: widgetTitle || 'Export',
      },
      data: cleanData,
    };
  }

  return cleanData;
}
