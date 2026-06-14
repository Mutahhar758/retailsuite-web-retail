import api from './api';

export interface PurchaseReturn {
  date: string;
  voucherNo: string;
  account: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface PurchaseReturnLine {
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

export interface PurchaseReturnCreateRequest {
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

export const purchaseReturnService = {
  async getList(params: { fromDate?: string; toDate?: string; searchTerm?: string }) {
    const response = await api.get('/api/PurchaseReturns', { params });
    return response.data.body as PurchaseReturn[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/PurchaseReturns/${voucherNo}`);
    return response.data.body as PurchaseReturnLine[];
  },

  async create(data: PurchaseReturnCreateRequest) {
    const response = await api.post('/api/PurchaseReturns', data);
    return response.data.body as string;
  },

  async update(voucherNo: string, data: PurchaseReturnCreateRequest) {
    const response = await api.put(`/api/PurchaseReturns/${voucherNo}`, data);
    return response.data;
  },

  async delete(voucherNo: string) {
    const response = await api.delete(`/api/PurchaseReturns/${voucherNo}`);
    return response.data;
  },

  async deleteLine(voucherNo: string, seq: number) {
    const response = await api.delete(`/api/PurchaseReturns/${voucherNo}/lines/${seq}`);
    return response.data;
  }
};
