'use client';

import { useState } from 'react';
import {
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import {
  IconHistory,
  IconDevices,
  IconDownload,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useAuthStore } from '@/lib/store';
import { AuditLogsTab } from './security/AuditLogsTab';
import { SessionsTab } from './security/SessionsTab';
import { BackupTab } from './security/BackupTab';
import { TwoFactorTab } from './security/TwoFactorTab';

export function SecuritySettings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string | null>('2fa');

  return (
    <Stack>
      <div>
        <Text size="lg" fw={600}>Sécurité</Text>
        <Text size="sm" c="dimmed">
          Gérez la sécurité de votre compte et consultez l&apos;historique des actions
        </Text>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="2fa" leftSection={<IconShieldCheck size={16} />}>
            Authentification 2FA
          </Tabs.Tab>
          <Tabs.Tab value="sessions" leftSection={<IconDevices size={16} />}>
            Sessions actives
          </Tabs.Tab>
          {user?.is_admin && (
            <Tabs.Tab value="audit" leftSection={<IconHistory size={16} />}>
              Logs d&apos;audit
            </Tabs.Tab>
          )}
          {user?.is_admin && (
            <Tabs.Tab value="backup" leftSection={<IconDownload size={16} />}>
              Backup / Export
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="2fa" pt="md">
          <TwoFactorTab />
        </Tabs.Panel>

        <Tabs.Panel value="sessions" pt="md">
          <SessionsTab />
        </Tabs.Panel>

        {user?.is_admin && (
          <Tabs.Panel value="audit" pt="md">
            <AuditLogsTab />
          </Tabs.Panel>
        )}

        {user?.is_admin && (
          <Tabs.Panel value="backup" pt="md">
            <BackupTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}
