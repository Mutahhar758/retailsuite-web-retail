import api from './api';

export interface SaleReturn {
  date: string;
  voucherNo: string;
  account: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface SaleReturnLine {
  seq: number;
  date: string;
  voucherNo: string;
  accountId: string;
  narration?: string;
  narrationId?: string;
  description?: string;
  itemId: string;
  unit?: string | null;
  qty: number;
  rate: number;
  discount: number;
  amount: number;
  createdBy: string;
  createdOn: string;
}

export interface SaleReturnLineRequest {
  seq: number;
  itemId: string;
  unit: string | null;
  qty: number;
  rate: number;
  discount: number;
}

export interface SaleReturnCreateRequest {
  date: string;
  account: string;
  narration?: string;
  description?: string;
  lines: SaleReturnLineRequest[];
}

export const saleReturnService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    account?: string;
    voucherNo?: string;
    searchTerm?: string;
  }) {
    const response = await api.get('/api/SaleReturns', { params });
    return response.data.body as SaleReturn[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/SaleReturns/${voucherNo}`);
    return response.data.body as SaleReturnLine[];
  },

  async create(request: SaleReturnCreateRequest) {
    const response = await api.post('/api/SaleReturns', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: SaleReturnCreateRequest) {
    await api.put(`/api/SaleReturns/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/SaleReturns/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/SaleReturns/${voucherNo}/lines/${seq}`);
  }
};
