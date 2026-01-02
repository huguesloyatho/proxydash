'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechToTextOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface UseSpeechToTextReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

// SpeechRecognition types for Web Speech API
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    language = 'fr-FR',
    continuous = false, // Changed to false - better for dictation
    interimResults = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onResultRef = useRef(options.onResult);
  const onErrorRef = useRef(options.onError);

  // Keep refs up to date
  useEffect(() => {
    onResultRef.current = options.onResult;
    onErrorRef.current = options.onError;
  }, [options.onResult, options.onError]);

  // Initialize recognition once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('Speech Recognition API not supported in this browser');
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    console.log('Speech Recognition API available');

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      let errorMessage = 'Erreur de reconnaissance vocale';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'Aucune parole détectée - parlez plus fort';
          break;
        case 'audio-capture':
          errorMessage = 'Aucun microphone détecté';
          break;
        case 'not-allowed':
          errorMessage = 'Accès au microphone refusé - vérifiez les permissions';
          break;
        case 'network':
          errorMessage = 'Erreur réseau - connexion internet requise';
          break;
        case 'aborted':
          // Don't show error for aborted - it's intentional
          setIsListening(false);
          return;
        case 'service-not-allowed':
          errorMessage = 'Service non autorisé - HTTPS requis ou permissions manquantes';
          break;
        default:
          errorMessage = `Erreur: ${event.error}`;
      }

      setError(errorMessage);
      setIsListening(false);
      onErrorRef.current?.(errorMessage);
    };

    recognition.onresult = (event) => {
      console.log('Speech recognition result:', event);
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += text;
          console.log('Final transcript:', text);
        } else {
          interim += text;
          console.log('Interim transcript:', text);
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
        onResultRef.current?.(finalTranscript, true);
      }

      setInterimTranscript(interim);
      if (interim) {
        onResultRef.current?.(interim, false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, [language, continuous, interimResults]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      console.error('Recognition not initialized');
      setError('Reconnaissance vocale non initialisée');
      return;
    }

    if (isListening) {
      console.log('Already listening');
      return;
    }

    setError(null);
    setInterimTranscript('');

    try {
      console.log('Starting speech recognition...');
      recognitionRef.current.start();
    } catch (err) {
      console.error('Error starting recognition:', err);
      // If already started, stop and restart
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current?.start();
        }, 100);
      } catch {
        setError('Impossible de démarrer la reconnaissance vocale');
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('Stopping speech recognition...');
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    console.log('Toggle listening, current state:', isListening);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error,
  };
}
