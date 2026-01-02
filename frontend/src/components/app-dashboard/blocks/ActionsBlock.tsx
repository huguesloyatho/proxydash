'use client';

import { useState } from 'react';
import {
  Paper,
  Text,
  Stack,
  Button,
  Modal,
  TextInput,
  Select,
  PasswordInput,
  NumberInput,
  Group,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBan,
  IconRefresh,
  IconArrowUp,
  IconLockOpen,
  IconPlus,
  IconTrash,
  IconCheck,
  IconUserPlus,
  IconKey,
  IconApi,
} from '@tabler/icons-react';
import { DashboardBlock, ActionButton, ActionInput } from '@/types';
import { appDashboardApi } from '@/lib/api';

interface ActionsBlockProps {
  block: DashboardBlock;
  serverId: number;
  variables: Record<string, string>;
  onRefreshAll?: () => void;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  IconBan,
  IconRefresh,
  IconArrowUp,
  IconLockOpen,
  IconPlus,
  IconTrash,
  IconCheck,
  IconUserPlus,
  IconKey,
  IconApi,
};

export function ActionsBlock({ block, serverId, variables, onRefreshAll }: ActionsBlockProps) {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [currentAction, setCurrentAction] = useState<ActionButton | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const config = block.config;
  const buttons = config.buttons || [];

  const form = useForm<Record<string, string>>({
    initialValues: {},
  });

  const handleActionClick = (action: ActionButton) => {
    if (action.inputs && action.inputs.length > 0) {
      // Set default values
      const initialValues: Record<string, string> = {};
      action.inputs.forEach((input) => {
        initialValues[input.id] = input.default || '';
      });
      form.setValues(initialValues);
      setCurrentAction(action);
      openModal();
    } else if (action.confirm) {
      setCurrentAction(action);
      openModal();
    } else {
      executeAction(action, {});
    }
  };

  const executeAction = async (action: ActionButton, inputs: Record<string, string>) => {
    setLoading(action.id);

    try {
      const result = await appDashboardApi.executeAction(serverId, action, variables, inputs);

      if (result.success) {
        notifications.show({
          title: 'Action exécutée',
          message: action.label + ' effectué avec succès',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        onRefreshAll?.();
      } else {
        notifications.show({
          title: 'Erreur',
          message: result.error || "Échec de l'action",
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Erreur de connexion',
        color: 'red',
      });
    } finally {
      setLoading(null);
      closeModal();
      setCurrentAction(null);
    }
  };

  const handleSubmit = () => {
    if (currentAction) {
      executeAction(currentAction, form.values);
    }
  };

  const renderActionIcon = (action: ActionButton) => {
    const IconComp = action.icon ? ACTION_ICONS[action.icon] : null;
    if (IconComp) return <IconComp size={18} />;
    return null;
  };

  const renderInput = (input: ActionInput) => {
    switch (input.type) {
      case 'select':
        return (
          <Select
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            data={input.options || []}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
      case 'password':
        return (
          <PasswordInput
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
      case 'number':
        return (
          <NumberInput
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
      default:
        return (
          <TextInput
            key={input.id}
            label={input.label}
            placeholder={input.placeholder}
            required={input.required}
            {...form.getInputProps(input.id)}
          />
        );
    }
  };

  return (
    <Paper p="md" radius="md" withBorder h="100%">
      <Stack h="100%" gap="sm">
        <Text size="sm" fw={600}>
          {block.title}
        </Text>

        <Stack gap="xs" style={{ flex: 1 }}>
          {buttons.map((action) => (
            <Button
              key={action.id}
              variant="light"
              color={action.color || 'blue'}
              leftSection={renderActionIcon(action)}
              loading={loading === action.id}
              onClick={() => handleActionClick(action)}
              fullWidth
              justify="flex-start"
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </Stack>

      {/* Action Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={currentAction?.label || 'Action'}
        centered
        size="sm"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {currentAction?.inputs && currentAction.inputs.length > 0 ? (
              <>
                {currentAction.inputs.map(renderInput)}
                <Group justify="flex-end" mt="md">
                  <Button variant="light" onClick={closeModal}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    color={currentAction.color || 'blue'}
                    loading={loading === currentAction.id}
                  >
                    Exécuter
                  </Button>
                </Group>
              </>
            ) : (
              <>
                <Text size="sm">
                  {currentAction?.confirm_message ||
                    `Êtes-vous sûr de vouloir effectuer "${currentAction?.label}" ?`}
                </Text>
                <Group justify="flex-end">
                  <Button variant="light" onClick={closeModal}>
                    Annuler
                  </Button>
                  <Button
                    color={currentAction?.color || 'blue'}
                    loading={loading === currentAction?.id}
                    onClick={handleSubmit}
                  >
                    Confirmer
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </form>
      </Modal>
    </Paper>
  );
}
