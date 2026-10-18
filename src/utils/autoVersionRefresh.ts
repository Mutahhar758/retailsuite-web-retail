import { message } from 'antd';

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

export const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0';
export const CURRENT_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

const LAST_VERSION_KEY = 'app_installed_version';
const LAST_BUILD_TIME_KEY = 'app_installed_build_time';
const RELOAD_GUARD_KEY = 'app_auto_reload_guard';

let isRefreshing = false;

/**
 * Perform a clean hard-refresh, clearing browser/PWA caches.
 */
export const performHardRefresh = async () => {
  if (isRefreshing) return;
  isRefreshing = true;

  console.log('[AutoRefresh] Initiating hard refresh to load new build...');

  try {
    // 1. Clear all CacheStorage entries (SW caches)
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(k => caches.delete(k)));
    }

    // 2. Unregister / update service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
    }
  } catch (err) {
    console.warn('[AutoRefresh] Cache purge warning:', err);
  }

  // Set guard to prevent rapid consecutive loops
  sessionStorage.setItem(RELOAD_GUARD_KEY, Date.now().toString());

  // 3. Force hard navigation bypassing cache
  window.location.replace(`/?_v=${Date.now()}`);
};

/**
 * Fetch /version.json with cache-busting headers to see if server has a newer build.
 */
export const checkForNewVersion = async () => {
  if (isRefreshing) return;

  // Protect against rapid reload loops within 5 seconds
  const lastReload = sessionStorage.getItem(RELOAD_GUARD_KEY);
  if (lastReload && Date.now() - Number(lastReload) < 5000) {
    return;
  }

  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) return;

    const data = await res.json();
    const serverVersion: string | undefined = data?.version;
    const serverBuildTime: string | undefined = data?.buildTime;

    const storedBuildTime = localStorage.getItem(LAST_BUILD_TIME_KEY);
    const storedVersion = localStorage.getItem(LAST_VERSION_KEY);

    // If server version is newer or build time has changed
    const isNewBuild = (serverVersion && serverVersion !== CURRENT_APP_VERSION) ||
                       (serverBuildTime && CURRENT_BUILD_TIME && serverBuildTime !== CURRENT_BUILD_TIME) ||
                       (serverBuildTime && storedBuildTime && serverBuildTime !== storedBuildTime) ||
                       (serverVersion && storedVersion && serverVersion !== storedVersion);

    if (isNewBuild) {
      console.log(`[AutoRefresh] Newer web app build detected! Server: v${serverVersion} (${serverBuildTime}) vs Client: v${CURRENT_APP_VERSION} (${CURRENT_BUILD_TIME})`);
      localStorage.setItem(LAST_VERSION_KEY, serverVersion || CURRENT_APP_VERSION);
      localStorage.setItem(LAST_BUILD_TIME_KEY, serverBuildTime || CURRENT_BUILD_TIME);

      message.loading({ content: 'New update available! Refreshing to latest version...', key: 'version-update', duration: 2 });
      setTimeout(() => {
        performHardRefresh();
      }, 400);
    }
  } catch {
    // Offline or network error — ignore silently
  }
};

/**
 * Initialize automatic background version checkers:
 * - Immediate check
 * - Service worker controllerchange event listener
 * - Periodic check every 45 seconds
 * - Tab visibility / focus event listener
 */
export const initAutoVersionRefresh = () => {
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

  // 3. Tab focus / visibility changes (when cashier returns to POS)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForNewVersion();
    }
  });

  window.addEventListener('focus', () => {
    checkForNewVersion();
  });

  // 4. Service Worker controller change (PWA auto-update trigger)
  if ('serviceWorker' in navigator) {
    let swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!swRefreshing) {
        swRefreshing = true;
        console.log('[AutoRefresh] Service Worker controller changed. Performing hard refresh...');
        performHardRefresh();
      }
    });
  }
};
