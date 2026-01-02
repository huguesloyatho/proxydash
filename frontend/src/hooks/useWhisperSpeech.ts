'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { speechApi } from '@/lib/api';

interface UseWhisperSpeechOptions {
  language?: string;
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseWhisperSpeechReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  isAvailable: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => Promise<void>;
  error: string | null;
}

export function useWhisperSpeech(options: UseWhisperSpeechOptions = {}): UseWhisperSpeechReturn {
  const { language = 'fr', onTranscript, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Use refs for callbacks to avoid stale closures
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const languageRef = useRef(language);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
    languageRef.current = language;
  }, [onTranscript, onError, language]);

  // Check browser support and backend availability
  useEffect(() => {
    const supported = typeof window !== 'undefined' &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices;
    setIsSupported(supported);
    console.log('useWhisperSpeech: Browser audio supported:', supported);

    const checkBackend = async () => {
      try {
        console.log('useWhisperSpeech: Checking backend availability...');
        const config = await speechApi.getConfig();
        console.log('useWhisperSpeech: Backend config:', config);
        setIsAvailable(config.available);
      } catch (err) {
        console.error('useWhisperSpeech: Could not check speech backend:', err);
        setIsAvailable(false);
      }
    };

    if (supported) {
      checkBackend();
    }
  }, []);

  const processRecording = useCallback(async (blob: Blob) => {
    console.log('Processing recording, blob size:', blob.size, 'type:', blob.type);

    if (blob.size < 1000) {
      setError('Enregistrement trop court');
      return;
    }

    setIsTranscribing(true);
    try {
      console.log('Sending audio to backend for transcription...');
      const result = await speechApi.transcribe(blob, languageRef.current);
      console.log('Transcription result:', result);

      if (result.text && result.text.trim()) {
        const transcribedText = result.text.trim();
        console.log('Calling onTranscript with:', transcribedText);
        onTranscriptRef.current?.(transcribedText);
      } else {
        console.log('No speech detected in result');
        setError('Aucune parole détectée');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Erreur de transcription';
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || !isSupported) {
      console.log('startRecording: already recording or not supported');
      return;
    }

    setError(null);

    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      console.log('Microphone access granted');

      // Dynamically import RecordRTC to avoid SSR issues
      const RecordRTC = (await import('recordrtc')).default;

      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
        disableLogs: false,
      });

      recorder.startRecording();
      recorderRef.current = recorder;
      setIsRecording(true);
      console.log('Recording started with RecordRTC');

    } catch (err) {
      console.error('Failed to start recording:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Accès au microphone refusé');
        } else if (err.name === 'NotFoundError') {
          setError('Aucun microphone trouvé');
        } else {
          setError(`Erreur: ${err.message}`);
        }
      } else {
        setError('Erreur inconnue');
      }
      onErrorRef.current?.(error || 'Erreur');
    }
  }, [isRecording, isSupported, error]);

  const stopRecording = useCallback(() => {
    console.log('stopRecording called, recorder exists:', !!recorderRef.current);

    if (!recorderRef.current) {
      console.log('No recorder to stop');
      setIsRecording(false);
      return;
    }

    const recorder = recorderRef.current;

    recorder.stopRecording(async () => {
      console.log('Recording stopped');

      // Get the blob
      const blob = recorder.getBlob();
      console.log('Got blob:', blob.size, 'bytes');

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Track stopped:', track.kind);
        });
        streamRef.current = null;
      }

      // Destroy recorder
      recorder.destroy();
      recorderRef.current = null;

      // Process the recording
      if (blob && blob.size > 0) {
        await processRecording(blob);
      } else {
        setError('Aucun audio enregistré');
      }
    });

    setIsRecording(false);
  }, [processRecording]);

  const toggleRecording = useCallback(async () => {
    console.log('toggleRecording, isRecording:', isRecording);
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    isSupported,
    isAvailable,
    startRecording,
    stopRecording,
    toggleRecording,
    error,
  };
}
