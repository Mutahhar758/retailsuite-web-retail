import { openDB, type IDBPDatabase } from 'idb';
import type { SaleCreateRequest } from './saleService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineSaleEntry {
  localId?: number;
  deviceId: string;
  localSeq: number;
  tempVoucherNo: string;
  request: SaleCreateRequest;
  createdAt: string;       // ISO timestamp
  retryCount: number;
  status: 'pending' | 'failed';
  lastError?: string;
}

interface DeviceMeta {
  key: string;
  value: string | number;
}

interface CacheMeta {
  key: string;
  cachedAt: number;        // epoch ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'retail-offline-v1';
const DB_VERSION = 1;
const CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

// ─────────────────────────────────────────────────────────────────────────────
// DB Initialisation
// ─────────────────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Offline sale queue
        if (!db.objectStoreNames.contains('offlineSaleQueue')) {
          db.createObjectStore('offlineSaleQueue', {
            keyPath: 'localId',
            autoIncrement: true,
          });
        }
        // Reference data caches
        for (const store of ['cachedItems', 'cachedCustomers', 'cachedNarrations', 'cachedUnits']) {
          if (!db.objectStoreNames.contains(store)) {
            // Key path is set per-record when writing — use out-of-line key
            db.createObjectStore(store);
          }
        }
        // Metadata (TTL timestamps, device info)
        if (!db.objectStoreNames.contains('cacheMetadata')) {
          db.createObjectStore('cacheMetadata', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('deviceMeta')) {
          db.createObjectStore('deviceMeta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Device Identity
// ─────────────────────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'device_id';
const LOCAL_SEQ_KEY = 'local_seq';
const LS_DEVICE_ID = 'retail_device_id'; // localStorage backup

function generateDeviceId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0,O,1,I)
  let id = '';
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  for (let i = 0; i < 4; i++) {
    id += chars[array[i] % chars.length];
  }
  return id;
}

export async function getOrCreateDeviceId(): Promise<string> {
  // 1. Try IndexedDB
  const db = await getDb();
  const row = await db.get('deviceMeta', DEVICE_ID_KEY) as DeviceMeta | undefined;
  if (row) {
    localStorage.setItem(LS_DEVICE_ID, row.value as string);
    return row.value as string;
  }

  // 2. Try localStorage backup
  const lsId = localStorage.getItem(LS_DEVICE_ID);
  if (lsId) {
    await db.put('deviceMeta', { key: DEVICE_ID_KEY, value: lsId });
    return lsId;
  }

  // 3. Generate new
  const newId = generateDeviceId();
  await db.put('deviceMeta', { key: DEVICE_ID_KEY, value: newId });
  localStorage.setItem(LS_DEVICE_ID, newId);
  return newId;
}

export async function getNextLocalSeq(): Promise<number> {
  const db = await getDb();
  const row = await db.get('deviceMeta', LOCAL_SEQ_KEY) as DeviceMeta | undefined;
  const next = row ? (row.value as number) + 1 : 1;
  await db.put('deviceMeta', { key: LOCAL_SEQ_KEY, value: next });
  return next;
}

export async function getNextOfflineVoucherNo(): Promise<string> {
  const deviceId = await getOrCreateDeviceId();
  const seq = await getNextLocalSeq();
  const paddedSeq = String(seq).padStart(4, '0');
  return `${deviceId}-${paddedSeq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline Sale Queue
// ─────────────────────────────────────────────────────────────────────────────

export async function enqueueOfflineSale(
  entry: Omit<OfflineSaleEntry, 'localId'>
): Promise<number> {
  const db = await getDb();
  const localId = await db.add('offlineSaleQueue', entry);
  return localId as number;
}

export async function getOfflineSaleQueue(): Promise<OfflineSaleEntry[]> {
  const db = await getDb();
  const all = await db.getAll('offlineSaleQueue') as OfflineSaleEntry[];
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getOfflineSaleCount(): Promise<number> {
  const db = await getDb();
  return db.count('offlineSaleQueue');
}

export async function removeOfflineSale(localId: number): Promise<void> {
  const db = await getDb();
  await db.delete('offlineSaleQueue', localId);
}

export async function updateOfflineSaleRetry(
  localId: number,
  retryCount: number,
  lastError: string,
  status: 'pending' | 'failed'
): Promise<void> {
  const db = await getDb();
  const entry = await db.get('offlineSaleQueue', localId) as OfflineSaleEntry | undefined;
  if (entry) {
    await db.put('offlineSaleQueue', { ...entry, retryCount, lastError, status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference Data Cache
// ─────────────────────────────────────────────────────────────────────────────

export type CacheStore = 'cachedItems' | 'cachedCustomers' | 'cachedNarrations' | 'cachedUnits';

export async function saveReferenceCache(store: CacheStore, data: unknown[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([store, 'cacheMetadata'], 'readwrite');
  
  // Clear old data
  await tx.objectStore(store).clear();
  
  // Write new records using index as key
  const objStore = tx.objectStore(store);
  for (let i = 0; i < data.length; i++) {
    await objStore.put(data[i], i);
  }
  
  // Update TTL timestamp
  await tx.objectStore('cacheMetadata').put({
    key: store,
    cachedAt: Date.now(),
  } as CacheMeta);
  
  await tx.done;
}

export async function getReferenceCache<T>(store: CacheStore): Promise<T[]> {
  const db = await getDb();
  return (await db.getAll(store)) as T[];
}

export async function isCacheValid(store: CacheStore): Promise<boolean> {
  const db = await getDb();
  const meta = await db.get('cacheMetadata', store) as CacheMeta | undefined;
  if (!meta) return false;
  return Date.now() - meta.cachedAt < CACHE_TTL_MS;
}
