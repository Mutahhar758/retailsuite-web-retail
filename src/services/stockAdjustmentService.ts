import api from './api';

export interface StockAdjustmentMaster {
  voucherNo: string;
  date: string;
  narration: string;
  narrationId?: string;
  description: string;
  totalQty: number;
  totalAmount: number;
}

export interface StockAdjustmentLine {
  voucherNo: string;
  seq: number;
  itemId: string;
  itemCategoryCode: string;
  unit: string;
  qtyIn: number;
  qtyOut: number;
  rate: number;
  amount: number;
  narration?: string;
  narrationId?: string;
  date?: string;
  description?: string;
}

export interface StockAdjustmentLineRequest {
  seq?: number;
  itemId: string;
  itemCategoryCode: string;
  unit: string;
  qtyIn: number;
  qtyOut: number;
  rate: number;
}

export interface StockAdjustmentRequest {
  date: string;
  narration?: string;
  description?: string;
  lines: StockAdjustmentLineRequest[];
}

export const stockAdjustmentService = {
  async getList(startDate?: string, endDate?: string, voucherNo?: string) {
    const response = await api.get('/api/StockAdjustments', {
      params: { startDate, endDate, voucherNo }
    });
    return response.data.body as StockAdjustmentMaster[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/StockAdjustments/${voucherNo}`);
    return response.data.body as StockAdjustmentLine[];
  },

  async create(request: StockAdjustmentRequest) {
    const response = await api.post('/api/StockAdjustments', request);
    return response.data.body; // returns voucherNo
  },

  async update(voucherNo: string, request: StockAdjustmentRequest) {
    const response = await api.put(`/api/StockAdjustments/${voucherNo}`, request);
    return response.data.body;
  },

  async delete(voucherNo: string) {
    const response = await api.delete(`/api/StockAdjustments/${voucherNo}`);
    return response.data.body;
  },

  async deleteLine(voucherNo: string, seq: number) {
    const response = await api.delete(`/api/StockAdjustments/${voucherNo}/lines/${seq}`);
    return response.data.body;
  }
};
