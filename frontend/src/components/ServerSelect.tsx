'use client';

import { Select, Group, Text, Badge, Loader } from '@mantine/core';
import { IconServer, IconPlug, IconPlugOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { serversApi } from '@/lib/api';
import { Server } from '@/types';
import { forwardRef } from 'react';

interface ServerSelectProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  filterDocker?: boolean; // Only show servers with Docker
  filterProxmox?: boolean; // Only show servers with Proxmox
  allowClear?: boolean;
  className?: string;
}

interface ItemProps extends React.ComponentPropsWithoutRef<'div'> {
  label: string;
  description?: string;
  isOnline: boolean;
  hasDocker: boolean;
  hasProxmox: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(
  ({ label, description, isOnline, hasDocker, hasProxmox, ...others }: ItemProps, ref) => (
    <div ref={ref} {...others}>
      <Group gap="xs" wrap="nowrap">
        {isOnline ? (
          <IconPlug size={16} className="text-green-500" />
        ) : (
          <IconPlugOff size={16} className="text-red-500" />
        )}
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>{label}</Text>
          {description && (
            <Text size="xs" c="dimmed">{description}</Text>
          )}
        </div>
        <Group gap={4}>
          {hasDocker && (
            <Badge size="xs" variant="light" color="blue">Docker</Badge>
          )}
          {hasProxmox && (
            <Badge size="xs" variant="light" color="orange">Proxmox</Badge>
          )}
        </Group>
      </Group>
    </div>
  )
);

SelectItem.displayName = 'SelectItem';

export function ServerSelect({
  value,
  onChange,
  label = 'Serveur',
  description,
  placeholder = 'Sélectionner un serveur',
  required = false,
  disabled = false,
  error,
  filterDocker = false,
  filterProxmox = false,
  allowClear = true,
  className,
}: ServerSelectProps) {
  const { data: servers = [], isLoading } = useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: serversApi.list,
  });

  // Filter servers if needed
  let filteredServers = servers;
  if (filterDocker) {
    filteredServers = filteredServers.filter(s => s.has_docker);
  }
  if (filterProxmox) {
    filteredServers = filteredServers.filter(s => s.has_proxmox);
  }

  // Build options for Select
  const options = filteredServers.map(server => ({
    value: String(server.id),
    label: server.name,
    description: server.description || server.host,
    isOnline: server.is_online,
    hasDocker: server.has_docker,
    hasProxmox: server.has_proxmox,
  }));

  return (
    <Select
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      disabled={disabled || isLoading}
      error={error}
      clearable={allowClear}
      searchable
      className={className}
      leftSection={isLoading ? <Loader size={16} /> : <IconServer size={16} />}
      value={value ? String(value) : null}
      onChange={(val) => onChange(val ? parseInt(val, 10) : null)}
      data={options}
      renderOption={({ option }) => {
        const opt = option as typeof options[0];
        return (
          <Group gap="xs" wrap="nowrap">
            {opt.isOnline ? (
              <IconPlug size={14} className="text-green-500" />
            ) : (
              <IconPlugOff size={14} className="text-red-500" />
            )}
            <div style={{ flex: 1 }}>
              <Text size="sm">{opt.label}</Text>
            </div>
            <Group gap={4}>
              {opt.hasDocker && (
                <Badge size="xs" variant="light" color="blue">Docker</Badge>
              )}
            </Group>
          </Group>
        );
      }}
      nothingFoundMessage={
        isLoading
          ? 'Chargement...'
          : filteredServers.length === 0
          ? 'Aucun serveur configuré'
          : 'Aucun serveur trouvé'
      }
    />
  );
}
