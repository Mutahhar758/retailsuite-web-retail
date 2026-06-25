import api from './api';
import {
  getNextOfflineVoucherNo,
  enqueueOfflineSale,
  getOfflineSaleQueue,
  type OfflineSaleEntry,
} from './offlineDb';
import { useOfflineStore } from '../stores/useOfflineStore';
import { useAppStore } from '../stores/useAppStore';

export type { OfflineSaleEntry };

export interface Sale {
  date: string;
  voucherNo: string;
  account: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface SaleLine {
  seq: number;
  date: string;
  voucherNo: string;
  accountId: string;
  narration?: string;
  narrationId?: string;
  description?: string;
  itemId: string;
  itemKey?: string;
  itemCategoryCode: string;
  unit?: string | null;
  qty: number;
  rate: number;
  discount: number;
  amount: number;
  cashReceipt: number;
  cashBack: number;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface SaleLineRequest {
  seq: number;
  itemId: string;
  unit: string | null;
  qty: number;
  rate: number;
  discount: number;
}

export interface SaleCreateRequest {
  date: string;
  account: string;
  narration?: string;
  description?: string;
  cashReceipt: number;
  cashBack: number;
  lines: SaleLineRequest[];
}

export interface SaleUpdateRequest {
  date: string;
  account: string;
  narration?: string;
  description?: string;
  cashReceipt: number;
  cashBack: number;
  lines: SaleLineRequest[];
}

export const saleService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    account?: string;
    voucherNo?: string;
    searchTerm?: string;
  }) {
    const response = await api.get('/api/sales', { params });
    return response.data.body as Sale[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/sales/${voucherNo}`);
    return response.data.body as SaleLine[];
  },

  /**
   * Create a sale voucher.
   * - Online  → calls server API, returns real voucher number (e.g. '00123').
   * - Offline + offlineFallback=true → queues in IndexedDB, returns temp ID (e.g. 'A3F1-0007').
   */
  async create(
    request: SaleCreateRequest,
    options: { offlineFallback?: boolean } = {}
  ): Promise<string> {
    if (navigator.onLine) {
      const response = await api.post('/api/sales', request);
      return response.data.body as string;
    }

    if (!options.offlineFallback) {
      throw new Error('No internet connection. Please connect and try again.');
    }

    // Queue offline
    const tempVoucherNo = await getNextOfflineVoucherNo();
    const deviceId = tempVoucherNo.split('-')[0];
    const localSeq = parseInt(tempVoucherNo.split('-')[1], 10);
    const { currentTenantIdentifier } = useAppStore.getState();

    const localId = await enqueueOfflineSale({
      deviceId,
      localSeq,
      tempVoucherNo,
      request,
      tenantIdentifier: currentTenantIdentifier || '',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    });

    // Update pending count in store
    const count = await this.getOfflinePendingCount(currentTenantIdentifier);
    useOfflineStore.getState().setPendingCount(count);

    console.info(`[OfflineSale] Queued as ${tempVoucherNo} (localId: ${localId})`);
    return tempVoucherNo;
  },

  /**
   * Direct server call — used by offlineSyncService only.
   * Never falls back to offline queue.
   */
  async createOnline(request: SaleCreateRequest, tenantIdentifier?: string): Promise<string> {
    const headers = tenantIdentifier ? { 'X-Tenant-ID': tenantIdentifier } : undefined;
    const response = await api.post('/api/sales', request, { headers });
    return response.data.body as string;
  },

  async update(voucherNo: string, request: SaleUpdateRequest) {
    await api.put(`/api/sales/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/sales/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/sales/${voucherNo}/lines/${seq}`);
  },

  /** Returns entries in the offline sale queue matching the current tenant. */
  async getOfflineQueue(tenantIdentifier?: string | null): Promise<OfflineSaleEntry[]> {
    const all = await getOfflineSaleQueue();
    if (!tenantIdentifier) return all;
    return all.filter(e => e.tenantIdentifier === tenantIdentifier);
  },

  /** Returns the number of pending (not-yet-synced) entries for the current tenant. */
  async getOfflinePendingCount(tenantIdentifier?: string | null): Promise<number> {
    const queue = await getOfflineSaleQueue();
    return queue.filter(
      (e) => e.status === 'pending' && (!tenantIdentifier || e.tenantIdentifier === tenantIdentifier)
    ).length;
  },
};
