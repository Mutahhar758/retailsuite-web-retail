import { notification } from 'antd';
import {
  getOfflineSaleQueue,
  removeOfflineSale,
  updateOfflineSaleRetry,
  getOfflineSaleCount,
} from './offlineDb';
import { saleService } from './saleService';
import { useOfflineStore } from '../stores/useOfflineStore';

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

  setSyncing(true);

  const queue = await getOfflineSaleQueue();
  const pending = queue.filter((e) => e.status === 'pending');

  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    // If we go offline mid-sync, abort remaining
    if (!navigator.onLine) break;

    try {
      const realVoucherNo = await saleService.createOnline(entry.request);
      await removeOfflineSale(entry.localId!);
      synced++;

      notification.success({
        message: 'Sale Synced',
        description: `Offline voucher ${entry.tempVoucherNo} synced as SL-${realVoucherNo}`,
        placement: 'bottomRight',
        duration: 6,
      });
    } catch (err: unknown) {
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
          duration: 0, // Don't auto-dismiss errors
        });
      }
    }
  }

  // Update pending count in store
  const remaining = await getOfflineSaleCount();
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
