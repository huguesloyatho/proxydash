'use client';

import { useState } from 'react';
import {
  Stack,
  Group,
  Paper,
  Text,
  Button,
  Alert,
  Image,
  PinInput,
  Code,
  CopyButton,
  ActionIcon,
  Tooltip,
  Stepper,
  Badge,
  List,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import {
  IconShieldCheck,
  IconShieldOff,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconKey,
  IconQrcode,
  IconDeviceMobile,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { TOTPSetup } from '@/types';

export function TwoFactorTab() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TOTPSetup | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const setup = await authApi.setup2FA();
      setTotpSetup(setup);
      setActiveStep(1);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Impossible de configurer le 2FA';
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (verifyCode.length !== 6) return;

    setLoading(true);
    try {
      await authApi.verify2FA(verifyCode);

      // Show recovery codes
      setRecoveryCodes(totpSetup?.recovery_codes || []);
      setShowRecoveryCodes(true);
      setActiveStep(3);

      // Update user state
      const updatedUser = await authApi.getMe();
      updateUser(updatedUser);

      notifications.show({
        title: 'Succès',
        message: '2FA activé avec succès',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Code invalide';
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
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

      // Update user state
      const updatedUser = await authApi.getMe();
      updateUser(updatedUser);

      setDisableCode('');

      notifications.show({
        title: 'Succès',
        message: '2FA désactivé',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Code invalide';
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateCodes = async () => {
    const code = prompt('Entrez votre code 2FA pour régénérer les codes de récupération:');
    if (!code || code.length !== 6) return;

    setLoading(true);
    try {
      const response = await authApi.regenerateRecoveryCodes(code);
      setRecoveryCodes(response.codes);
      setShowRecoveryCodes(true);

      notifications.show({
        title: 'Succès',
        message: 'Nouveaux codes de récupération générés',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Impossible de régénérer les codes';
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelSetup = () => {
    setTotpSetup(null);
    setActiveStep(0);
    setVerifyCode('');
    setShowRecoveryCodes(false);
  };

  // 2FA is enabled
  if (user?.totp_enabled) {
    return (
      <Stack>
        <Alert color="green" icon={<IconShieldCheck size={18} />}>
          <Group justify="space-between">
            <div>
              <Text fw={500}>Authentification à deux facteurs activée</Text>
              <Text size="sm" c="dimmed">
                Votre compte est protégé par une vérification en deux étapes.
              </Text>
            </div>
            <Badge color="green" size="lg">Actif</Badge>
          </Group>
        </Alert>

        <Paper withBorder p="lg">
          <Stack>
            <Group>
              <ThemeIcon color="blue" size="lg" radius="md">
                <IconKey size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500}>Codes de récupération</Text>
                <Text size="sm" c="dimmed">
                  Utilisez ces codes si vous perdez l&apos;accès à votre application d&apos;authentification.
                </Text>
              </div>
            </Group>

            {showRecoveryCodes ? (
              <Paper withBorder p="md" bg="gray.0">
                <Text size="sm" fw={500} mb="sm" c="red">
                  Conservez ces codes en lieu sûr. Ils ne seront plus affichés.
                </Text>
                <Code block>
                  {recoveryCodes.join('\n')}
                </Code>
                <Group mt="sm">
                  <CopyButton value={recoveryCodes.join('\n')}>
                    {({ copied, copy }) => (
                      <Button
                        variant="light"
                        size="xs"
                        onClick={copy}
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      >
                        {copied ? 'Copié' : 'Copier'}
                      </Button>
                    )}
                  </CopyButton>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => setShowRecoveryCodes(false)}
                  >
                    Masquer
                  </Button>
                </Group>
              </Paper>
            ) : (
              <Button
                variant="light"
                onClick={handleRegenerateCodes}
                loading={loading}
              >
                Voir / Régénérer les codes
              </Button>
            )}
          </Stack>
        </Paper>

        <Divider />

        <Paper withBorder p="lg">
          <Stack>
            <Group>
              <ThemeIcon color="red" size="lg" radius="md">
                <IconShieldOff size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500}>Désactiver le 2FA</Text>
                <Text size="sm" c="dimmed">
                  Entrez votre code actuel pour désactiver la vérification en deux étapes.
                </Text>
              </div>
            </Group>

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
        </Paper>
      </Stack>
    );
  }

  // Setup mode
  if (totpSetup) {
    return (
      <Stack>
        <Stepper active={activeStep} onStepClick={setActiveStep} allowNextStepsSelect={false}>
          <Stepper.Step label="Démarrer" description="Configuration">
            <Text>Initialisation...</Text>
          </Stepper.Step>

          <Stepper.Step label="Scanner" description="QR Code">
            <Stack ta="center" py="xl">
              <Text size="lg" fw={500}>
                Scannez ce QR code avec votre application d&apos;authentification
              </Text>
              <Text size="sm" c="dimmed">
                Google Authenticator, Authy, 1Password, etc.
              </Text>

              <Group justify="center" my="xl">
                <Paper withBorder p="md">
                  <Image
                    src={`data:image/png;base64,${totpSetup.qr_code}`}
                    alt="QR Code 2FA"
                    w={200}
                    h={200}
                  />
                </Paper>
              </Group>

              <Text size="sm" c="dimmed">
                Ou entrez manuellement cette clé :
              </Text>
              <Group justify="center">
                <Code>{totpSetup.secret}</Code>
                <CopyButton value={totpSetup.secret}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copié!' : 'Copier'}>
                      <ActionIcon variant="subtle" onClick={copy}>
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>

              <Group justify="center" mt="xl">
                <Button variant="default" onClick={cancelSetup}>
                  Annuler
                </Button>
                <Button onClick={() => setActiveStep(2)}>
                  Continuer
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Vérifier" description="Code">
            <Stack ta="center" py="xl">
              <Text size="lg" fw={500}>
                Entrez le code affiché dans votre application
              </Text>
              <Text size="sm" c="dimmed">
                Le code change toutes les 30 secondes
              </Text>

              <Group justify="center" my="xl">
                <PinInput
                  length={6}
                  type="number"
                  value={verifyCode}
                  onChange={setVerifyCode}
                  size="lg"
                />
              </Group>

              <Group justify="center">
                <Button variant="default" onClick={() => setActiveStep(1)}>
                  Retour
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
          </Stepper.Step>

          <Stepper.Completed>
            <Stack ta="center" py="xl">
              <ThemeIcon color="green" size={60} radius="xl" mx="auto">
                <IconShieldCheck size={36} />
              </ThemeIcon>

              <Text size="lg" fw={500}>
                2FA activé avec succès!
              </Text>

              <Alert color="red" icon={<IconAlertCircle size={18} />}>
                <Text size="sm" fw={500}>
                  Conservez vos codes de récupération en lieu sûr!
                </Text>
                <Text size="sm">
                  Vous en aurez besoin si vous perdez l&apos;accès à votre application.
                </Text>
              </Alert>

              <Paper withBorder p="md">
                <Code block>
                  {recoveryCodes.join('\n')}
                </Code>
              </Paper>

              <Group justify="center">
                <CopyButton value={recoveryCodes.join('\n')}>
                  {({ copied, copy }) => (
                    <Button
                      variant="light"
                      onClick={copy}
                      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    >
                      {copied ? 'Copié!' : 'Copier les codes'}
                    </Button>
                  )}
                </CopyButton>
                <Button onClick={cancelSetup}>
                  Terminé
                </Button>
              </Group>
            </Stack>
          </Stepper.Completed>
        </Stepper>
      </Stack>
    );
  }

  // Initial state - 2FA not enabled
  return (
    <Stack>
      <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
        <Group justify="space-between">
          <div>
            <Text fw={500}>Authentification à deux facteurs non activée</Text>
            <Text size="sm" c="dimmed">
              Ajoutez une couche de sécurité supplémentaire à votre compte.
            </Text>
          </div>
          <Badge color="yellow" size="lg">Inactif</Badge>
        </Group>
      </Alert>

      <Paper withBorder p="lg">
        <Group wrap="nowrap" align="flex-start">
          <ThemeIcon color="blue" size={50} radius="md">
            <IconDeviceMobile size={30} />
          </ThemeIcon>
          <div>
            <Text fw={500} size="lg">Comment ça fonctionne</Text>
            <List size="sm" mt="sm" spacing="xs">
              <List.Item>
                Téléchargez une application d&apos;authentification (Google Authenticator, Authy, etc.)
              </List.Item>
              <List.Item>
                Scannez un QR code avec l&apos;application
              </List.Item>
              <List.Item>
                Entrez le code généré pour confirmer
              </List.Item>
              <List.Item>
                À chaque connexion, vous devrez entrer un code en plus de votre mot de passe
              </List.Item>
            </List>
          </div>
        </Group>
      </Paper>

      <Group justify="center">
        <Button
          size="lg"
          leftSection={<IconShieldCheck size={20} />}
          onClick={handleSetup2FA}
          loading={loading}
        >
          Activer l&apos;authentification à deux facteurs
        </Button>
      </Group>
    </Stack>
  );
}
