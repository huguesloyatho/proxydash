'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Paper,
  Text,
  Group,
  Badge,
  ActionIcon,
  Tooltip,
  Box,
  Loader,
  Center,
  Alert,
  Button,
  Modal,
  Stack,
  ThemeIcon,
} from '@mantine/core';
import {
  IconServer,
  IconWorld,
  IconRouter,
  IconRefresh,
  IconInfoCircle,
  IconExternalLink,
  IconDeviceFloppy,
  IconRestore,
} from '@tabler/icons-react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { infrastructureApi, InfrastructureSchema as InfraSchema, BackendWithApps, ApplicationInSchema, NodePosition } from '@/lib/api';

// Color palette for backends (matching the mesh map style)
const BACKEND_COLORS = [
  '#40c057', // green
  '#228be6', // blue
  '#fab005', // yellow
  '#fd7e14', // orange
  '#e64980', // pink
  '#7950f2', // violet
  '#15aabf', // cyan
  '#82c91e', // lime
];

function getBackendColor(index: number): string {
  return BACKEND_COLORS[index % BACKEND_COLORS.length];
}

// Custom NPM Node Component
function NpmNode({ data }: NodeProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #228be6 0%, #1971c2 100%)',
        borderRadius: '50%',
        width: 80,
        height: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(34, 139, 230, 0.5)',
        border: '3px solid rgba(255,255,255,0.3)',
        cursor: 'pointer',
      }}
    >
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
      <IconRouter size={28} color="white" />
      <Text size="xs" c="white" fw={600} style={{ marginTop: 4, textAlign: 'center', maxWidth: 70 }} lineClamp={1}>
        {data.label as string}
      </Text>
    </div>
  );
}

// Custom Backend Node Component
function BackendNode({ data }: NodeProps) {
  const color = data.color as string;
  const isOnline = data.isOnline as boolean;
  const appCount = (data.applications as ApplicationInSchema[] | undefined)?.length || 0;

  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />

      {/* Main circle */}
      <div
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
          borderRadius: '50%',
          width: 60,
          height: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 15px ${color}66`,
          border: '2px solid rgba(255,255,255,0.2)',
          cursor: 'pointer',
        }}
      >
        <IconServer size={20} color="white" />
      </div>

      {/* Status indicator */}
      <div
        style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: isOnline ? '#40c057' : '#fa5252',
          border: '2px solid #1a1b1e',
        }}
      />

      {/* App count badge */}
      {appCount > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            background: '#fd7e14',
            border: '2px solid #1a1b1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: 'white',
            padding: '0 4px',
          }}
        >
          {appCount}
        </div>
      )}

      {/* Label */}
      <Text
        size="xs"
        fw={500}
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 6,
          whiteSpace: 'nowrap',
          color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        {data.label as string}
      </Text>
      <Text
        size="xs"
        c="dimmed"
        style={{
          position: 'absolute',
          top: 'calc(100% + 18px)',
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize: 10,
        }}
      >
        {data.ip as string}
      </Text>
    </div>
  );
}

// Custom Application Node Component
function AppNode({ data }: NodeProps) {
  const color = data.color as string;

  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

      <Tooltip label={`${data.label} - ${data.url}`} withArrow>
        <div
          style={{
            background: `${color}33`,
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${color}`,
            cursor: 'pointer',
          }}
        >
          {data.icon ? (
            <img
              src={data.icon as string}
              alt=""
              style={{ width: 18, height: 18, borderRadius: 4 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <IconWorld size={16} color={color} />
          )}
        </div>
      </Tooltip>
    </div>
  );
}

const nodeTypes = {
  npm: NpmNode,
  backend: BackendNode,
  app: AppNode,
};

// Backend detail modal
interface BackendDetailModalProps {
  backend: BackendWithApps | null;
  onClose: () => void;
}

