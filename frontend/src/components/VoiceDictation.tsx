'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Tooltip,
  Text,
  Group,
  Badge,
  Loader,
} from '@mantine/core';
import { IconMicrophone, IconMicrophoneOff, IconPlayerStop } from '@tabler/icons-react';
import { useWhisperSpeech } from '@/hooks/useWhisperSpeech';

interface VoiceDictationProps {
  onTranscript: (text: string) => void;
  language?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  disabled?: boolean;
}

export function VoiceDictation({
  onTranscript,
  language = 'fr',
  size = 'sm',
  showStatus = false,
  disabled = false,
}: VoiceDictationProps) {
  const {
    isRecording,
    isTranscribing,
    isSupported,
    isAvailable,
    toggleRecording,
    error,
  } = useWhisperSpeech({
    language,
    onTranscript: (text) => {
      if (text.trim()) {
        onTranscript(text);
      }
    },
  });

  if (!isSupported) {
    return (
      <Tooltip label="Votre navigateur ne supporte pas l'enregistrement audio">
        <ActionIcon
          variant="subtle"
          color="gray"
          size={size}
          disabled
        >
          <IconMicrophoneOff size={16} />
        </ActionIcon>
      </Tooltip>
    );
  }

  const isActive = isRecording || isTranscribing;

  return (
    <Group gap="xs" wrap="nowrap">
      <Tooltip
        label={
          !isAvailable
            ? "Service de transcription non disponible"
            : error
              ? error
              : isTranscribing
                ? 'Transcription en cours...'
                : isRecording
                  ? 'Cliquez pour arrêter et transcrire'
                  : 'Cliquez pour enregistrer'
        }
        color={error ? 'red' : !isAvailable ? 'orange' : undefined}
      >
        <ActionIcon
          variant={isActive ? 'filled' : 'subtle'}
          color={error ? 'red' : isRecording ? 'red' : isTranscribing ? 'orange' : 'blue'}
          size={size}
          onClick={toggleRecording}
          disabled={disabled || isTranscribing || !isAvailable}
          style={{
            animation: isRecording ? 'pulse 1.5s infinite' : undefined,
          }}
        >
          {isTranscribing ? (
            <Loader size={12} color="white" />
          ) : isRecording ? (
            <IconPlayerStop size={16} />
          ) : (
            <IconMicrophone size={16} />
          )}
        </ActionIcon>
      </Tooltip>

      {showStatus && isRecording && (
        <Badge
          color="red"
          variant="dot"
          size="sm"
          style={{ animation: 'pulse 1.5s infinite' }}
        >
          Enregistrement...
        </Badge>
      )}

      {showStatus && isTranscribing && (
        <Badge color="orange" variant="light" size="sm">
          Transcription...
        </Badge>
      )}

      {showStatus && error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </Group>
  );
}

// Compact version for inline use
export interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  language?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

export function VoiceDictationButton({
  onTranscript,
  language = 'fr',
  disabled = false,
  size = 'xs',
  color = 'blue',
}: VoiceDictationButtonProps) {
  const {
    isRecording,
    isTranscribing,
    isSupported,
    isAvailable,
    toggleRecording,
    error,
  } = useWhisperSpeech({
    language,
    onTranscript: (text) => {
      console.log('VoiceDictationButton received:', text);
      if (text.trim()) {
        onTranscript(text.trim());
      }
    },
    onError: (err) => {
      console.error('VoiceDictationButton error:', err);
    },
  });

  if (!isSupported) {
    return (
      <Tooltip label="Enregistrement audio non supporté">
        <ActionIcon
          variant="subtle"
          color="gray"
          size={size}
          disabled
        >
          <IconMicrophoneOff size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />
        </ActionIcon>
      </Tooltip>
    );
  }

  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : 16;
  const isActive = isRecording || isTranscribing;

  const tooltipLabel = !isAvailable
    ? "Installez faster-whisper sur le serveur"
    : error
      ? error
      : isTranscribing
        ? 'Transcription...'
        : isRecording
          ? 'Cliquez pour transcrire'
          : 'Dicter';

  return (
    <Tooltip
      label={tooltipLabel}
      color={error ? 'red' : !isAvailable ? 'orange' : undefined}
    >
      <ActionIcon
        variant={isActive ? 'filled' : 'subtle'}
        color={error ? 'red' : isRecording ? 'red' : isTranscribing ? 'orange' : color}
        size={size}
        onClick={() => {
          console.log('Button clicked, toggling recording');
          toggleRecording();
        }}
        disabled={disabled || isTranscribing || !isAvailable}
        style={{
          animation: isRecording ? 'pulse 1.5s infinite' : undefined,
        }}
      >
        {isTranscribing ? (
          <Loader size={iconSize - 2} color="white" />
        ) : isRecording ? (
          <IconPlayerStop size={iconSize} />
        ) : (
          <IconMicrophone size={iconSize} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
