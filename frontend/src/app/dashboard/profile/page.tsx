'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Title,
  Text,
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Divider,
  Badge,
  Alert,
  Modal,
  Code,
  CopyButton,
  ActionIcon,
  Tooltip,
  Loader,
  Center,
  Image,
  PinInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconArrowLeft,
  IconShield,
  IconShieldOff,
  IconKey,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { TOTPSetup } from '@/types';

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();

  const [setup2FAOpen, setSetup2FAOpen] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TOTPSetup | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disable2FAOpen, setDisable2FAOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);

  // Profile form
  const profileForm = useForm({
    initialValues: {
      email: '',
      username: '',
    },
  });

  // Password form
  const passwordForm = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      newPassword: (value) => (value.length < 6 ? 'Minimum 6 caracteres' : null),
      confirmPassword: (value, values) =>
        value !== values.newPassword ? 'Les mots de passe ne correspondent pas' : null,
    },
  });

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    authApi.getMe().then((userData) => {
      setAuth(token, userData);
      profileForm.setValues({
        email: userData.email,
        username: userData.username,
      });
    }).catch(() => {
      logout();
      router.push('/login');
    });
  }, []);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: { email?: string; username?: string }) => authApi.updateProfile(data),
    onSuccess: (userData) => {
      const token = localStorage.getItem('token');
      if (token) {
        setAuth(token, userData);
      }
      notifications.show({
        title: 'Succes',
        message: 'Profil mis a jour',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Erreur lors de la mise a jour',
        color: 'red',
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      notifications.show({
        title: 'Succes',
        message: 'Mot de passe modifie',
        color: 'green',
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Erreur lors du changement de mot de passe',
        color: 'red',
      });
    },
  });

  // Setup 2FA mutation
  const setup2FAMutation = useMutation({
    mutationFn: () => authApi.setup2FA(),
    onSuccess: (data) => {
      setTotpSetup(data);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Erreur lors de la configuration du 2FA',
        color: 'red',
      });
    },
  });

  // Verify 2FA mutation
  const verify2FAMutation = useMutation({
    mutationFn: (code: string) => authApi.verify2FA(code),
    onSuccess: () => {
      notifications.show({
        title: 'Succes',
        message: '2FA active avec succes',
        color: 'green',
      });
      setSetup2FAOpen(false);
      setTotpSetup(null);
      setVerifyCode('');
      // Refresh user data
      authApi.getMe().then((userData) => {
        const token = localStorage.getItem('token');
        if (token) setAuth(token, userData);
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Code invalide',
        color: 'red',
      });
    },
  });

  // Disable 2FA mutation
  const disable2FAMutation = useMutation({
    mutationFn: (code: string) => authApi.disable2FA(code),
    onSuccess: () => {
      notifications.show({
        title: 'Succes',
        message: '2FA desactive',
        color: 'green',
      });
      setDisable2FAOpen(false);
      setDisableCode('');
      // Refresh user data
      authApi.getMe().then((userData) => {
        const token = localStorage.getItem('token');
        if (token) setAuth(token, userData);
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Code invalide',
        color: 'red',
      });
    },
  });

  // Regenerate recovery codes mutation
  const regenerateMutation = useMutation({
    mutationFn: (code: string) => authApi.regenerateRecoveryCodes(code),
    onSuccess: (data) => {
      setNewRecoveryCodes(data.recovery_codes);
      setRegenerateCode('');
      notifications.show({
        title: 'Succes',
        message: 'Nouveaux codes de recuperation generes',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Code invalide',
        color: 'red',
      });
    },
  });

  const handleProfileSubmit = (values: typeof profileForm.values) => {
    const changes: { email?: string; username?: string } = {};
    if (values.email !== user?.email) changes.email = values.email;
    if (values.username !== user?.username) changes.username = values.username;
    if (Object.keys(changes).length > 0) {
      updateProfileMutation.mutate(changes);
    }
  };

  const handlePasswordSubmit = (values: typeof passwordForm.values) => {
    changePasswordMutation.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
  };

  const handleStart2FA = () => {
    setSetup2FAOpen(true);
    setup2FAMutation.mutate();
  };

  if (!isAuthenticated || !user) {
    return (
      <Center className="min-h-screen">
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Box p="xl" maw={800} mx="auto">
      <Group mb="xl">
        <ActionIcon
          component={Link}
          href="/dashboard"
          variant="subtle"
          size="lg"
        >
          <IconArrowLeft size={20} />
        </ActionIcon>
        <div>
          <Title order={1}>Mon profil</Title>
          <Text c="dimmed" size="sm">
            Gerez vos informations personnelles et la securite
          </Text>
        </div>
      </Group>

      <Stack gap="lg">
        {/* Profile Information */}
        <Paper withBorder p="lg">
          <Title order={3} mb="md">Informations personnelles</Title>
          <form onSubmit={profileForm.onSubmit(handleProfileSubmit)}>
            <Stack>
              <TextInput
                label="Nom d'utilisateur"
                {...profileForm.getInputProps('username')}
              />
              <TextInput
                label="Email"
                type="email"
                {...profileForm.getInputProps('email')}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  loading={updateProfileMutation.isPending}
                >
                  Enregistrer
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        {/* Change Password */}
        <Paper withBorder p="lg">
          <Title order={3} mb="md">Changer le mot de passe</Title>
          <form onSubmit={passwordForm.onSubmit(handlePasswordSubmit)}>
            <Stack>
              <PasswordInput
                label="Mot de passe actuel"
                {...passwordForm.getInputProps('currentPassword')}
              />
              <PasswordInput
                label="Nouveau mot de passe"
                {...passwordForm.getInputProps('newPassword')}
              />
              <PasswordInput
                label="Confirmer le nouveau mot de passe"
                {...passwordForm.getInputProps('confirmPassword')}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  loading={changePasswordMutation.isPending}
                >
                  Changer le mot de passe
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        {/* 2FA Section */}
        <Paper withBorder p="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Title order={3}>Authentification a deux facteurs (2FA)</Title>
              <Text c="dimmed" size="sm">
                Securisez votre compte avec un code TOTP
              </Text>
            </div>
            <Badge
              size="lg"
              color={user.totp_enabled ? 'green' : 'gray'}
              leftSection={user.totp_enabled ? <IconShield size={14} /> : <IconShieldOff size={14} />}
            >
              {user.totp_enabled ? 'Active' : 'Desactive'}
            </Badge>
          </Group>

          {user.totp_enabled ? (
            <Stack>
              <Alert color="green" icon={<IconShield size={16} />}>
                Votre compte est protege par l'authentification a deux facteurs.
              </Alert>
              <Group>
                <Button
                  variant="light"
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => setRegenerateOpen(true)}
                >
                  Regenerer les codes de recuperation
                </Button>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconShieldOff size={18} />}
                  onClick={() => setDisable2FAOpen(true)}
                >
                  Desactiver le 2FA
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack>
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                Nous recommandons d'activer l'authentification a deux facteurs pour securiser votre compte.
              </Alert>
              <Button
                leftSection={<IconShield size={18} />}
                onClick={handleStart2FA}
              >
                Activer le 2FA
              </Button>
            </Stack>
          )}
        </Paper>
      </Stack>

      {/* Setup 2FA Modal */}
      <Modal
        opened={setup2FAOpen}
        onClose={() => {
          setSetup2FAOpen(false);
          setTotpSetup(null);
          setVerifyCode('');
        }}
        title="Configurer l'authentification a deux facteurs"
        size="lg"
      >
        {setup2FAMutation.isPending ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : totpSetup ? (
          <Stack>
            <Alert color="blue" icon={<IconAlertCircle size={16} />}>
              Scannez le QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
            </Alert>

            <Center>
              <Image
                src={`data:image/png;base64,${totpSetup.qr_code}`}
                alt="QR Code"
                w={200}
                h={200}
              />
            </Center>

            <Text size="sm" c="dimmed" ta="center">
              Ou entrez manuellement: <Code>{totpSetup.secret}</Code>
            </Text>

            <Divider label="Codes de recuperation" labelPosition="center" />

            <Alert color="orange" icon={<IconKey size={16} />}>
              Conservez ces codes en lieu sur. Ils vous permettront de vous connecter si vous perdez acces a votre application d'authentification. Chaque code ne peut etre utilise qu'une seule fois.
            </Alert>

            <Paper withBorder p="md" bg="gray.0">
              <Group justify="center" gap="xs" wrap="wrap">
                {totpSetup.recovery_codes.map((code, i) => (
                  <Code key={i} style={{ fontFamily: 'monospace' }}>{code}</Code>
                ))}
              </Group>
              <Center mt="md">
                <CopyButton value={totpSetup.recovery_codes.join('\n')}>
                  {({ copied, copy }) => (
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={copy}
                    >
                      {copied ? 'Copie!' : 'Copier les codes'}
                    </Button>
                  )}
                </CopyButton>
              </Center>
            </Paper>

            <Divider label="Verification" labelPosition="center" />

            <Text size="sm" ta="center">
              Entrez le code affiche dans votre application pour confirmer:
            </Text>

            <Center>
              <PinInput
                length={6}
                type="number"
                value={verifyCode}
                onChange={setVerifyCode}
              />
            </Center>

            <Group justify="center">
              <Button variant="default" onClick={() => setSetup2FAOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => verify2FAMutation.mutate(verifyCode)}
                loading={verify2FAMutation.isPending}
                disabled={verifyCode.length !== 6}
              >
                Activer le 2FA
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      {/* Disable 2FA Modal */}
      <Modal
        opened={disable2FAOpen}
        onClose={() => {
          setDisable2FAOpen(false);
          setDisableCode('');
        }}
        title="Desactiver l'authentification a deux facteurs"
      >
        <Stack>
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Desactiver le 2FA rendra votre compte moins securise.
          </Alert>

          <Text size="sm">
            Entrez votre code TOTP actuel pour confirmer:
          </Text>

          <Center>
            <PinInput
              length={6}
              type="number"
              value={disableCode}
              onChange={setDisableCode}
            />
          </Center>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDisable2FAOpen(false)}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={() => disable2FAMutation.mutate(disableCode)}
              loading={disable2FAMutation.isPending}
              disabled={disableCode.length !== 6}
            >
              Desactiver
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Regenerate Recovery Codes Modal */}
      <Modal
        opened={regenerateOpen}
        onClose={() => {
          setRegenerateOpen(false);
          setRegenerateCode('');
          setNewRecoveryCodes([]);
        }}
        title="Regenerer les codes de recuperation"
        size="lg"
      >
        <Stack>
          {newRecoveryCodes.length > 0 ? (
            <>
              <Alert color="green" icon={<IconCheck size={16} />}>
                Nouveaux codes de recuperation generes avec succes. Les anciens codes ne sont plus valides.
              </Alert>

              <Paper withBorder p="md" bg="gray.0">
                <Group justify="center" gap="xs" wrap="wrap">
                  {newRecoveryCodes.map((code, i) => (
                    <Code key={i} style={{ fontFamily: 'monospace' }}>{code}</Code>
                  ))}
                </Group>
                <Center mt="md">
                  <CopyButton value={newRecoveryCodes.join('\n')}>
                    {({ copied, copy }) => (
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        onClick={copy}
                      >
                        {copied ? 'Copie!' : 'Copier les codes'}
                      </Button>
                    )}
                  </CopyButton>
                </Center>
              </Paper>

              <Button onClick={() => setRegenerateOpen(false)}>
                Fermer
              </Button>
            </>
          ) : (
            <>
              <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                Cette action invalidera tous vos codes de recuperation actuels.
              </Alert>

              <Text size="sm">
                Entrez votre code TOTP actuel pour confirmer:
              </Text>

              <Center>
                <PinInput
                  length={6}
                  type="number"
                  value={regenerateCode}
                  onChange={setRegenerateCode}
                />
              </Center>

              <Group justify="flex-end">
                <Button variant="default" onClick={() => setRegenerateOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => regenerateMutation.mutate(regenerateCode)}
                  loading={regenerateMutation.isPending}
                  disabled={regenerateCode.length !== 6}
                >
                  Regenerer
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}
