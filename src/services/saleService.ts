import dayjs from 'dayjs';
import api from './api';
import {
  getNextOfflineVoucherNo,
  getOrCreateDeviceId,
  getOrCreateMachineId,
  saveAssignedTerminalCode,
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

export interface CustomerItemSaleRecord {
  voucherNo: string;
  vType?: string;
  date: string;
  qty: number;
  rate: number;
  discount?: number;
  secQty?: number;
  secRate?: number;
  amount: number;
}

export interface CustomerItemPriceHistoryResponse {
  hasHistory: boolean;
  lastSaleDate?: string;
  lastRate?: number;
  lastQty?: number;
  lastDiscount?: number;
  lastSecRate?: number;
  lastVoucherNo?: string;
  lastVType?: string;
  recentSales: CustomerItemSaleRecord[];
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
  carriage?: number;
  imei?: string;
  imei2?: string;
  ptaStatus?: string;
  warrantyMonths?: number;
  batteryHealth?: number;
  conditionNote?: string;
  amount: number;
  cashReceipt: number;
  cashBack: number;
  secQty?: number;
  secRate?: number;
  secUnit?: string | null;
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
  carriage?: number;
  imei?: string;
  imei2?: string;
  ptaStatus?: string;
  warrantyMonths?: number;
  batteryHealth?: number;
  conditionNote?: string;
  secQty?: number;
  secRate?: number;
  secUnit?: string | null;
}

export interface SaleCreateRequest {
  date: string;
  account: string;
  narration?: string;
  description?: string;
  cashReceipt: number;
  cashBack: number;
  lines: SaleLineRequest[];
  payments?: {
    seq: number;
    accountId: string;
    amount: number;
    reference?: string;
    checkNum?: string;
    checkDate?: string;
  }[];
  offlineVoucherNo?: string;
  counter?: string;
}

export interface SaleUpdateRequest {
  date: string;
  account: string;
  narration?: string;
  description?: string;
  cashReceipt: number;
  cashBack: number;
  lines: SaleLineRequest[];
  payments?: {
    seq: number;
    accountId: string;
    amount: number;
    reference?: string;
    checkNum?: string;
    checkDate?: string;
  }[];
}

export interface SaleListParams {
  fromDate?: string;
  toDate?: string;
  account?: string;
  voucherNo?: string;
  searchTerm?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PaginatedSales {
  data: Sale[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export const saleService = {
  async getList(params?: SaleListParams) {
    const response = await api.get('/api/sales/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as Sale[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      pageSize: (body?.metadata?.pageSize ?? params?.pageSize ?? 20) as number,
    } as PaginatedSales;
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/sales/${voucherNo}`);
    return response.data.body as SaleLine[];
  },

  async getCustomerItemHistory(accountId: string, itemId: string): Promise<CustomerItemPriceHistoryResponse> {
    const response = await api.get('/api/sales/customer-history', {
      params: { accountId, itemId }
    });
    return response.data.body as CustomerItemPriceHistoryResponse;
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
    const isExplicitOfflineMode = useOfflineStore.getState().isOfflineMode;
    if (navigator.onLine && !isExplicitOfflineMode) {
      try {
        const response = await api.post('/api/sales', request);
        return response.data.body as string;
      } catch (err: any) {
        const isNetworkFailure = !err?.response || err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED';
        if (!isNetworkFailure || !options.offlineFallback) {
          throw err;
        }
      }
    }

    if (!options.offlineFallback) {
      throw new Error('No internet connection. Please connect and try again.');
    }

    // Queue offline
    const { currentTenantIdentifier } = useAppStore.getState();
    const tempVoucherNo = await getNextOfflineVoucherNo(currentTenantIdentifier);
    const deviceId = tempVoucherNo.split('-')[0];
    const localSeq = parseInt(tempVoucherNo.split('-')[1], 10);

    const localId = await enqueueOfflineSale({
      deviceId,
      localSeq,
      tempVoucherNo,
      request,
      tenantIdentifier: currentTenantIdentifier || '',
      createdAt: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
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

  async getPayments(voucherNo: string) {
    const response = await api.get(`/api/sales/${voucherNo}/payments`);
    return (response.data.body || []) as {
      seq: number;
      accountId: string;
      accountTitle?: string;
      amount: number;
      reference?: string;
      checkNum?: string;
      checkDate?: string;
    }[];
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

  /** Registers this browser terminal with /api/terminals/register to receive a guaranteed-unique T01/T02... ID. */
  async registerTerminal(tenantIdentifier?: string | null): Promise<string> {
    if (!navigator.onLine) {
      return getOrCreateDeviceId(tenantIdentifier);
    }
    try {
      const machineId = await getOrCreateMachineId();
      const response = await api.post('/api/terminals/register', {
        machineId,
        machineName: `Web POS (${navigator.platform || 'Browser'})`,
      });
      const assigned = response.data?.body?.terminalCode as string | undefined;
      if (assigned) {
        await saveAssignedTerminalCode(assigned, tenantIdentifier);
        useOfflineStore.getState().setDeviceId(assigned);
        return assigned;
      }
    } catch {
      // Fall back to existing local ID if offline or unauthenticated
    }
    return getOrCreateDeviceId(tenantIdentifier);
  },
};
