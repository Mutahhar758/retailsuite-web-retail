import { useAppUpdateStore } from '../stores/useAppUpdateStore';

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

export const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0';
export const CURRENT_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

const LAST_VERSION_KEY = 'app_installed_version';
const LAST_BUILD_TIME_KEY = 'app_installed_build_time';
const RELOAD_GUARD_KEY = 'app_auto_reload_guard';
const DISMISSED_BUILD_KEY = 'app_dismissed_update_build';

// Clean up any lingering _v parameter from the URL bar immediately without reloading
if (typeof window !== 'undefined' && window.location.search.includes('_v=')) {
  const url = new URL(window.location.href);
  url.searchParams.delete('_v');
  const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
  window.history.replaceState(null, '', cleanUrl);
}

let isRefreshing = false;
let isUserInitiatedRefresh = false;

/**
 * Perform a clean hard-refresh, activating any waiting Service Worker and clearing caches.
 * Called ONLY after explicit user confirmation.
 */
export const performHardRefresh = async () => {
  if (isRefreshing) return;
  isRefreshing = true;
  isUserInitiatedRefresh = true;

  console.log('[AppUpdate] User confirmed update — initiating refresh to load new build...');

  const { availableVersion, availableBuildTime } = useAppUpdateStore.getState();
  if (availableVersion) {
    localStorage.setItem(LAST_VERSION_KEY, availableVersion);
  }
  if (availableBuildTime) {
    localStorage.setItem(LAST_BUILD_TIME_KEY, availableBuildTime);
  }
  sessionStorage.removeItem(DISMISSED_BUILD_KEY);

  try {
    // 1. Tell any waiting service worker to take over now
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg.update().catch(() => {});
      }
    }

    // 2. Clear all CacheStorage entries (SW caches)
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn('[AppUpdate] Cache purge warning:', err);
  }

  // Set guard to prevent rapid consecutive loops
  sessionStorage.setItem(RELOAD_GUARD_KEY, Date.now().toString());

  // 3. Clean reload current page without appending query parameter to URL
  window.location.reload();
};

/**
 * Explicit user action: confirm and apply the pending update.
 */
export const applyPendingUpdate = () => {
  void performHardRefresh();
};

/**
 * Explicit user action: ignore / defer the pending update for this session.
 * The app will NOT reload and will NOT re-open the notification for this build.
 */
export const dismissPendingUpdate = () => {
  const { availableBuildTime, availableVersion, dismissUpdate } = useAppUpdateStore.getState();
  const buildId = availableBuildTime || availableVersion || 'sw-waiting';
  sessionStorage.setItem(DISMISSED_BUILD_KEY, buildId);
  dismissUpdate();
};

const notifyUpdateAvailable = (version: string | null, buildTime: string | null) => {
  const buildId = buildTime || version || 'sw-waiting';
  const dismissedBuild = sessionStorage.getItem(DISMISSED_BUILD_KEY);
  const store = useAppUpdateStore.getState();

  // If user already ignored/dismissed this exact build, keep footer badge available
  // without re-opening the notification popup.
  if (dismissedBuild === buildId) {
    if (!store.updateAvailable) {
      useAppUpdateStore.setState({
        updateAvailable: true,
        availableVersion: version,
        availableBuildTime: buildTime,
        isDismissed: true,
      });
    }
    return;
  }

  if (
    store.updateAvailable &&
    store.availableBuildTime === buildTime &&
    store.availableVersion === version
  ) {
    return;
  }

  store.setUpdateAvailable(version, buildTime);
};

/**
 * Fetch /version.json with cache-busting headers to see if server has a newer build.
 * Never auto-reloads — only flags an available update for user confirmation.
 */
export const checkForNewVersion = async () => {
  // Do not run in local development mode
  if (import.meta.env.DEV) return;
  if (isRefreshing) return;

  // Protect against rapid checks immediately after a reload
  const lastReload = sessionStorage.getItem(RELOAD_GUARD_KEY);
  if (lastReload && Date.now() - Number(lastReload) < 30000) {
    return;
  }

  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!res.ok) return;

    const data = await res.json();
    const serverVersion: string | undefined = data?.version;
    const serverBuildTime: string | undefined = data?.buildTime;

    const storedBuildTime = localStorage.getItem(LAST_BUILD_TIME_KEY);
    const storedVersion = localStorage.getItem(LAST_VERSION_KEY);

    // Detect if server has a newer release than the currently running bundle
    const isNewVersion = !!(
      serverVersion &&
      CURRENT_APP_VERSION &&
      serverVersion !== CURRENT_APP_VERSION &&
      serverVersion !== storedVersion
    );
    const isNewBuildTime = !!(
      serverBuildTime &&
      CURRENT_BUILD_TIME &&
      serverBuildTime !== CURRENT_BUILD_TIME &&
      serverBuildTime !== storedBuildTime
    );

    if (isNewVersion || isNewBuildTime) {
      console.log(
        `[AppUpdate] Newer web app build detected! Server: v${serverVersion} (${serverBuildTime}) vs Client: v${CURRENT_APP_VERSION} (${CURRENT_BUILD_TIME})`
      );
      notifyUpdateAvailable(serverVersion || null, serverBuildTime || null);
    }
  } catch {
    // Offline or network error — ignore silently
  }
};

/**
 * Watch for waiting Service Workers so PWA updates also ask the user instead of auto-reloading.
 */
const monitorServiceWorkerUpdates = () => {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const reg of registrations) {
        if (reg.waiting) {
          notifyUpdateAvailable(null, null);
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdateAvailable(null, null);
            }
          });
        });
      }
    })
    .catch(() => {});

  // Never auto-reload on controllerchange unless the user explicitly clicked Update Now
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isUserInitiatedRefresh && !isRefreshing) {
      window.location.reload();
    }
  });
};

/**
 * Initialize background version checkers (prompt-only, never auto-reloads):
 * - Immediate check
 * - Periodic check every 45 seconds
 * - Tab visibility / focus check
 * - Service worker waiting state monitor
 */
export const initAutoVersionRefresh = () => {
  // Never run in local development mode
  if (import.meta.env.DEV) {
    return;
  }

  // Sync initial version keys
  if (!localStorage.getItem(LAST_VERSION_KEY)) {
    localStorage.setItem(LAST_VERSION_KEY, CURRENT_APP_VERSION);
  }
  if (CURRENT_BUILD_TIME && !localStorage.getItem(LAST_BUILD_TIME_KEY)) {
    localStorage.setItem(LAST_BUILD_TIME_KEY, CURRENT_BUILD_TIME);
  }

  // 1. Initial check
  checkForNewVersion();

  // 2. Periodic polling every 45s
  setInterval(checkForNewVersion, 45 * 1000);

  // 3. Tab focus / visibility changes
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForNewVersion();
    }
  });

  window.addEventListener('focus', () => {
    checkForNewVersion();
  });

  // 4. Service Worker waiting monitor (never auto-refreshes)
  monitorServiceWorkerUpdates();
};
