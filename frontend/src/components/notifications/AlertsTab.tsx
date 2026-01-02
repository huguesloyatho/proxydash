'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Group,
  Button,
  Table,
  ActionIcon,
  Badge,
  Text,
  Modal,
  Textarea,
  Select,
  LoadingOverlay,
  Menu,
  Paper,
  Title,
  Code,
} from '@mantine/core';
import {
  IconCheck,
  IconCheckbox,
  IconTrash,
  IconDots,
  IconEye,
  IconRefresh,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { notificationsApi } from '@/lib/api/notifications';
import type { AlertListItem, Alert, AlertSeverity, AlertStatus } from '@/types';

interface AlertsTabProps {
  onUpdate: () => void;
}

const severityColors: Record<AlertSeverity, string> = {
  info: 'blue',
  warning: 'yellow',
  error: 'orange',
  critical: 'red',
};

const statusColors: Record<AlertStatus, string> = {
  active: 'red',
  acknowledged: 'yellow',
  resolved: 'green',
};

const statusLabels: Record<AlertStatus, string> = {
  active: 'Active',
  acknowledged: 'Acquittée',
  resolved: 'Résolue',
};

export function AlertsTab({ onUpdate }: AlertsTabProps) {
  const [alerts, setAlerts] = useState<AlertListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<AlertStatus | ''>('');
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | ''>('');

  useEffect(() => {
    loadAlerts();
  }, [filterStatus, filterSeverity]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params: { status?: AlertStatus; severity?: AlertSeverity } = {};
      if (filterStatus) params.status = filterStatus;
      if (filterSeverity) params.severity = filterSeverity;

      const data = await notificationsApi.listAlerts(params);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const alert = await notificationsApi.getAlert(id);
      setSelectedAlert(alert);
      setDetailModalOpen(true);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger l\'alerte',
        color: 'red',
      });
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await notificationsApi.acknowledgeAlert(id);
      notifications.show({
        title: 'Succès',
        message: 'Alerte acquittée',
        color: 'green',
      });
      loadAlerts();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible d\'acquitter',
        color: 'red',
      });
    }
  };

  const handleOpenResolve = async (id: number) => {
    try {
      const alert = await notificationsApi.getAlert(id);
      setSelectedAlert(alert);
      setResolutionNote('');
      setResolveModalOpen(true);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger l\'alerte',
        color: 'red',
      });
    }
  };

  const handleResolve = async () => {
    if (!selectedAlert) return;

    try {
      await notificationsApi.resolveAlert(selectedAlert.id, resolutionNote || undefined);
      notifications.show({
        title: 'Succès',
        message: 'Alerte résolue',
        color: 'green',
      });
      setResolveModalOpen(false);
      loadAlerts();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de résoudre',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette alerte ?')) return;

    try {
      await notificationsApi.deleteAlert(id);
      notifications.show({
        title: 'Succès',
        message: 'Alerte supprimée',
        color: 'green',
      });
      loadAlerts();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de supprimer',
        color: 'red',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={loading} />

      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Statut"
            clearable
            data={[
              { value: 'active', label: 'Active' },
              { value: 'acknowledged', label: 'Acquittée' },
              { value: 'resolved', label: 'Résolue' },
            ]}
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as AlertStatus | '')}
            w={150}
          />
          <Select
            placeholder="Sévérité"
            clearable
            data={[
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'error', label: 'Error' },
              { value: 'critical', label: 'Critical' },
            ]}
            value={filterSeverity}
            onChange={(v) => setFilterSeverity(v as AlertSeverity | '')}
            w={150}
          />
        </Group>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={loadAlerts}
        >
          Actualiser
        </Button>
      </Group>

      {alerts.length === 0 && !loading ? (
        <Text c="dimmed" ta="center" py="xl">
          Aucune alerte trouvée avec ces filtres.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Titre</Table.Th>
              <Table.Th>Règle</Table.Th>
              <Table.Th>Sévérité</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th w={100}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {alerts.map((alert) => (
              <Table.Tr key={alert.id}>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>
                    {alert.title}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {alert.rule_name || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={severityColors[alert.severity]} variant="light">
                    {alert.severity}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[alert.status]} variant="filled">
                    {statusLabels[alert.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(alert.created_at)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEye size={14} />}
                        onClick={() => handleViewDetail(alert.id)}
                      >
                        Détails
                      </Menu.Item>
                      {alert.status === 'active' && (
                        <Menu.Item
                          leftSection={<IconCheckbox size={14} />}
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acquitter
                        </Menu.Item>
                      )}
                      {alert.status !== 'resolved' && (
                        <Menu.Item
                          leftSection={<IconCheck size={14} />}
                          onClick={() => handleOpenResolve(alert.id)}
                        >
                          Résoudre
                        </Menu.Item>
                      )}
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => handleDelete(alert.id)}
                      >
                        Supprimer
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Detail Modal */}
      <Modal
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Détails de l'alerte"
        size="lg"
      >
        {selectedAlert && (
          <Stack>
            <Group justify="space-between">
              <Badge color={severityColors[selectedAlert.severity]} size="lg">
                {selectedAlert.severity.toUpperCase()}
              </Badge>
              <Badge color={statusColors[selectedAlert.status]} size="lg" variant="filled">
                {statusLabels[selectedAlert.status]}
              </Badge>
            </Group>

            <Title order={4}>{selectedAlert.title}</Title>
            <Text>{selectedAlert.message}</Text>

            {selectedAlert.context && Object.keys(selectedAlert.context).length > 0 && (
              <Paper withBorder p="sm">
                <Text size="sm" fw={500} mb="xs">
                  Contexte
                </Text>
                <Code block>{JSON.stringify(selectedAlert.context, null, 2)}</Code>
              </Paper>
            )}

            <Stack gap="xs">
              <Text size="sm">
                <strong>Créée le:</strong> {formatDate(selectedAlert.created_at)}
              </Text>
              {selectedAlert.acknowledged_at && (
                <Text size="sm">
                  <strong>Acquittée le:</strong> {formatDate(selectedAlert.acknowledged_at)}
                </Text>
              )}
              {selectedAlert.resolved_at && (
                <Text size="sm">
                  <strong>Résolue le:</strong> {formatDate(selectedAlert.resolved_at)}
                </Text>
              )}
              {selectedAlert.resolution_note && (
                <Text size="sm">
                  <strong>Note de résolution:</strong> {selectedAlert.resolution_note}
                </Text>
              )}
            </Stack>

            {selectedAlert.notifications_sent && selectedAlert.notifications_sent.length > 0 && (
              <Paper withBorder p="sm">
                <Text size="sm" fw={500} mb="xs">
                  Notifications envoyées
                </Text>
                <Stack gap="xs">
                  {selectedAlert.notifications_sent.map((n, i) => (
                    <Group key={i} gap="xs">
                      <Badge
                        color={n.success ? 'green' : 'red'}
                        size="sm"
                        variant="light"
                      >
                        {n.success ? 'OK' : 'Échec'}
                      </Badge>
                      <Text size="sm">Canal #{n.channel_id}</Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(n.sent_at)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setDetailModalOpen(false)}>
                Fermer
              </Button>
              {selectedAlert.status !== 'resolved' && (
                <Button
                  onClick={() => {
                    setDetailModalOpen(false);
                    setResolveModalOpen(true);
                  }}
                >
                  Résoudre
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Resolve Modal */}
      <Modal
        opened={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Résoudre l'alerte"
        size="md"
      >
        {selectedAlert && (
          <Stack>
            <Text>
              Résoudre l&apos;alerte: <strong>{selectedAlert.title}</strong>
            </Text>

            <Textarea
              label="Note de résolution (optionnel)"
              placeholder="Décrivez comment le problème a été résolu..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={4}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setResolveModalOpen(false)}>
                Annuler
              </Button>
              <Button color="green" onClick={handleResolve}>
                Marquer comme résolue
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
