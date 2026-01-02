/**
 * Export Image (PNG) - Capture des widgets ou graphiques en image
 * Utilise html2canvas pour la capture
 */

import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

export interface ImageExportOptions {
  scale?: number;           // Facteur de mise à l'échelle (défaut: 2 pour haute résolution)
  backgroundColor?: string; // Couleur de fond (défaut: blanc)
  useCORS?: boolean;        // Autoriser les images cross-origin
  logging?: boolean;        // Logger les opérations (debug)
}

const DEFAULT_OPTIONS: ImageExportOptions = {
  scale: 2,
  backgroundColor: '#ffffff',
  useCORS: true,
  logging: false,
};

/**
 * Capture un élément HTML en image PNG et le télécharge
 */
export async function exportToImage(
  element: HTMLElement,
  filename: string,
  options: ImageExportOptions = {}
): Promise<void> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const canvas = await html2canvas(element, {
      scale: mergedOptions.scale,
      backgroundColor: mergedOptions.backgroundColor,
      useCORS: mergedOptions.useCORS,
      logging: mergedOptions.logging,
      // Optimisations pour les widgets
      allowTaint: false,
      foreignObjectRendering: true,
    });

    // Convertir en blob et télécharger
    canvas.toBlob((blob) => {
      if (blob) {
        const finalFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
        saveAs(blob, finalFilename);
      } else {
        throw new Error('Failed to create image blob');
      }
    }, 'image/png');
  } catch (error) {
    console.error('Image export failed:', error);
    throw error;
  }
}

/**
 * Capture un élément HTML et retourne le canvas
 * Utile pour intégrer dans un PDF
 */
export async function captureToCanvas(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<HTMLCanvasElement> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  return html2canvas(element, {
    scale: mergedOptions.scale,
    backgroundColor: mergedOptions.backgroundColor,
    useCORS: mergedOptions.useCORS,
    logging: mergedOptions.logging,
    allowTaint: false,
    foreignObjectRendering: true,
  });
}

/**
 * Capture un élément et retourne une data URL (base64)
 * Utile pour l'intégration dans des PDF
 */
export async function captureToDataURL(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<string> {
  const canvas = await captureToCanvas(element, options);
  return canvas.toDataURL('image/png');
}

/**
 * Capture un canvas existant (pour les graphiques)
 */
export function exportCanvasToImage(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  canvas.toBlob((blob) => {
    if (blob) {
      const finalFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
      saveAs(blob, finalFilename);
    } else {
      throw new Error('Failed to create image blob from canvas');
    }
  }, 'image/png');
}

/**
 * Capture un canvas et retourne une data URL
 */
export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * Génère le nom de fichier image avec timestamp
 */
export function generateImageFilename(
  widgetType: string,
  widgetTitle?: string,
  suffix?: string
): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const sanitizedTitle = widgetTitle
    ? widgetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    : widgetType;

  const suffixPart = suffix ? `_${suffix}` : '';
  return `${widgetType}_${sanitizedTitle}${suffixPart}_${timestamp}.png`;
}

/**
 * Prépare un élément pour la capture (clone et styles)
 * Utile pour capturer sans affecter l'affichage original
 */
export function prepareElementForCapture(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;

  // S'assurer que l'élément est visible et a les bons styles
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '-9999px';
  clone.style.width = `${element.offsetWidth}px`;
  clone.style.height = `${element.offsetHeight}px`;

  document.body.appendChild(clone);

  return clone;
}

/**
 * Nettoie un élément cloné après capture
 */
export function cleanupCapturedElement(element: HTMLElement): void {
  if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
}
