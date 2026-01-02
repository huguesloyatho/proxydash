/**
 * Export CSV - Génère et télécharge des fichiers CSV
 */

import { saveAs } from 'file-saver';

/**
 * Échappe une valeur pour le format CSV
 * - Entoure de guillemets si contient virgule, guillemet ou saut de ligne
 * - Double les guillemets existants
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Si contient des caractères spéciaux, entourer de guillemets
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    // Doubler les guillemets existants et entourer de guillemets
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convertit un tableau 2D en chaîne CSV
 */
function arrayToCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSVValue).join(',');
  const dataLines = rows.map(row => row.map(escapeCSVValue).join(','));

  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * Génère et télécharge un fichier CSV
 */
export function exportToCSV(
  headers: string[],
  rows: string[][],
  filename: string
): void {
  // Générer le contenu CSV avec BOM UTF-8 pour Excel
  const csvContent = arrayToCSV(headers, rows);
  const BOM = '\uFEFF'; // UTF-8 BOM pour Excel
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });

  // S'assurer que le fichier a l'extension .csv
  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  saveAs(blob, finalFilename);
}

/**
 * Génère le nom de fichier avec timestamp
 */
export function generateCSVFilename(widgetType: string, widgetTitle?: string): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const sanitizedTitle = widgetTitle
    ? widgetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    : widgetType;

  return `${widgetType}_${sanitizedTitle}_${timestamp}.csv`;
}

/**
 * Utilitaire pour convertir des objets en lignes CSV
 */
export function objectsToCSVRows<T extends Record<string, unknown>>(
  objects: T[],
  keys: (keyof T)[]
): string[][] {
  return objects.map(obj =>
    keys.map(key => {
      const value = obj[key];
      if (Array.isArray(value)) {
        return value.join('; ');
      }
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return String(value ?? '');
    })
  );
}

/**
 * Formate une date ISO en format lisible
 */
export function formatDateForCSV(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Formate un pourcentage pour CSV
 */
export function formatPercentForCSV(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return `${value.toFixed(1)}%`;
}

/**
 * Formate des octets en taille lisible
 */
export function formatBytesForCSV(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
