'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Switch,
  Button,
  Group,
  Divider,
  Image,
  PinInput,
  Alert,
  Anchor,
} from '@mantine/core';
import { IconArrowLeft, IconShieldCheck, IconAlertCircle, IconBell, IconChevronRight } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { TOTPSetup } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const { user, updateUser, isAuthenticated } = useAuthStore();
  const [totpSetup, setTotpSetup] = useState<TOTPSetup | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated]);

  const handleSetup2FA = async () => {
    try {
      const setup = await authApi.setup2FA();
      setTotpSetup(setup);
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible de configurer le 2FA',
        color: 'red',
      });
    }
  };

  const handleVerify2FA = async () => {
    if (verifyCode.length !== 6) return;

    setLoading(true);
    try {
      await authApi.verify2FA(verifyCode);
      notifications.show({
        title: 'Succès',
        message: '2FA activé avec succès',
        color: 'green',
      });

      // Update user state
      const updatedUser = await authApi.getMe();
      updateUser(updatedUser);

      setTotpSetup(null);
      setVerifyCode('');
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Code invalide',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (disableCode.length !== 6) return;

    setLoading(true);
    try {
      await authApi.disable2FA(disableCode);
      notifications.show({
        title: 'Succès',
        message: '2FA désactivé',
        color: 'green',
      });

      // Update user state
      const updatedUser = await authApi.getMe();
      updateUser(updatedUser);

      setDisableCode('');
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Code invalide',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Container size="sm" py="xl">
      <Group mb="xl">
        <Anchor href="/" c="dimmed">
          <Group gap="xs">
            <IconArrowLeft size={18} />
            Retour au dashboard
          </Group>
        </Anchor>
      </Group>

      <Title order={1} mb="xl">Paramètres</Title>

      {/* Profile Section */}
      <Paper withBorder p="lg" mb="lg">
        <Title order={3} mb="md">Profil</Title>
        <Stack gap="xs">
          <Text><strong>Email:</strong> {user.email}</Text>
          <Text><strong>Nom d&apos;utilisateur:</strong> {user.username}</Text>
          <Text><strong>Rôle:</strong> {user.is_admin ? 'Administrateur' : 'Utilisateur'}</Text>
        </Stack>
      </Paper>

      {/* Notifications Section */}
      <Paper withBorder p="lg" mb="lg">
        <Anchor href="/settings/notifications" underline="never" c="inherit">
          <Group justify="space-between">
            <Group>
              <IconBell size={24} />
              <div>
                <Title order={3}>Notifications & Alertes</Title>
                <Text size="sm" c="dimmed">
                  Configurez vos canaux de notification et règles d&apos;alertes
                </Text>
              </div>
            </Group>
            <IconChevronRight size={20} />
          </Group>
        </Anchor>
      </Paper>

      {/* 2FA Section */}
      <Paper withBorder p="lg">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Authentification à deux facteurs</Title>
            <Text size="sm" c="dimmed">
              Sécurisez votre compte avec un code TOTP
            </Text>
          </div>
          <IconShieldCheck
            size={32}
            className={user.totp_enabled ? 'text-green-500' : 'text-gray-400'}
          />
        </Group>

        <Divider my="md" />

        {user.totp_enabled ? (
          <Stack>
            <Alert color="green" icon={<IconShieldCheck size={18} />}>
              L&apos;authentification à deux facteurs est activée
            </Alert>

            <Text size="sm" c="dimmed">
              Pour désactiver le 2FA, entrez votre code actuel:
            </Text>

            <Group>
              <PinInput
                length={6}
                type="number"
                value={disableCode}
                onChange={setDisableCode}
              />
              <Button
                color="red"
                onClick={handleDisable2FA}
                loading={loading}
                disabled={disableCode.length !== 6}
              >
                Désactiver
              </Button>
            </Group>
          </Stack>
        ) : totpSetup ? (
          <Stack>
            <Alert color="blue" icon={<IconAlertCircle size={18} />}>
              Scannez le QR code avec votre application d&apos;authentification
              (Google Authenticator, Authy, etc.)
            </Alert>

            <div className="flex justify-center">
              <Image
                src={`data:image/png;base64,${totpSetup.qr_code}`}
                alt="QR Code 2FA"
                w={200}
                h={200}
              />
            </div>

            <Text size="sm" ta="center" c="dimmed">
              Ou entrez manuellement: <code>{totpSetup.secret}</code>
            </Text>

            <Divider label="Vérification" labelPosition="center" />

            <Text size="sm" c="dimmed" ta="center">
              Entrez le code affiché dans votre application pour confirmer:
            </Text>

            <div className="flex justify-center">
              <PinInput
                length={6}
                type="number"
                value={verifyCode}
                onChange={setVerifyCode}
                size="lg"
              />
            </div>

            <Group justify="center">
              <Button
                variant="default"
                onClick={() => {
                  setTotpSetup(null);
                  setVerifyCode('');
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleVerify2FA}
                loading={loading}
                disabled={verifyCode.length !== 6}
              >
                Activer le 2FA
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack>
            <Text size="sm" c="dimmed">
              Ajoutez une couche de sécurité supplémentaire en activant
              l&apos;authentification à deux facteurs.
            </Text>
            <Button onClick={handleSetup2FA}>
              Configurer le 2FA
            </Button>
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
