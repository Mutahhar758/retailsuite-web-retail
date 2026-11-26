import { create } from 'zustand';

interface AppUpdateState {
  /** True when a newer build or waiting service worker has been detected */
  updateAvailable: boolean;
  /** New version string reported by /version.json, if any */
  availableVersion: string | null;
  /** New buildTime reported by /version.json, if any */
  availableBuildTime: string | null;
  /** True when the user clicked "Later" or closed the update prompt for this build */
  isDismissed: boolean;

  setUpdateAvailable: (version: string | null, buildTime: string | null) => void;
  dismissUpdate: () => void;
  clearUpdate: () => void;
}

export const useAppUpdateStore = create<AppUpdateState>()((set) => ({
  updateAvailable: false,
  availableVersion: null,
  availableBuildTime: null,
  isDismissed: false,

  setUpdateAvailable: (availableVersion, availableBuildTime) =>
    set({
      updateAvailable: true,
      availableVersion,
      availableBuildTime,
      isDismissed: false,
    }),
  dismissUpdate: () => set({ isDismissed: true }),
  clearUpdate: () =>
    set({
      updateAvailable: false,
      availableVersion: null,
      availableBuildTime: null,
      isDismissed: false,
    }),
}));
