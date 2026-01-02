/**
 * Export PDF - Génère et télécharge des fichiers PDF
 * Utilise jsPDF pour la génération
 */

import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import type { PDFContent, PDFTable, PDFSection } from './types';

// Configuration du PDF
const PDF_CONFIG = {
  margin: 20,
  lineHeight: 7,
  fontSize: {
    title: 18,
    subtitle: 12,
    sectionTitle: 14,
    body: 10,
    small: 8,
  },
  colors: {
    primary: [41, 128, 185] as [number, number, number],    // Bleu
    secondary: [127, 140, 141] as [number, number, number], // Gris
    success: [39, 174, 96] as [number, number, number],     // Vert
    warning: [243, 156, 18] as [number, number, number],    // Orange
    danger: [231, 76, 60] as [number, number, number],      // Rouge
    text: [44, 62, 80] as [number, number, number],         // Noir-bleu
    lightGray: [236, 240, 241] as [number, number, number], // Fond tableau
  },
};

/**
 * Génère et télécharge un PDF à partir du contenu structuré
 */
export async function exportToPDF(
  content: PDFContent,
  filename: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { margin } = PDF_CONFIG;
  let currentY = margin;

  // Fonction helper pour ajouter une nouvelle page si nécessaire
  const checkPageBreak = (neededSpace: number): void => {
    if (currentY + neededSpace > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
  };

  // === EN-TÊTE ===
  // Titre principal
  doc.setFontSize(PDF_CONFIG.fontSize.title);
  doc.setTextColor(...PDF_CONFIG.colors.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(content.title, margin, currentY);
  currentY += 10;

  // Sous-titre si présent
  if (content.subtitle) {
    doc.setFontSize(PDF_CONFIG.fontSize.subtitle);
    doc.setTextColor(...PDF_CONFIG.colors.secondary);
    doc.setFont('helvetica', 'normal');
    doc.text(content.subtitle, margin, currentY);
    currentY += 7;
  }

  // Date de génération
  doc.setFontSize(PDF_CONFIG.fontSize.small);
  doc.setTextColor(...PDF_CONFIG.colors.secondary);
  const dateText = `Généré le ${new Date(content.generatedAt).toLocaleString('fr-FR')}`;
  doc.text(dateText, margin, currentY);
  currentY += 10;

  // Ligne de séparation
  doc.setDrawColor(...PDF_CONFIG.colors.lightGray);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // === SECTIONS ===
  if (content.sections) {
    for (const section of content.sections) {
      checkPageBreak(30);
      currentY = renderSection(doc, section, currentY, margin, pageWidth);
    }
  }

  // === TABLES ===
  if (content.tables) {
    for (const table of content.tables) {
      checkPageBreak(50);
      currentY = renderTable(doc, table, currentY, margin, pageWidth);
    }
  }

  // === IMAGE (graphique) ===
  if (content.imageData) {
    checkPageBreak(80);
    currentY += 5;

    // Calculer les dimensions pour l'image
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = 60; // Hauteur fixe pour le graphique

    try {
      doc.addImage(content.imageData, 'PNG', margin, currentY, imgWidth, imgHeight);
      currentY += imgHeight + 10;
    } catch {
      // Si l'image échoue, continuer sans elle
      console.warn('Failed to add image to PDF');
    }
  }

  // === FOOTER ===
  if (content.footer) {
    // Aller en bas de la dernière page
    const footerY = pageHeight - 15;
    doc.setFontSize(PDF_CONFIG.fontSize.small);
    doc.setTextColor(...PDF_CONFIG.colors.secondary);
    doc.text(content.footer, margin, footerY);
  }

  // Footer avec numéro de page sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(PDF_CONFIG.fontSize.small);
    doc.setTextColor(...PDF_CONFIG.colors.secondary);
    const pageText = `Page ${i} / ${totalPages}`;
    const textWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - margin - textWidth, pageHeight - 10);

    // Logo/source
    doc.text('ProxyDash', margin, pageHeight - 10);
  }

  // Sauvegarder le PDF
  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const pdfBlob = doc.output('blob');
  saveAs(pdfBlob, finalFilename);
}

/**
 * Rend une section de texte
 */
