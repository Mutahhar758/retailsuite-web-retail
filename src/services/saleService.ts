import api from './api';

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

  async create(request: SaleCreateRequest) {
    const response = await api.post('/api/sales', request);
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
  }
};
