'use client';

import { useEffect, useState } from 'react';
import {
  Stack,
  Group,
  Button,
  TextInput,
  PasswordInput,
  NumberInput,
  Switch,
  Paper,
  Title,
  Text,
  LoadingOverlay,
  Alert,
  Divider,
} from '@mantine/core';
import {
  IconMail,
  IconBrandTelegram,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { notificationsApi } from '@/lib/api/notifications';
import type { SMTPConfig, TelegramConfig } from '@/types';

export function AdminConfigTab() {
  const [loading, setLoading] = useState(true);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);

  const smtpForm = useForm({
    initialValues: {
      host: '',
      port: 587,
      username: '',
      password: '',
      from_address: '',
      use_tls: true,
      start_tls: true,
    },
  });

  const telegramForm = useForm({
    initialValues: {
      token: '',
    },
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const [smtp, telegram] = await Promise.all([
        notificationsApi.getSMTPConfig(),
        notificationsApi.getTelegramConfig(),
      ]);

      if (smtp) {
        setSmtpConfigured(true);
        smtpForm.setValues({
          host: smtp.host,
          port: smtp.port,
          username: smtp.username,
          password: '', // Don't show password
          from_address: smtp.from_address || '',
          use_tls: smtp.use_tls,
          start_tls: smtp.start_tls,
        });
      }

      if (telegram) {
        setTelegramConfigured(true);
        telegramForm.setValues({
          token: '', // Don't show token
        });
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSMTP = async (values: typeof smtpForm.values) => {
    try {
      await notificationsApi.setSMTPConfig(values as SMTPConfig);
      notifications.show({
        title: 'Succès',
        message: 'Configuration SMTP enregistrée',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      setSmtpConfigured(true);
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible d\'enregistrer',
        color: 'red',
      });
    }
  };

  const handleSaveTelegram = async (values: typeof telegramForm.values) => {
    try {
      await notificationsApi.setTelegramConfig(values as TelegramConfig);
      notifications.show({
        title: 'Succès',
        message: 'Configuration Telegram enregistrée',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      setTelegramConfigured(true);
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Impossible d\'enregistrer',
        color: 'red',
      });
    }
  };

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={loading} />

      <Alert color="blue" icon={<IconAlertCircle size={18} />}>
        Ces configurations sont globales et s&apos;appliquent à tous les utilisateurs.
        Les canaux individuels peuvent surcharger certains paramètres.
      </Alert>

      {/* SMTP Configuration */}
      <Paper withBorder p="lg">
        <Group mb="md">
          <IconMail size={24} />
          <div>
            <Title order={4}>Configuration SMTP</Title>
            <Text size="sm" c="dimmed">
              Serveur SMTP pour l&apos;envoi des emails
            </Text>
          </div>
          {smtpConfigured && (
            <Text size="sm" c="green" ml="auto">
              ✓ Configuré
            </Text>
          )}
        </Group>

        <form onSubmit={smtpForm.onSubmit(handleSaveSMTP)}>
          <Stack>
            <Group grow>
              <TextInput
                label="Serveur SMTP"
                placeholder="smtp.gmail.com"
                required
                {...smtpForm.getInputProps('host')}
              />
              <NumberInput
                label="Port"
                placeholder="587"
                min={1}
                max={65535}
                required
                {...smtpForm.getInputProps('port')}
              />
            </Group>

            <Group grow>
              <TextInput
                label="Nom d'utilisateur"
                placeholder="user@gmail.com"
                required
                {...smtpForm.getInputProps('username')}
              />
              <PasswordInput
                label="Mot de passe"
                placeholder={smtpConfigured ? '••••••••' : ''}
                description={smtpConfigured ? 'Laissez vide pour conserver l\'actuel' : ''}
                required={!smtpConfigured}
                {...smtpForm.getInputProps('password')}
              />
            </Group>

            <TextInput
              label="Adresse d'expédition (optionnel)"
              placeholder="noreply@example.com"
              description="Si différent du nom d'utilisateur"
              {...smtpForm.getInputProps('from_address')}
            />

            <Group>
              <Switch
                label="Utiliser TLS"
                {...smtpForm.getInputProps('use_tls', { type: 'checkbox' })}
              />
              <Switch
                label="STARTTLS"
                {...smtpForm.getInputProps('start_tls', { type: 'checkbox' })}
              />
            </Group>

            <Group justify="flex-end">
              <Button type="submit">
                Enregistrer la configuration SMTP
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Divider />

      {/* Telegram Configuration */}
      <Paper withBorder p="lg">
        <Group mb="md">
          <IconBrandTelegram size={24} />
          <div>
            <Title order={4}>Configuration Telegram</Title>
            <Text size="sm" c="dimmed">
              Bot Telegram pour les notifications
            </Text>
          </div>
          {telegramConfigured && (
            <Text size="sm" c="green" ml="auto">
              ✓ Configuré
            </Text>
          )}
        </Group>

        <form onSubmit={telegramForm.onSubmit(handleSaveTelegram)}>
          <Stack>
            <PasswordInput
              label="Token du bot"
              placeholder={telegramConfigured ? '••••••••' : '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'}
              description={
                <>
                  Créez un bot via{' '}
                  <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                    @BotFather
                  </a>
                  {telegramConfigured ? ' - Laissez vide pour conserver l\'actuel' : ''}
                </>
              }
              required={!telegramConfigured}
              {...telegramForm.getInputProps('token')}
            />

            <Alert color="gray" variant="light">
              <Text size="sm">
                <strong>Instructions:</strong>
                <ol style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>
                  <li>Envoyez /newbot à @BotFather sur Telegram</li>
                  <li>Suivez les instructions pour créer votre bot</li>
                  <li>Copiez le token fourni et collez-le ci-dessus</li>
                  <li>Pour recevoir des notifications, envoyez /start à votre bot</li>
                  <li>Obtenez votre Chat ID via @userinfobot</li>
                </ol>
              </Text>
            </Alert>

            <Group justify="flex-end">
              <Button type="submit">
                Enregistrer la configuration Telegram
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
