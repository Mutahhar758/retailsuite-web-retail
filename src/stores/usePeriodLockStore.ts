import { create } from 'zustand';
import dayjs, { type Dayjs } from 'dayjs';
import { accountingPeriodService, type PeriodLockStatusResponse } from '../services/accountingPeriodService';

interface PeriodLockState {
  status: PeriodLockStatusResponse | null;
  lockDate: string | null;
  loading: boolean;
  loaded: boolean;
  fetchLockStatus: () => Promise<void>;
  isDateLocked: (date: Dayjs | string | null | undefined) => boolean;
  reset: () => void;
}

export const usePeriodLockStore = create<PeriodLockState>((set, get) => ({
  status: null,
  lockDate: null,
  loading: false,
  loaded: false,

  fetchLockStatus: async () => {
    set({ loading: true });
    try {
      const status = await accountingPeriodService.getLockStatus();
      set({
        status,
        lockDate: status.lockDate ?? null,
        loading: false,
        loaded: true,
      });
    } catch {
      set({ loading: false, loaded: true });
    }
  },

  isDateLocked: (date) => {
    const lockDate = get().lockDate;
    if (!lockDate || !date) return false;
    const d = typeof date === 'string' ? dayjs(date) : date;
    if (!d.isValid()) return false;
    return !d.startOf('day').isAfter(dayjs(lockDate).startOf('day'));
  },

  reset: () => set({ status: null, lockDate: null, loading: false, loaded: false }),
}));
