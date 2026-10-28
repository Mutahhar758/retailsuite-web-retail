import api from './api';

export interface PurchaseLine {
  seq: number;
  itemId: string;
  unit: string | null;
  qty: number;
  rate: number;
  addLess: number;
  imei?: string;
  imei2?: string;
  ptaStatus?: string;
  batteryHealth?: number;
  conditionNote?: string;
  amount: number;
  secQty?: number;
  secRate?: number;
  secUnit?: string | null;
  itemTitle?: string;
  narration?: string;
  narrationId?: string;
  date?: string;
  accountId?: string;
  description?: string;
  cashPaid?: number;
  cashBack?: number;
  sellerCnic?: string;
  sellerContact?: string;
}

export interface Purchase {
  date: string;
  voucherNo: string;
  account: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface PurchaseCreateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  cashPaid?: number;
  cashBack?: number;
  sellerCnic?: string;
  sellerContact?: string;
  lines: {
    seq: number;
    itemId: string;
    unit: string | null;
    qty: number;
    rate: number;
    addLess: number;
    imei?: string;
    imei2?: string;
    ptaStatus?: string;
    batteryHealth?: number;
    conditionNote?: string;
    secQty?: number;
    secRate?: number;
    secUnit?: string | null;
  }[];
}

export interface PurchaseListParams {
  fromDate?: string;
  toDate?: string;
  account?: string;
  voucherNo?: string;
  searchTerm?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PaginatedPurchases {
  data: Purchase[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export const purchaseService = {
  async getList(params?: PurchaseListParams) {
    const response = await api.get('/api/purchases/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as Purchase[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      pageSize: (body?.metadata?.pageSize ?? params?.pageSize ?? 20) as number,
    } as PaginatedPurchases;
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/purchases/${voucherNo}`);
    return response.data.body as PurchaseLine[];
  },

  async create(data: PurchaseCreateRequest): Promise<string> {
    const response = await api.post('/api/purchases', data);
    return (response.data?.body ?? response.data) as string;
  },

  async update(voucherNo: string, data: PurchaseCreateRequest) {
    const response = await api.put(`/api/purchases/${voucherNo}`, data);
    return response.data;
  },

  async delete(voucherNo: string) {
    const response = await api.delete(`/api/purchases/${voucherNo}`);
    return response.data;
  },

  async deleteLine(voucherNo: string, seq: number) {
    const response = await api.delete(`/api/purchases/${voucherNo}/lines/${seq}`);
    return response.data;
  }
};
