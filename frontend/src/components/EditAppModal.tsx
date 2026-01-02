'use client';

import { useEffect } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Switch,
  Button,
  Group,
  Stack,
  Text,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Application, Category } from '@/types';
import { applicationsApi } from '@/lib/api';
import { notifications } from '@mantine/notifications';
import { useUIStore } from '@/lib/store';

interface EditAppModalProps {
  app: Application | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}

export function EditAppModal({ app, categories, onClose, onSave }: EditAppModalProps) {
  const form = useForm({
    initialValues: {
      name: '',
      url: '',
      icon: '',
      description: '',
      category_id: '',
      is_visible: true,
      is_public: false,
      is_authelia_protected: false,
    },
  });

  useEffect(() => {
    if (app) {
      form.setValues({
        name: app.name,
        url: app.url,
        icon: app.icon || '',
        description: app.description || '',
        category_id: app.category_id?.toString() || '',
        is_visible: app.is_visible,
        is_public: app.is_public,
        is_authelia_protected: app.is_authelia_protected,
      });
    }
  }, [app]);

  const handleSubmit = async (values: typeof form.values) => {
    if (!app) return;

    try {
      await applicationsApi.update(app.id, {
        name: values.name,
        url: values.url,
        icon: values.icon || undefined,
        description: values.description || undefined,
        category_id: values.category_id ? parseInt(values.category_id) : undefined,
        is_visible: values.is_visible,
        is_public: values.is_public,
        is_authelia_protected: values.is_authelia_protected,
      });

      notifications.show({
        title: 'Succès',
        message: 'Application mise à jour',
        color: 'green',
      });

      onSave();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de mettre à jour l\'application',
        color: 'red',
      });
    }
  };

  const handleReset = async () => {
    if (!app || app.is_manual) return;

    try {
      await applicationsApi.reset(app.id);
      notifications.show({
        title: 'Succès',
        message: 'Application réinitialisée',
        color: 'green',
      });
      onSave();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de réinitialiser l\'application',
        color: 'red',
      });
    }
  };

  const handleDelete = async () => {
    if (!app) return;

    try {
      await applicationsApi.delete(app.id);
      notifications.show({
        title: 'Succès',
        message: 'Application supprimée',
        color: 'green',
      });
      onSave();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de supprimer l\'application',
        color: 'red',
      });
    }
  };

  return (
    <Modal
      opened={!!app}
      onClose={onClose}
      title="Modifier l'application"
      size="lg"
    >
      {app && (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Group gap="xs">
              {app.is_manual ? (
                <Badge color="grape">Application manuelle</Badge>
              ) : (
                <Badge color="blue">Synchronisé depuis NPM</Badge>
              )}
              {app.detected_type && (
                <Badge color="cyan">Type: {app.detected_type}</Badge>
              )}
            </Group>

            <TextInput
              label="Nom"
              placeholder="Nom de l'application"
              {...form.getInputProps('name')}
              rightSection={
                app.name_override && (
                  <Badge size="xs" color="orange">
                    Modifié
                  </Badge>
                )
              }
            />

            <TextInput
              label="URL"
              placeholder="https://..."
              {...form.getInputProps('url')}
            />

            <TextInput
              label="Icône"
              placeholder="URL de l'icône ou nom Dashboard Icons"
              description="Laissez vide pour utiliser l'icône détectée automatiquement"
              {...form.getInputProps('icon')}
              rightSection={
                app.icon_override && (
                  <Badge size="xs" color="orange">
                    Modifié
                  </Badge>
                )
              }
            />

            <Textarea
              label="Description"
              placeholder="Description affichée au survol"
              rows={2}
              {...form.getInputProps('description')}
              rightSection={
                app.description_override && (
                  <Badge size="xs" color="orange">
                    Modifié
                  </Badge>
                )
              }
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

            <Switch
              label="Visible sur le dashboard public (sans authentification)"
              description="Permet l'accès sans connexion"
              {...form.getInputProps('is_public', { type: 'checkbox' })}
            />

            <Switch
              label="Protégée par Authelia"
              description="Affiche un badge Authelia sur l'icône"
              {...form.getInputProps('is_authelia_protected', { type: 'checkbox' })}
            />

            <Group justify="space-between" mt="md">
              <Group>
                {!app.is_manual && (
                  <Button variant="subtle" color="orange" onClick={handleReset}>
                    Réinitialiser
                  </Button>
                )}
                <Button variant="subtle" color="red" onClick={handleDelete}>
                  Supprimer
                </Button>
              </Group>

              <Group>
                <Button variant="default" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit">Enregistrer</Button>
              </Group>
            </Group>

            {!app.is_manual && (
              <Text size="xs" c="dimmed">
                Les champs modifiés ne seront plus mis à jour automatiquement lors des synchronisations.
                Utilisez &quot;Réinitialiser&quot; pour restaurer la synchronisation automatique.
              </Text>
            )}
          </Stack>
        </form>
      )}
    </Modal>
  );
}
