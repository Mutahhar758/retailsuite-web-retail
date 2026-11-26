import { useState, useEffect } from 'react';
import { useOfflineStore } from '../stores/useOfflineStore';
import { useAuthStore } from '../stores/useAuthStore';
import { offlineSyncService } from '../services/offlineSyncService';
import api from '../services/api';

/**
 * Reactive hook that tracks network connectivity separately from Offline Mode:
 * - `isConnected`: actual live connectivity (browser online && API server reachable)
 * - `isOfflineMode`: true ONLY when the user explicitly switched to Offline Mode
 * - `isOnline`: `!isOfflineMode` (so losing internet never auto-switches the UI or discards vouchers)
 */
export function useNetworkStatus(): {
  isOnline: boolean;
  isConnected: boolean;
  isOfflineMode: boolean;
} {
  const [browserOnline, setBrowserOnline] = useState<boolean>(navigator.onLine);
  const {
    isServerReachable,
    setServerReachable,
    isOfflineMode,
    setOfflineMode,
    setOfflinePromptDismissed,
  } = useOfflineStore();

  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      setServerReachable(true);
    };
    const handleOffline = () => {
      setBrowserOnline(false);
      setServerReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setServerReachable]);

  const isConnected = browserOnline && isServerReachable;

  // When connectivity recovers, reset dismissal flag and smoothly return to Online Mode
  // if the user has a real authenticated session (not offline-only login).
  useEffect(() => {
    if (!isConnected) return;

    setOfflinePromptDismissed(false);

    if (isOfflineMode) {
      const { accessToken } = useAuthStore.getState();
      if (accessToken && accessToken !== 'offline-mode-token') {
        setOfflineMode(false);
        offlineSyncService.promptForSyncReview().catch(console.error);
      }
    }
  }, [isConnected, isOfflineMode, setOfflineMode, setOfflinePromptDismissed]);

  // When browser thinks it's online but API failed, probe every 10s to detect recovery
  useEffect(() => {
    if (!browserOnline || isServerReachable) return;

    const timer = window.setInterval(async () => {
      if (!navigator.onLine) return;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 3500);
      try {
        const baseUrl = (api.defaults.baseURL || 'https://retailer-api.bizgripsolutions.com/').replace(/\/$/, '');
        await fetch(baseUrl + '/', { method: 'GET', mode: 'no-cors', signal: controller.signal });
        setServerReachable(true);
        offlineSyncService.promptForSyncReview().catch(console.error);
      } catch {
        // Still unreachable
      } finally {
        window.clearTimeout(timeoutId);
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [browserOnline, isServerReachable, setServerReachable]);

  return {
    isOnline: !isOfflineMode,
    isConnected,
    isOfflineMode,
  };
}
