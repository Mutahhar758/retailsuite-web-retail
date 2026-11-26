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
  /** False when browser is online locally but API server is unreachable */
  isServerReachable: boolean;
  /** True ONLY when the user explicitly switched into Offline Mode (or used Offline Login) */
  isOfflineMode: boolean;
  /** True if user chose "Stay Online" during the current outage (resets when reconnected) */
  offlinePromptDismissed: boolean;
  /** Controls the Offline Sync Review & Confirmation modal */
  syncReviewOpen: boolean;

  setPendingCount: (n: number) => void;
  setSyncing: (b: boolean) => void;
  setLastSyncedAt: (d: Date) => void;
  setDeviceId: (id: string) => void;
  setServerReachable: (b: boolean) => void;
  setOfflineMode: (b: boolean) => void;
  setOfflinePromptDismissed: (b: boolean) => void;
  setSyncReviewOpen: (b: boolean) => void;
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
  isServerReachable: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isOfflineMode: false,
  offlinePromptDismissed: false,
  syncReviewOpen: false,

  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setServerReachable: (isServerReachable) => set({ isServerReachable }),
  setOfflineMode: (isOfflineMode) => set({ isOfflineMode }),
  setOfflinePromptDismissed: (offlinePromptDismissed) => set({ offlinePromptDismissed }),
  setSyncReviewOpen: (syncReviewOpen) => set({ syncReviewOpen }),
}));
