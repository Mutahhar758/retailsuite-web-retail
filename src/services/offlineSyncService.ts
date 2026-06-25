import { notification } from 'antd';
import {
  getOfflineSaleQueue,
  removeOfflineSale,
  updateOfflineSaleRetry,
  getOfflineSaleCount,
} from './offlineDb';
import { saleService } from './saleService';
import { useOfflineStore } from '../stores/useOfflineStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppStore } from '../stores/useAppStore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
}

const MAX_RETRIES = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Sync Engine
// ─────────────────────────────────────────────────────────────────────────────

async function syncAll(): Promise<SyncResult> {
  const { setSyncing, setPendingCount, setLastSyncedAt } = useOfflineStore.getState();

  // Guard: don't run if offline or already syncing
  if (!navigator.onLine) return { synced: 0, failed: 0, remaining: 0 };
  if (useOfflineStore.getState().isSyncing) return { synced: 0, failed: 0, remaining: 0 };

  // Guard: don't sync if not authenticated
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) {
    notification.warning({
      message: 'Not Logged In',
      description: 'You have offline vouchers pending sync. Please log in to sync them.',
      placement: 'bottomRight',
      duration: 0,
    });
    return { synced: 0, failed: 0, remaining: 0 };
  }

  const { currentTenantIdentifier } = useAppStore.getState();

  setSyncing(true);

  const queue = await getOfflineSaleQueue();
  const pending = queue.filter(
    (e) => e.status === 'pending' && e.tenantIdentifier === currentTenantIdentifier
  );

  let synced = 0;
  let failed = 0;
  let sessionExpired = false;

  for (const entry of pending) {
    // Abort remaining if we went offline or session expired mid-sync
    if (!navigator.onLine || sessionExpired) break;

    try {
      const realVoucherNo = await saleService.createOnline(entry.request, entry.tenantIdentifier);
      await removeOfflineSale(entry.localId!);
      synced++;

      notification.success({
        message: 'Sale Synced',
        description: `Offline voucher ${entry.tempVoucherNo} synced as SL-${realVoucherNo}`,
        placement: 'bottomRight',
        duration: 6,
      });
    } catch (err: unknown) {
      // ── Session expired / unauthorized → abort entire batch ──
      const httpStatus = (err as any)?.response?.status;
      if (httpStatus === 401 || httpStatus === 403) {
        sessionExpired = true;
        notification.error({
          message: 'Session Expired',
          description: `Your session has expired. Please log in again — your ${pending.length} offline voucher(s) are safely stored and will sync after you log back in.`,
          placement: 'bottomRight',
          duration: 0, // Persistent — user must dismiss
        });
        break; // Don't touch retry counts — queue is intact
      }

      // ── Regular network / server error → increment retry ──
      const newRetryCount = entry.retryCount + 1;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';

      await updateOfflineSaleRetry(entry.localId!, newRetryCount, errorMsg, newStatus);

      if (newStatus === 'failed') {
        failed++;
        notification.error({
          message: 'Sync Failed',
          description: `Voucher ${entry.tempVoucherNo} failed after ${MAX_RETRIES} attempts. Use "Retry Failed" to sync manually.`,
          placement: 'bottomRight',
          duration: 0,
        });
      }
    }
  }

  // Update pending count in store
  const remaining = await saleService.getOfflinePendingCount(currentTenantIdentifier);
  setPendingCount(remaining);
  if (synced > 0) setLastSyncedAt(new Date());

  setSyncing(false);
  return { synced, failed, remaining };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listener management
// ─────────────────────────────────────────────────────────────────────────────

let boundListener: (() => void) | null = null;

function startListening(): void {
  if (boundListener) return; // already registered
  boundListener = () => {
    syncAll().catch(console.error);
  };
  window.addEventListener('online', boundListener);
}

function stopListening(): void {
  if (boundListener) {
    window.removeEventListener('online', boundListener);
    boundListener = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const offlineSyncService = {
  syncAll,
  startListening,
  stopListening,
};