function BackendDetailModal({ backend, onClose }: BackendDetailModalProps) {
  if (!backend) return null;

  return (
    <Modal
      opened={!!backend}
      onClose={onClose}
      title={
        <Group gap="sm">
          <ThemeIcon color="green" variant="light">
            <IconServer size={18} />
          </ThemeIcon>
          <Text fw={600}>{backend.display_name || backend.hostname}</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        <Group gap="xs">
          <Badge color="gray" variant="light">IP: {backend.ip_address || backend.hostname}</Badge>
          {backend.ports.length > 0 && (
            <Badge color="blue" variant="light">Ports: {backend.ports.join(', ')}</Badge>
          )}
          <Badge color={backend.is_online ? 'green' : 'red'} variant="light">
            {backend.is_online ? 'En ligne' : 'Hors ligne'}
          </Badge>
        </Group>

        <Text fw={500} size="sm">Applications hébergées ({backend.applications.length})</Text>

        <Stack gap="xs">
          {backend.applications.map((app) => (
            <Paper key={app.id} p="sm" withBorder>
              <Group justify="space-between">
                <Group gap="sm">
                  {app.icon && (
                    <img
                      src={app.icon}
                      alt=""
                      style={{ width: 20, height: 20, borderRadius: 4 }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <Text size="sm" fw={500}>{app.name}</Text>
                    {app.forward_port && (
                      <Text size="xs" c="dimmed">Port: {app.forward_port}</Text>
                    )}
                  </div>
                </Group>
                <ActionIcon
                  variant="subtle"
                  component="a"
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Modal>
  );
}

export function InfrastructureSchema() {
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedBackend, setSelectedBackend] = useState<BackendWithApps | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialLoadDone = useRef(false);

  const { data: schema, isLoading, error } = useQuery({
    queryKey: ['infrastructure', 'schema'],
    queryFn: infrastructureApi.getSchema,
  });

  const refreshMutation = useMutation({
    mutationFn: infrastructureApi.refresh,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['infrastructure'] });
      notifications.show({
        title: 'Infrastructure rafraîchie',
        message: `${data.backends_detected} backend(s) détecté(s)`,
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de rafraîchir l\'infrastructure',
        color: 'red',
      });
    },
  });

  const saveLayoutMutation = useMutation({
    mutationFn: infrastructureApi.saveLayout,
    onSuccess: (data) => {
      setHasUnsavedChanges(false);
      notifications.show({
        title: 'Disposition sauvegardée',
        message: data.message,
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de sauvegarder la disposition',
        color: 'red',
      });
    },
  });

  const resetLayoutMutation = useMutation({
    mutationFn: infrastructureApi.resetLayout,
    onSuccess: () => {
      setHasUnsavedChanges(false);
      initialLoadDone.current = false;
      queryClient.invalidateQueries({ queryKey: ['infrastructure', 'schema'] });
      notifications.show({
        title: 'Disposition réinitialisée',
        message: 'La disposition par défaut a été restaurée',
        color: 'blue',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de réinitialiser la disposition',
        color: 'red',
      });
    },
  });

  // Save current layout
  const handleSaveLayout = useCallback(() => {
    const positions: NodePosition[] = nodes.map(node => {
      let nodeType: 'npm' | 'backend' | 'app';
      let nodeId: number;

      if (node.id.startsWith('npm-')) {
        nodeType = 'npm';
        nodeId = parseInt(node.id.replace('npm-', ''));
      } else if (node.id.startsWith('backend-')) {
        nodeType = 'backend';
        nodeId = parseInt(node.id.replace('backend-', ''));
      } else {
        nodeType = 'app';
        nodeId = parseInt(node.id.replace('app-', ''));
      }

      return {
        node_type: nodeType,
        node_id: nodeId,
        position_x: node.position.x,
        position_y: node.position.y,
      };
    });

    saveLayoutMutation.mutate(positions);
  }, [nodes, saveLayoutMutation]);

  // Track node changes
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    // Mark as changed if nodes were moved (not just selected)
    if (initialLoadDone.current && changes.some(change => change.type === 'position' && 'position' in change)) {
      setHasUnsavedChanges(true);
    }
  }, [onNodesChange]);

  // Generate nodes and edges from schema data
  useEffect(() => {
    if (!schema) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Default layout positions
    const centerX = 400;
    const npmY = 50;
    const backendStartY = 200;
    const npmSpacing = 200;
    const npmStartX = centerX - ((schema.npm_instances.length - 1) * npmSpacing) / 2;

    // Add NPM instances at the top (use saved position if available)
    schema.npm_instances.forEach((npm, index) => {
      const defaultX = npmStartX + index * npmSpacing;
      const defaultY = npmY;

      newNodes.push({
        id: `npm-${npm.id}`,
        type: 'npm',
        position: {
          x: npm.position_x ?? defaultX,
          y: npm.position_y ?? defaultY
        },
        data: { label: npm.name, isActive: npm.is_active },
      });
    });

    // Group backends by NPM instance
    const backendsByNpm = new Map<number, BackendWithApps[]>();
    for (const [npmIdStr, hostnames] of Object.entries(schema.links)) {
      const npmId = parseInt(npmIdStr);
      const backends = schema.backends.filter(b => hostnames.includes(b.hostname));
      backendsByNpm.set(npmId, backends);
    }

    // Position backends
    let globalBackendIndex = 0;

    schema.npm_instances.forEach((npm, npmIndex) => {
      const npmBackends = backendsByNpm.get(npm.id) || [];
      const npmX = npmStartX + npmIndex * npmSpacing;

      // Arrange backends in a semi-circle below the NPM (default layout)
      const radius = 150 + Math.min(npmBackends.length * 20, 100);
      const angleSpread = Math.PI * 0.8;
      const startAngle = Math.PI / 2 - angleSpread / 2;

      npmBackends.forEach((backend, backendIndex) => {
        const angle = startAngle + (angleSpread * backendIndex) / Math.max(npmBackends.length - 1, 1);
        const defaultBackendX = npmX + Math.cos(angle) * radius - 30;
        const defaultBackendY = backendStartY + Math.sin(angle) * radius * 0.6;

        const color = getBackendColor(globalBackendIndex);

        // Use saved position if available
        const backendX = backend.position_x ?? defaultBackendX;
        const backendY = backend.position_y ?? defaultBackendY;

        newNodes.push({
          id: `backend-${backend.id}`,
          type: 'backend',
          position: { x: backendX, y: backendY },
          data: {
            label: backend.display_name || backend.hostname,
            ip: backend.ip_address || backend.hostname,
            color,
            isOnline: backend.is_online,
            applications: backend.applications,
            backend,
          },
        });

        // Edge from NPM to backend
        newEdges.push({
          id: `edge-npm-${npm.id}-backend-${backend.id}`,
          source: `npm-${npm.id}`,
          target: `backend-${backend.id}`,
          style: { stroke: color, strokeWidth: 2, opacity: 0.6 },
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color },
        });

        // Add application nodes around the backend
        const appRadius = 50 + backend.applications.length * 5;
        const visibleApps = backend.applications.filter(app => app.is_visible);

        visibleApps.forEach((app, appIndex) => {
          const appAngle = (2 * Math.PI * appIndex) / visibleApps.length - Math.PI / 2;
          const defaultAppX = backendX + Math.cos(appAngle) * appRadius;
          const defaultAppY = backendY + Math.sin(appAngle) * appRadius;

          // Use saved position if available
          const appX = app.position_x ?? defaultAppX;
          const appY = app.position_y ?? defaultAppY;

          newNodes.push({
            id: `app-${app.id}`,
            type: 'app',
            position: { x: appX, y: appY },
            data: {
              label: app.name,
              url: app.url,
              icon: app.icon,
              color,
            },
          });

          newEdges.push({
            id: `edge-backend-${backend.id}-app-${app.id}`,
            source: `backend-${backend.id}`,
            target: `app-${app.id}`,
            style: { stroke: color, strokeWidth: 1, opacity: 0.4 },
          });
        });

        globalBackendIndex++;
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);

    // Mark initial load as done after a short delay
    setTimeout(() => {
      initialLoadDone.current = true;
    }, 100);
  }, [schema, setNodes, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'backend' && node.data.backend) {
      setSelectedBackend(node.data.backend as BackendWithApps);
    }
  }, []);

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Erreur">
        Impossible de charger le schéma d&apos;infrastructure
      </Alert>
    );
  }

  if (!schema || schema.backends.length === 0) {
    return (
      <Alert color="blue" title="Aucune donnée" icon={<IconInfoCircle />}>
        <Stack gap="sm">
          <Text size="sm">
            Aucun backend n&apos;a été détecté. Cela peut signifier que:
          </Text>
          <Text size="sm" component="ul" style={{ margin: 0 }}>
            <li>Aucune instance NPM n&apos;est configurée</li>
            <li>La synchronisation NPM n&apos;a pas encore eu lieu</li>
            <li>Les proxy hosts n&apos;ont pas de forward_host configuré</li>
          </Text>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => refreshMutation.mutate()}
            loading={refreshMutation.isPending}
          >
            Lancer une synchronisation
          </Button>
        </Stack>
      </Alert>
    );
  }

  return (
    <Box style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
      {/* Stats header */}
      <Paper p="md" mb="md" withBorder>
        <Group justify="space-between">
          <Group gap="xl">
            <Group gap="xs">
              <ThemeIcon size="sm" color="blue" variant="light">
                <IconRouter size={14} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                {schema.stats.npm_instances_count} NPM
              </Text>
            </Group>
            <Group gap="xs">
              <ThemeIcon size="sm" color="green" variant="light">
                <IconServer size={14} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                {schema.stats.backends_count} Backend{schema.stats.backends_count > 1 ? 's' : ''}
              </Text>
            </Group>
            <Group gap="xs">
              <ThemeIcon size="sm" color="orange" variant="light">
                <IconWorld size={14} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                {schema.stats.applications_count} Application{schema.stats.applications_count > 1 ? 's' : ''}
              </Text>
            </Group>
          </Group>

          {/* Legend */}
          <Group gap="lg">
            <Group gap="xs">
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#40c057' }} />
              <Text size="xs" c="dimmed">En ligne</Text>
            </Group>
            <Group gap="xs">
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fa5252' }} />
              <Text size="xs" c="dimmed">Hors ligne</Text>
            </Group>
          </Group>

          <Group gap="xs">
            {hasUnsavedChanges && (
              <Badge color="yellow" variant="light">
                Modifications non sauvegardées
              </Badge>
            )}
            <Tooltip label="Sauvegarder la disposition">
              <Button
                variant="light"
                color="green"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveLayout}
                loading={saveLayoutMutation.isPending}
                disabled={!hasUnsavedChanges}
              >
                Sauvegarder
              </Button>
            </Tooltip>
            <Tooltip label="Réinitialiser la disposition">
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconRestore size={16} />}
                onClick={() => resetLayoutMutation.mutate()}
                loading={resetLayoutMutation.isPending}
              >
                Réinitialiser
              </Button>
            </Tooltip>
            <Tooltip label="Rafraîchir les données">
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => refreshMutation.mutate()}
                loading={refreshMutation.isPending}
              >
                Rafraîchir
              </Button>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      {/* Graph */}
      <Paper
        withBorder
        style={{
          height: 'calc(100% - 80px)',
          background: 'linear-gradient(180deg, #1a1b1e 0%, #141517 100%)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
          }}
        >
          <Background color="#333" gap={20} />
          <Controls
            style={{
              background: '#25262b',
              borderRadius: 8,
              border: '1px solid #373A40',
            }}
          />
          <MiniMap
            style={{
              background: '#1a1b1e',
              borderRadius: 8,
              border: '1px solid #373A40',
            }}
            nodeColor={(node) => {
              if (node.type === 'npm') return '#228be6';
              if (node.type === 'backend') return (node.data.color as string) || '#40c057';
              return '#666';
            }}
            maskColor="rgba(0,0,0,0.8)"
          />
        </ReactFlow>
      </Paper>

      <BackendDetailModal
        backend={selectedBackend}
        onClose={() => setSelectedBackend(null)}
      />
    </Box>
  );
}
