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
  Anchor,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconLock, IconMail, IconUser } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm({
    initialValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Email invalide'),
      username: (value) =>
        value.length < 3 ? 'Le nom doit faire au moins 3 caractères' : null,
      password: (value) =>
        value.length < 8 ? 'Le mot de passe doit faire au moins 8 caractères' : null,
      confirmPassword: (value, values) =>
        value !== values.password ? 'Les mots de passe ne correspondent pas' : null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      await authApi.register(values.email, values.username, values.password);
      notifications.show({
        title: 'Compte créé',
        message: 'Vous pouvez maintenant vous connecter',
        color: 'green',
      });
      router.push('/login');
    } catch (error: any) {
      notifications.show({
        title: 'Erreur',
        message: error.response?.data?.detail || 'Inscription échouée',
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
          Créez votre compte pour accéder au dashboard
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              required
              label="Email"
              placeholder="votre@email.com"
              leftSection={<IconMail size={16} />}
              {...form.getInputProps('email')}
            />

            <TextInput
              required
              label="Nom d'utilisateur"
              placeholder="Votre nom"
              leftSection={<IconUser size={16} />}
              {...form.getInputProps('username')}
            />

            <PasswordInput
              required
              label="Mot de passe"
              placeholder="Au moins 8 caractères"
              leftSection={<IconLock size={16} />}
              {...form.getInputProps('password')}
            />

            <PasswordInput
              required
              label="Confirmer le mot de passe"
              placeholder="Répétez le mot de passe"
              leftSection={<IconLock size={16} />}
              {...form.getInputProps('confirmPassword')}
            />

            <Button type="submit" fullWidth mt="md" loading={loading}>
              Créer le compte
            </Button>
          </Stack>
        </form>

        <Divider my="lg" />

        <Text ta="center" size="sm">
          Déjà un compte ?{' '}
          <Anchor href="/login" fw={500}>
            Se connecter
          </Anchor>
        </Text>
      </Paper>
    </Container>
  );
}
