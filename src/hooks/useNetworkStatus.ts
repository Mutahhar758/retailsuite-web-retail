import { useState, useEffect } from 'react';
import { useOfflineStore } from '../stores/useOfflineStore';
import { offlineSyncService } from '../services/offlineSyncService';
import api from '../services/api';

/**
 * Reactive hook that tracks real online/offline status:
 * Combines browser navigator.onLine with live API server reachability
 * (so dropping internet while still on Wi-Fi/LAN also switches to Offline Mode).
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [browserOnline, setBrowserOnline] = useState<boolean>(navigator.onLine);
  const { isServerReachable, setServerReachable } = useOfflineStore();

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

  // When browser thinks it's online but API failed, probe every 10s to auto-recover & sync
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

  return { isOnline: browserOnline && isServerReachable };
}
