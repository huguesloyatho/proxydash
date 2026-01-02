'use client';

import { useEffect } from 'react';
import {
  Modal,
  TextInput,
  Switch,
  Button,
  Group,
  Stack,
  NumberInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Category } from '@/types';
import { categoriesApi } from '@/lib/api';
import { notifications } from '@mantine/notifications';

interface EditCategoryModalProps {
  category: Category | null;
  onClose: () => void;
  onSave: () => void;
}

export function EditCategoryModal({ category, onClose, onSave }: EditCategoryModalProps) {
  const form = useForm({
    initialValues: {
      name: '',
      icon: '',
      order: 0,
      is_public: false,
    },
  });

  useEffect(() => {
    if (category) {
      form.setValues({
        name: category.name,
        icon: category.icon,
        order: category.order,
        is_public: category.is_public,
      });
    }
  }, [category]);

  const handleSubmit = async (values: typeof form.values) => {
    if (!category) return;

    try {
      await categoriesApi.update(category.id, {
        name: values.name,
        icon: values.icon,
        order: values.order,
        is_public: values.is_public,
      });

      notifications.show({
        title: 'Succès',
        message: 'Catégorie mise à jour',
        color: 'green',
      });

      onSave();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de mettre à jour la catégorie',
        color: 'red',
      });
    }
  };

  return (
    <Modal
      opened={!!category}
      onClose={onClose}
      title="Modifier la catégorie"
      size="md"
    >
      {category && (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Nom"
              placeholder="Nom de la catégorie"
              {...form.getInputProps('name')}
            />

            <TextInput
              label="Icône"
              placeholder="mdi:icon-name"
              description="Format MDI (ex: mdi:home, mdi:cog)"
              {...form.getInputProps('icon')}
            />

            <NumberInput
              label="Ordre d'affichage"
              min={0}
              {...form.getInputProps('order')}
            />

            <Switch
              label="Catégorie publique"
              description="Visible sur le dashboard public (sans authentification)"
              {...form.getInputProps('is_public', { type: 'checkbox' })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
