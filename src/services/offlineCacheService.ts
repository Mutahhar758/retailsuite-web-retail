import { chartOfAccountService, type ChartOfAccountHeadDto } from './chartOfAccountService';
import { inventoryService, type Item } from './inventoryService';
import { narrationService, type NarrationDto } from './narrationService';
import {
  saveReferenceCache,
  getReferenceCache,
  isCacheValid,
  type CacheStore,
} from './offlineDb';

// Re-export types so callers can use one import
export type { Item, ChartOfAccountHeadDto, NarrationDto };

// ─────────────────────────────────────────────────────────────────────────────
// Custom error
// ─────────────────────────────────────────────────────────────────────────────

export class OfflineCacheMissError extends Error {
  constructor(dataType: string) {
    super(
      `"${dataType}" data is not available offline. Please open the Sales page while connected to the internet at least once to cache this data.`
    );
    this.name = 'OfflineCacheMissError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOrCache<T>(
  store: CacheStore,
  label: string,
  fetchFn: () => Promise<T[]>
): Promise<T[]> {
  if (navigator.onLine) {
    try {
      const data = await fetchFn();
      await saveReferenceCache(store, data);
      return data;
    } catch {
      // API failed but we're supposedly online — fall back to cache if available
      const cached = await getReferenceCache<T>(store);
      if (cached.length > 0) return cached;
      throw new Error(`Failed to fetch ${label} data`);
    }
  } else {
    const valid = await isCacheValid(store);
    if (valid) {
      return getReferenceCache<T>(store);
    }
    const stale = await getReferenceCache<T>(store);
    if (stale.length > 0) {
      // Use stale data but don't throw — better UX than empty dropdowns
      console.warn(`[OfflineCache] Using stale ${label} data (TTL expired)`);
      return stale;
    }
    throw new OfflineCacheMissError(label);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const offlineCacheService = {
  async getItems(): Promise<Item[]> {
    return fetchOrCache<Item>('cachedItems', 'Items', () => inventoryService.getItems());
  },

  async getCustomers(): Promise<ChartOfAccountHeadDto[]> {
    return fetchOrCache<ChartOfAccountHeadDto>(
      'cachedCustomers',
      'Customers',
      () => chartOfAccountService.getCustomerAccounts()
    );
  },

  async getNarrations(): Promise<NarrationDto[]> {
    return fetchOrCache<NarrationDto>(
      'cachedNarrations',
      'Narrations',
      () => narrationService.getActiveNarrations()
    );
  },

  async getUnits(): Promise<{ code: string; title: string }[]> {
    return fetchOrCache<{ code: string; title: string }>(
      'cachedUnits',
      'Units',
      () => inventoryService.getUnits()
    );
  },

  /**
   * Pre-fetch all reference data in one shot.
   * Call on app startup when online to ensure cache is warm.
   */
  async warmCache(): Promise<void> {
    if (!navigator.onLine) return;
    await Promise.allSettled([
      offlineCacheService.getItems(),
      offlineCacheService.getCustomers(),
      offlineCacheService.getNarrations(),
      offlineCacheService.getUnits(),
    ]);
  },
};
