import { create } from 'zustand';

interface OfflineState {
  /** Number of sale vouchers pending sync */
  pendingCount: number;
  /** True while syncAll() is running */
  isSyncing: boolean;
  /** Timestamp of the last successful sync batch */
  lastSyncedAt: Date | null;
  /** Permanent device identifier (e.g. 'A3F1') */
  deviceId: string | null;

  setPendingCount: (n: number) => void;
  setSyncing: (b: boolean) => void;
  setLastSyncedAt: (d: Date) => void;
  setDeviceId: (id: string) => void;
}

/**
 * Runtime-only store for offline / sync state.
 * Not persisted — re-loaded from IndexedDB on app start.
 */
export const useOfflineStore = create<OfflineState>()((set) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  deviceId: null,

  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setDeviceId: (deviceId) => set({ deviceId }),
}));