function renderSection(
  doc: jsPDF,
  section: PDFSection,
  startY: number,
  margin: number,
  pageWidth: number
): number {
  let currentY = startY;
  const contentWidth = pageWidth - 2 * margin;

  // Titre de section
  if (section.title) {
    doc.setFontSize(PDF_CONFIG.fontSize.sectionTitle);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin, currentY);
    currentY += 8;
  }

  doc.setFontSize(PDF_CONFIG.fontSize.body);
  doc.setTextColor(...PDF_CONFIG.colors.text);
  doc.setFont('helvetica', 'normal');

  const contentArray = Array.isArray(section.content) ? section.content : [section.content];

  if (section.type === 'list') {
    // Liste à puces
    for (const item of contentArray) {
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth);
      doc.text(lines, margin + 5, currentY);
      currentY += lines.length * PDF_CONFIG.lineHeight;
    }
  } else if (section.type === 'stats') {
    // Statistiques en format clé: valeur
    for (const item of contentArray) {
      doc.text(item, margin, currentY);
      currentY += PDF_CONFIG.lineHeight;
    }
  } else {
    // Texte simple
    for (const item of contentArray) {
      const lines = doc.splitTextToSize(item, contentWidth);
      doc.text(lines, margin, currentY);
      currentY += lines.length * PDF_CONFIG.lineHeight;
    }
  }

  currentY += 5; // Espace après la section
  return currentY;
}

/**
 * Rend un tableau
 */
function renderTable(
  doc: jsPDF,
  table: PDFTable,
  startY: number,
  margin: number,
  pageWidth: number
): number {
  let currentY = startY;
  const contentWidth = pageWidth - 2 * margin;

  // Titre du tableau
  if (table.title) {
    doc.setFontSize(PDF_CONFIG.fontSize.sectionTitle);
    doc.setTextColor(...PDF_CONFIG.colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(table.title, margin, currentY);
    currentY += 8;
  }

  // Calculer les largeurs de colonnes
  const colCount = table.headers.length;
  const colWidth = contentWidth / colCount;
  const rowHeight = 8;

  // En-tête du tableau
  doc.setFillColor(...PDF_CONFIG.colors.primary);
  doc.rect(margin, currentY - 5, contentWidth, rowHeight, 'F');

  doc.setFontSize(PDF_CONFIG.fontSize.small);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');

  table.headers.forEach((header, index) => {
    const x = margin + index * colWidth + 2;
    const truncated = truncateText(doc, header, colWidth - 4);
    doc.text(truncated, x, currentY);
  });

  currentY += rowHeight;

  // Lignes de données
  doc.setTextColor(...PDF_CONFIG.colors.text);
  doc.setFont('helvetica', 'normal');

  table.rows.forEach((row, rowIndex) => {
    // Fond alterné
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...PDF_CONFIG.colors.lightGray);
      doc.rect(margin, currentY - 5, contentWidth, rowHeight, 'F');
    }

    row.forEach((cell, colIndex) => {
      const x = margin + colIndex * colWidth + 2;
      const truncated = truncateText(doc, cell, colWidth - 4);
      doc.text(truncated, x, currentY);
    });

    currentY += rowHeight;

    // Vérifier si on doit passer à une nouvelle page
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY > pageHeight - margin - 20) {
      doc.addPage();
      currentY = margin;

      // Répéter l'en-tête sur la nouvelle page
      doc.setFillColor(...PDF_CONFIG.colors.primary);
      doc.rect(margin, currentY - 5, contentWidth, rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');

      table.headers.forEach((header, index) => {
        const x = margin + index * colWidth + 2;
        const truncated = truncateText(doc, header, colWidth - 4);
        doc.text(truncated, x, currentY);
      });

      currentY += rowHeight;
      doc.setTextColor(...PDF_CONFIG.colors.text);
      doc.setFont('helvetica', 'normal');
    }
  });

  currentY += 10; // Espace après le tableau
  return currentY;
}

/**
 * Tronque le texte pour qu'il tienne dans la largeur donnée
 */
function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + '...';
}

/**
 * Génère le nom de fichier PDF avec timestamp
 */
export function generatePDFFilename(widgetType: string, widgetTitle?: string): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const sanitizedTitle = widgetTitle
    ? widgetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    : widgetType;

  return `${widgetType}_${sanitizedTitle}_${timestamp}.pdf`;
}
