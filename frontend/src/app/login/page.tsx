'use client';

import { useState } from 'react';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Container,
  Stack,
  PinInput,
  Divider,
  Anchor,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconLock, IconMail } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Email invalide'),
      password: (value) => (value.length < 1 ? 'Mot de passe requis' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const response = await authApi.login(
        values.email,
        values.password,
        requires2FA ? totpCode : undefined
      );

      if (response.requires_2fa && !response.access_token) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      setAuth(response.access_token, response.user);
      notifications.show({
        title: 'Bienvenue !',
        message: `Connecté en tant que ${response.user.username}`,
        color: 'green',
      });
      router.push('/dashboard');
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Connexion échouée',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} className="min-h-screen flex items-center">
      <Paper radius="md" p="xl" withBorder className="w-full">
        <Title order={2} ta="center" mb="md">
          ProxyDash
        </Title>

        <Text c="dimmed" size="sm" ta="center" mb="lg">
          Connectez-vous pour accéder au dashboard
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              required
              label="Email"
              placeholder="votre@email.com"
              leftSection={<IconMail size={16} />}
              {...form.getInputProps('email')}
              disabled={requires2FA}
            />

            <PasswordInput
              required
              label="Mot de passe"
              placeholder="Votre mot de passe"
              leftSection={<IconLock size={16} />}
              {...form.getInputProps('password')}
              disabled={requires2FA}
            />

            {requires2FA && (
              <>
                <Divider label="Authentification à deux facteurs" labelPosition="center" />
                <Text size="sm" c="dimmed" ta="center">
                  Entrez le code de votre application d&apos;authentification
                </Text>
                <div className="flex justify-center">
                  <PinInput
                    length={6}
                    type="number"
                    value={totpCode}
                    onChange={setTotpCode}
                    size="lg"
                  />
                </div>
              </>
            )}

            <Button type="submit" fullWidth mt="md" loading={loading}>
              {requires2FA ? 'Vérifier' : 'Se connecter'}
            </Button>
          </Stack>
        </form>

        <Divider my="lg" />

        <Text ta="center" size="sm">
          Pas encore de compte ?{' '}
          <Anchor href="/register" fw={500}>
            Créer un compte
          </Anchor>
        </Text>
      </Paper>
    </Container>
  );
}
