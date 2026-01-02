'use client';

import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Switch,
  Button,
  Group,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Category } from '@/types';
import { applicationsApi } from '@/lib/api';
import { notifications } from '@mantine/notifications';

interface AddAppModalProps {
  opened: boolean;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}

export function AddAppModal({ opened, categories, onClose, onSave }: AddAppModalProps) {
  const form = useForm({
    initialValues: {
      name: '',
      url: '',
      icon: '',
      description: '',
      category_id: '',
      is_visible: true,
    },
    validate: {
      name: (value) => (value.length < 1 ? 'Le nom est requis' : null),
      url: (value) => {
        if (!value) return 'L\'URL est requise';
        try {
          new URL(value);
          return null;
        } catch {
          return 'URL invalide';
        }
      },
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await applicationsApi.create({
        name: values.name,
        url: values.url,
        icon: values.icon || undefined,
        description: values.description || undefined,
        category_id: values.category_id ? parseInt(values.category_id) : undefined,
        is_visible: values.is_visible,
      });

      notifications.show({
        title: 'Succès',
        message: 'Application créée',
        color: 'green',
      });

      form.reset();
      onSave();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de créer l\'application',
        color: 'red',
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Ajouter une application manuelle"
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="Nom"
            placeholder="Nom de l'application"
            required
            {...form.getInputProps('name')}
          />

          <TextInput
            label="URL"
            placeholder="https://..."
            required
            {...form.getInputProps('url')}
          />

          <TextInput
            label="Icône"
            placeholder="URL de l'icône"
            description="Vous pouvez utiliser une URL complète ou un nom de Dashboard Icons (ex: nextcloud)"
            {...form.getInputProps('icon')}
          />

          <Textarea
            label="Description"
            placeholder="Description affichée au survol"
            rows={2}
            {...form.getInputProps('description')}
          />

          <Select
            label="Catégorie"
            placeholder="Sélectionner une catégorie"
            data={categories.map((cat) => ({
              value: cat.id.toString(),
              label: cat.name,
            }))}
            {...form.getInputProps('category_id')}
          />

          <Switch
            label="Visible sur le dashboard"
            {...form.getInputProps('is_visible', { type: 'checkbox' })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">Créer</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
