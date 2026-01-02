'use client';

import { MantineProvider, createTheme, MantineThemeOverride, MantineColorShade } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useThemeStore } from '@/lib/store';
import { PRESET_THEMES, ThemeConfig } from '@/lib/themes';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// Composant interne qui utilise le store
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { activeThemeId, customSettings } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = useMemo(() => {
    return PRESET_THEMES.find(t => t.id === activeThemeId) || PRESET_THEMES[0];
  }, [activeThemeId]);

  const theme = useMemo((): MantineThemeOverride => {
    return createTheme({
      primaryColor: activeTheme.colors.primary,
      primaryShade: activeTheme.colors.primaryShade as MantineColorShade,
      fontFamily: 'Inter, system-ui, sans-serif',
      defaultRadius: customSettings.borderRadius || activeTheme.borderRadius,
      colors: {
        dark: activeTheme.colors.dark,
      },
    });
  }, [activeTheme, customSettings.borderRadius]);

  // Appliquer le fond d'écran personnalisé
  useEffect(() => {
    if (!mounted) return;

    const body = document.body;

    if (customSettings.backgroundImage) {
      body.style.backgroundImage = `url('${customSettings.backgroundImage}')`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
      body.style.backgroundRepeat = 'no-repeat';
    } else {
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundAttachment = '';
      body.style.backgroundRepeat = '';
    }

    return () => {
      body.style.backgroundImage = '';
    };
  }, [customSettings.backgroundImage, mounted]);

  // Injecter les styles CSS personnalisés
  useEffect(() => {
    if (!mounted) return;

    const styleId = 'custom-theme-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const hasBackground = !!customSettings.backgroundImage;
    const cardOpacity = customSettings.cardOpacity / 100;
    const overlayOpacity = customSettings.overlayOpacity / 100;

    styleEl.textContent = `
      ${hasBackground ? `
        /* Overlay sur le fond */
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, ${overlayOpacity});
          pointer-events: none;
          z-index: -1;
        }

        /* Cartes avec effet verre */
        .mantine-Card-root,
        .mantine-Paper-root,
        .mantine-AppShell-navbar {
          background-color: rgba(37, 38, 43, ${cardOpacity}) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }

        .mantine-AppShell-main {
          background: transparent !important;
        }
      ` : ''}
    `;

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [customSettings.backgroundImage, customSettings.cardOpacity, customSettings.overlayOpacity, mounted]);

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 5 minutes before marking as stale
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 30 minutes
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
            // Retry failed requests 2 times
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeWrapper>{children}</ThemeWrapper>
    </QueryClientProvider>
  );
}
