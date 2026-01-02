'use client';

import { useState, RefObject } from 'react';
import { Menu, ActionIcon, Tooltip, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconFileSpreadsheet,
  IconJson,
  IconFileText,
  IconPhoto,
  IconChartLine,
} from '@tabler/icons-react';
import {
  getExportAdapter,
  supportsExport,
  supportsImageExport,
  supportsGraphExport,
  generateExportFilename,
  exportToCSV,
  exportToJSON,
  exportToPDF,
  exportToImage,
  exportCanvasToImage,
} from '@/lib/exporters';

export interface ExportMenuProps {
  widgetType: string;
  widgetTitle: string;
  data: unknown;
  containerRef?: RefObject<HTMLDivElement | null>;
  graphCanvasRef?: RefObject<HTMLCanvasElement | null>;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

type ExportFormat = 'csv' | 'json' | 'pdf' | 'png' | 'png-graph';

export function ExportMenu({
  widgetType,
  widgetTitle,
  data,
  containerRef,
  graphCanvasRef,
  disabled = false,
  size = 'xs',
}: ExportMenuProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  // Check if this widget type supports export
  if (!supportsExport(widgetType) || !data) {
    return null;
  }

  const adapter = getExportAdapter(widgetType);
  if (!adapter) return null;

  const canExportImage = supportsImageExport(widgetType) && containerRef?.current;
  const canExportGraph = supportsGraphExport(widgetType) && graphCanvasRef?.current;

  const handleExport = async (format: ExportFormat) => {
    if (disabled || exporting) return;

    setExporting(format);

    try {
      switch (format) {
        case 'csv': {
          const headers = adapter.getCSVHeaders();
          const rows = adapter.toCSVRows(data);
          const filename = generateExportFilename(widgetType, widgetTitle, 'csv');
          exportToCSV(headers, rows, filename);
          showSuccessNotification('CSV');
          break;
        }

        case 'json': {
          const jsonData = adapter.toJSON(data, { widgetTitle });
          const filename = generateExportFilename(widgetType, widgetTitle, 'json');
          exportToJSON(jsonData, filename);
          showSuccessNotification('JSON');
          break;
        }

        case 'pdf': {
          const pdfContent = adapter.toPDFContent(data, widgetTitle);
          const filename = generateExportFilename(widgetType, widgetTitle, 'pdf');
          await exportToPDF(pdfContent, filename);
          showSuccessNotification('PDF');
          break;
        }

        case 'png': {
          if (!containerRef?.current) {
            throw new Error('Référence du widget non disponible');
          }
          const filename = generateExportFilename(widgetType, widgetTitle, 'png');
          await exportToImage(containerRef.current, filename);
          showSuccessNotification('PNG');
          break;
        }

        case 'png-graph': {
          if (!graphCanvasRef?.current) {
            throw new Error('Graphique non disponible');
          }
          const filename = generateExportFilename(widgetType, widgetTitle, 'png', 'graph');
          exportCanvasToImage(graphCanvasRef.current, filename);
          showSuccessNotification('PNG (graphique)');
          break;
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      notifications.show({
        title: 'Erreur d\'export',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
        color: 'red',
      });
    } finally {
      setExporting(null);
    }
  };

  const showSuccessNotification = (format: string) => {
    notifications.show({
      title: 'Export réussi',
      message: `Le fichier ${format} a été téléchargé`,
      color: 'green',
    });
  };

  const isExporting = exporting !== null;

  return (
    <Menu shadow="md" width={180} position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Exporter" withArrow>
          <ActionIcon
            variant="subtle"
            size={size}
            disabled={disabled || isExporting}
            loading={isExporting}
          >
            {isExporting ? <Loader size={12} /> : <IconDownload size={14} />}
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Exporter les données</Menu.Label>

        <Menu.Item
          leftSection={<IconFileSpreadsheet size={14} />}
          onClick={() => handleExport('csv')}
          disabled={exporting === 'csv'}
        >
          {exporting === 'csv' ? 'Export en cours...' : 'CSV (Excel)'}
        </Menu.Item>

        <Menu.Item
          leftSection={<IconJson size={14} />}
          onClick={() => handleExport('json')}
          disabled={exporting === 'json'}
        >
          {exporting === 'json' ? 'Export en cours...' : 'JSON'}
        </Menu.Item>

        <Menu.Item
          leftSection={<IconFileText size={14} />}
          onClick={() => handleExport('pdf')}
          disabled={exporting === 'pdf'}
        >
          {exporting === 'pdf' ? 'Export en cours...' : 'PDF (rapport)'}
        </Menu.Item>

        {(canExportImage || canExportGraph) && <Menu.Divider />}

        {canExportImage && (
          <Menu.Item
            leftSection={<IconPhoto size={14} />}
            onClick={() => handleExport('png')}
            disabled={exporting === 'png'}
          >
            {exporting === 'png' ? 'Capture en cours...' : 'PNG (widget)'}
          </Menu.Item>
        )}

        {canExportGraph && (
          <Menu.Item
            leftSection={<IconChartLine size={14} />}
            onClick={() => handleExport('png-graph')}
            disabled={exporting === 'png-graph'}
          >
            {exporting === 'png-graph' ? 'Capture en cours...' : 'PNG (graphique)'}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
