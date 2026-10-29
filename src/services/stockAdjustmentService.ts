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
  secQtyIn?: number;
  secQtyOut?: number;
  secRate?: number;
  secUnit?: string | null;
  imei?: string;
  imei2?: string;
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
  secQtyIn?: number;
  secQtyOut?: number;
  secRate?: number;
  secUnit?: string | null;
  imei?: string | null;
  imei2?: string | null;
}

export interface StockAdjustmentRequest {
  date: string;
  narration?: string;
  description?: string;
  lines: StockAdjustmentLineRequest[];
}

export interface StockAdjustmentListParams {
  fromDate?: string;
  toDate?: string;
  startDate?: string;
  endDate?: string;
  voucherNo?: string;
  itemCategoryCode?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PaginatedStockAdjustments {
  data: StockAdjustmentMaster[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export const stockAdjustmentService = {
  async getList(params?: StockAdjustmentListParams | string, endDate?: string, voucherNo?: string) {
    let queryParams: any = {};
    if (typeof params === 'object' && params !== null) {
      queryParams = {
        fromDate: params.fromDate || params.startDate,
        toDate: params.toDate || params.endDate,
        voucherNo: params.voucherNo,
        itemCategoryCode: params.itemCategoryCode,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
      };
    } else {
      queryParams = {
        fromDate: params,
        toDate: endDate,
        voucherNo,
      };
    }

    const response = await api.get('/api/StockAdjustments/paged', { params: queryParams });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as StockAdjustmentMaster[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      pageSize: (body?.metadata?.pageSize ?? 20) as number,
    } as PaginatedStockAdjustments;
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
