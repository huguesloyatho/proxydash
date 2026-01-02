'use client';

import { useState, useRef } from 'react';
import {
  Stack,
  Group,
  Paper,
  Text,
  Button,
  Checkbox,
  Alert,
  Divider,
  List,
  ThemeIcon,
  Badge,
  Progress,
} from '@mantine/core';
import {
  IconDownload,
  IconUpload,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { securityApi, BackupConfig, ImportResult } from '@/lib/api/security';

export function BackupTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [exportConfig, setExportConfig] = useState<BackupConfig>({
    include_applications: true,
    include_categories: true,
    include_widgets: true,
    include_tabs: true,
    include_servers: true,
    include_npm_instances: true,
    include_notification_channels: true,
    include_alert_rules: true,
    include_templates: true,
    include_user_settings: true,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await securityApi.exportConfig(exportConfig);

      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxydash-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notifications.show({
        title: 'Export réussi',
        message: 'Le fichier de backup a été téléchargé',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      console.error('Export failed:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible d\'exporter la configuration',
        color: 'red',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      notifications.show({
        title: 'Erreur',
        message: 'Le fichier doit être au format JSON',
        color: 'red',
      });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const result = await securityApi.importConfig(file);
      setImportResult(result);

      if (result.success) {
        notifications.show({
          title: 'Import réussi',
          message: result.message,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
      }
    } catch (error) {
      console.error('Import failed:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible d\'importer la configuration',
        color: 'red',
      });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleExportOption = (key: keyof BackupConfig) => {
    setExportConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const exportOptions = [
    { key: 'include_applications', label: 'Applications' },
    { key: 'include_categories', label: 'Catégories' },
    { key: 'include_widgets', label: 'Widgets' },
    { key: 'include_tabs', label: 'Onglets personnalisés' },
    { key: 'include_servers', label: 'Serveurs (sans clés SSH)' },
    { key: 'include_npm_instances', label: 'Instances NPM (sans mots de passe)' },
    { key: 'include_notification_channels', label: 'Canaux de notification' },
    { key: 'include_alert_rules', label: 'Règles d\'alerte' },
    { key: 'include_templates', label: 'Templates de dashboard' },
  ] as const;

  return (
    <Stack>
      <Alert color="blue" icon={<IconInfoCircle size={18} />}>
        Exportez votre configuration pour la sauvegarder ou la transférer vers une autre instance.
        Les données sensibles (mots de passe, clés SSH) ne sont jamais incluses dans l&apos;export.
      </Alert>

      {/* Export Section */}
      <Paper withBorder p="lg">
        <Text fw={600} size="lg" mb="md">Exporter la configuration</Text>

        <Text size="sm" c="dimmed" mb="md">
          Sélectionnez les éléments à inclure dans l&apos;export :
        </Text>

        <Stack gap="xs" mb="lg">
          {exportOptions.map((opt) => (
            <Checkbox
              key={opt.key}
              label={opt.label}
              checked={exportConfig[opt.key]}
              onChange={() => toggleExportOption(opt.key)}
            />
          ))}
        </Stack>

        <Button
          leftSection={<IconDownload size={18} />}
          onClick={handleExport}
          loading={exporting}
        >
          Télécharger le backup
        </Button>
      </Paper>

      <Divider />

      {/* Import Section */}
      <Paper withBorder p="lg">
        <Text fw={600} size="lg" mb="md">Importer une configuration</Text>

        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="md">
          L&apos;import ajoutera les éléments manquants sans supprimer les existants.
          Les éléments en double seront ignorés.
        </Alert>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <Button
          leftSection={<IconUpload size={18} />}
          variant="light"
          onClick={() => fileInputRef.current?.click()}
          loading={importing}
        >
          Sélectionner un fichier JSON
        </Button>

        {/* Import Result */}
        {importResult && (
          <Paper withBorder p="md" mt="md">
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Résultat de l&apos;import</Text>
              <Badge color={importResult.success ? 'green' : 'red'}>
                {importResult.success ? 'Succès' : 'Erreur'}
              </Badge>
            </Group>

            <Text size="sm" mb="md">{importResult.message}</Text>

            {Object.keys(importResult.imported_counts).length > 0 && (
              <>
                <Text size="sm" fw={500} mb="xs">Éléments importés :</Text>
                <List size="sm" spacing="xs">
                  {Object.entries(importResult.imported_counts).map(([key, count]) => (
                    <List.Item
                      key={key}
                      icon={
                        <ThemeIcon color="green" size={20} radius="xl">
                          <IconCheck size={12} />
                        </ThemeIcon>
                      }
                    >
                      {key.replace(/_/g, ' ')}: {count}
                    </List.Item>
                  ))}
                </List>
              </>
            )}

            {importResult.warnings.length > 0 && (
              <>
                <Text size="sm" fw={500} mt="md" mb="xs" c="yellow">
                  Avertissements :
                </Text>
                <List size="sm" spacing="xs">
                  {importResult.warnings.map((warning, i) => (
                    <List.Item
                      key={i}
                      icon={
                        <ThemeIcon color="yellow" size={20} radius="xl">
                          <IconAlertTriangle size={12} />
                        </ThemeIcon>
                      }
                    >
                      {warning}
                    </List.Item>
                  ))}
                </List>
              </>
            )}

            {importResult.errors.length > 0 && (
              <>
                <Text size="sm" fw={500} mt="md" mb="xs" c="red">
                  Erreurs :
                </Text>
                <List size="sm" spacing="xs">
                  {importResult.errors.map((error, i) => (
                    <List.Item
                      key={i}
                      icon={
                        <ThemeIcon color="red" size={20} radius="xl">
                          <IconX size={12} />
                        </ThemeIcon>
                      }
                    >
                      {error}
                    </List.Item>
                  ))}
                </List>
              </>
            )}
          </Paper>
        )}
      </Paper>
    </Stack>
  );
}
