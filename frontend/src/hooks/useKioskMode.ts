'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useKioskStore } from '@/lib/store';

interface UseKioskModeOptions {
  tabs: string[];
  onTabChange: (tabSlug: string) => void;
  currentTab: string;
}

interface UseKioskModeReturn {
  isKioskMode: boolean;
  enterKioskMode: () => void;
  exitKioskMode: () => void;
  toggleKioskMode: () => void;
  currentKioskTab: string;
  timeUntilNextRotation: number;
  isPaused: boolean;
  pauseRotation: () => void;
  resumeRotation: () => void;
}

export function useKioskMode({
  tabs,
  onTabChange,
  currentTab,
}: UseKioskModeOptions): UseKioskModeReturn {
  const {
    isKioskMode,
    kioskAutoRotate,
    kioskRotationInterval,
    kioskTabOrder,
    setKioskMode,
    setKioskTabOrder,
  } = useKioskStore();

  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [timeUntilNextRotation, setTimeUntilNextRotation] = useState(kioskRotationInterval);
  const [isPaused, setIsPaused] = useState(false);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine which tabs to use for rotation
  const effectiveTabs = kioskTabOrder.length > 0 ? kioskTabOrder : tabs;

  // Enter fullscreen when kiosk mode is activated
  useEffect(() => {
    if (isKioskMode) {
      // Try to enter fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Fullscreen may fail due to user gesture requirements, that's OK
        });
      }
    } else {
      // Exit fullscreen when kiosk mode is disabled
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isKioskMode]);

  // Handle keyboard events (Escape to exit)
  useEffect(() => {
    if (!isKioskMode) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKioskMode(false);
      }
      // Pause/resume on Space
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
      // Manual navigation with arrow keys
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateToNextTab();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateToPrevTab();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isKioskMode, effectiveTabs, currentTabIndex]);

  // Handle fullscreen change (user may exit fullscreen via browser controls)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isKioskMode) {
        // User exited fullscreen, exit kiosk mode too
        setKioskMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isKioskMode, setKioskMode]);

  // Navigate to next tab
  const navigateToNextTab = useCallback(() => {
    if (effectiveTabs.length === 0) return;
    const nextIndex = (currentTabIndex + 1) % effectiveTabs.length;
    setCurrentTabIndex(nextIndex);
    onTabChange(effectiveTabs[nextIndex]);
    setTimeUntilNextRotation(kioskRotationInterval);
  }, [effectiveTabs, currentTabIndex, onTabChange, kioskRotationInterval]);

  // Navigate to previous tab
  const navigateToPrevTab = useCallback(() => {
    if (effectiveTabs.length === 0) return;
    const prevIndex = (currentTabIndex - 1 + effectiveTabs.length) % effectiveTabs.length;
    setCurrentTabIndex(prevIndex);
    onTabChange(effectiveTabs[prevIndex]);
    setTimeUntilNextRotation(kioskRotationInterval);
  }, [effectiveTabs, currentTabIndex, onTabChange, kioskRotationInterval]);

  // Auto-rotation timer
  useEffect(() => {
    if (!isKioskMode || !kioskAutoRotate || isPaused || effectiveTabs.length <= 1) {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
        rotationTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    // Reset countdown
    setTimeUntilNextRotation(kioskRotationInterval);

    // Countdown timer (updates every second)
    countdownTimerRef.current = setInterval(() => {
      setTimeUntilNextRotation((prev) => Math.max(0, prev - 1));
    }, 1000);

    // Rotation timer
    rotationTimerRef.current = setInterval(() => {
      navigateToNextTab();
    }, kioskRotationInterval * 1000);

    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [isKioskMode, kioskAutoRotate, kioskRotationInterval, isPaused, effectiveTabs.length, navigateToNextTab]);

  // Sync currentTabIndex when entering kiosk mode
  useEffect(() => {
    if (isKioskMode) {
      const index = effectiveTabs.indexOf(currentTab);
      if (index >= 0) {
        setCurrentTabIndex(index);
      }
      // If no tab order is set, use current tabs
      if (kioskTabOrder.length === 0 && tabs.length > 0) {
        setKioskTabOrder(tabs);
      }
    }
  }, [isKioskMode, currentTab, effectiveTabs, tabs, kioskTabOrder.length, setKioskTabOrder]);

  const enterKioskMode = useCallback(() => {
    setKioskMode(true);
    setIsPaused(false);
  }, [setKioskMode]);

  const exitKioskMode = useCallback(() => {
    setKioskMode(false);
  }, [setKioskMode]);

  const toggleKioskMode = useCallback(() => {
    if (isKioskMode) {
      exitKioskMode();
    } else {
      enterKioskMode();
    }
  }, [isKioskMode, enterKioskMode, exitKioskMode]);

  const pauseRotation = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeRotation = useCallback(() => {
    setIsPaused(false);
    setTimeUntilNextRotation(kioskRotationInterval);
  }, [kioskRotationInterval]);

  return {
    isKioskMode,
    enterKioskMode,
    exitKioskMode,
    toggleKioskMode,
    currentKioskTab: effectiveTabs[currentTabIndex] || currentTab,
    timeUntilNextRotation,
    isPaused,
    pauseRotation,
    resumeRotation,
  };
}
