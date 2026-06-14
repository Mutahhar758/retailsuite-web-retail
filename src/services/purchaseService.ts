import api from './api';

export interface PurchaseLine {
  seq: number;
  itemId: string;
  unit: string | null;
  qty: number;
  rate: number;
  addLess: number;
  amount: number;
  itemTitle?: string;
  narration?: string;
  narrationId?: string;
  date?: string;
  accountId?: string;
  description?: string;
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
  lines: {
    seq: number;
    itemId: string;
    unit: string | null;
    qty: number;
    rate: number;
    addLess: number;
  }[];
}

export const purchaseService = {
  async getList(params: { fromDate?: string; toDate?: string; searchTerm?: string }) {
    const response = await api.get('/api/purchases', { params });
    return response.data.body as Purchase[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/purchases/${voucherNo}`);
    return response.data.body as PurchaseLine[];
  },

  async create(data: PurchaseCreateRequest) {
    const response = await api.post('/api/purchases', data);
    return response.data;
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
