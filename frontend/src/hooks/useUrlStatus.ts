import { useState, useEffect, useRef } from 'react';
import { healthCheckApi, URLStatus } from '@/lib/api';

interface UseUrlStatusOptions {
  urls: string[];
  refreshInterval?: number;
  timeout?: number;
  enabled?: boolean;
}

interface UseUrlStatusResult {
  statuses: Record<string, URLStatus>;
  isLoading: boolean;
  lastChecked: Date | null;
  refresh: () => void;
}

export function useUrlStatus({
  urls,
  refreshInterval = 60000,
  timeout = 5,
  enabled = true,
}: UseUrlStatusOptions): UseUrlStatusResult {
  const [statuses, setStatuses] = useState<Record<string, URLStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Use refs to track state without causing re-renders
  const isMountedRef = useRef(true);
  const isCheckingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlsRef = useRef<string[]>([]);

  // Update refs when props change
  urlsRef.current = urls;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't do anything if not enabled or no URLs
    if (!enabled || urls.length === 0) {
      return;
    }

    const doCheck = async () => {
      // Prevent concurrent checks
      if (isCheckingRef.current || !isMountedRef.current) return;

      const currentUrls = urlsRef.current;
      if (currentUrls.length === 0) return;

      isCheckingRef.current = true;

      try {
        setIsLoading(true);

        // Split URLs into batches of 50 (API limit)
        const BATCH_SIZE = 50;
        const batches: string[][] = [];
        for (let i = 0; i < currentUrls.length; i += BATCH_SIZE) {
          batches.push(currentUrls.slice(i, i + BATCH_SIZE));
        }

        // Check all batches in parallel
        const batchPromises = batches.map(batch =>
          healthCheckApi.checkUrls(batch, timeout)
        );
        const responses = await Promise.all(batchPromises);

        if (isMountedRef.current) {
          // Merge all results
          const allResults: Record<string, URLStatus> = {};
          let lastCheckedAt = '';
          for (const response of responses) {
            Object.assign(allResults, response.results);
            lastCheckedAt = response.checked_at;
          }
          setStatuses(allResults);
          setLastChecked(new Date(lastCheckedAt));
        }
      } catch (error) {
        console.error('Failed to check URLs:', error);
        if (isMountedRef.current) {
          // Set error state for all URLs
          const errorStatuses: Record<string, URLStatus> = {};
          currentUrls.forEach(url => {
            errorStatuses[url] = {
              url,
              is_up: false,
              status_code: null,
              response_time_ms: null,
              error: 'Check failed',
            };
          });
          setStatuses(errorStatuses);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        isCheckingRef.current = false;
      }
    };

    // Initial check with a small delay to avoid blocking render
    const initialTimeout = setTimeout(doCheck, 100);

    // Set up interval for subsequent checks
    intervalRef.current = setInterval(doCheck, refreshInterval);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, urls.length, refreshInterval, timeout]);

  const refresh = async () => {
    if (isCheckingRef.current || !enabled || urls.length === 0) return;

    isCheckingRef.current = true;
    setIsLoading(true);

    try {
      const currentUrls = urlsRef.current;

      // Split URLs into batches of 50 (API limit)
      const BATCH_SIZE = 50;
      const batches: string[][] = [];
      for (let i = 0; i < currentUrls.length; i += BATCH_SIZE) {
        batches.push(currentUrls.slice(i, i + BATCH_SIZE));
      }

      // Check all batches in parallel
      const batchPromises = batches.map(batch =>
        healthCheckApi.checkUrls(batch, timeout)
      );
      const responses = await Promise.all(batchPromises);

      if (isMountedRef.current) {
        // Merge all results
        const allResults: Record<string, URLStatus> = {};
        let lastCheckedAt = '';
        for (const response of responses) {
          Object.assign(allResults, response.results);
          lastCheckedAt = response.checked_at;
        }
        setStatuses(allResults);
        setLastChecked(new Date(lastCheckedAt));
      }
    } catch (error) {
      console.error('Failed to refresh URLs:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isCheckingRef.current = false;
    }
  };

  return {
    statuses,
    isLoading,
    lastChecked,
    refresh,
  };
}

// Helper functions
export function getStatusColor(status: URLStatus | undefined): string {
  if (!status) return 'gray';
  if (status.is_up) return 'green';
  return 'red';
}

export function getStatusLabel(status: URLStatus | undefined): string {
  if (!status) return 'Vérification...';
  if (status.is_up) {
    if (status.response_time_ms !== null) {
      return `En ligne (${status.response_time_ms}ms)`;
    }
    return 'En ligne';
  }
  if (status.error) {
    return status.error;
  }
  return 'Hors ligne';
}
