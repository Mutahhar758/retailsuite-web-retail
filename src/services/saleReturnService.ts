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
  imei?: string;
  imei2?: string;
  secQty?: number;
  secRate?: number;
  secUnit?: string | null;
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
  imei?: string;
  imei2?: string;
  secQty?: number;
  secRate?: number;
  secUnit?: string | null;
}

export interface SaleReturnCreateRequest {
  date: string;
  account: string;
  narration?: string;
  description?: string;
  lines: SaleReturnLineRequest[];
}

export interface SaleReturnListParams {
  fromDate?: string;
  toDate?: string;
  account?: string;
  voucherNo?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PaginatedSaleReturns {
  data: SaleReturn[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export const saleReturnService = {
  async getList(params?: SaleReturnListParams) {
    const response = await api.get('/api/SaleReturns/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as SaleReturn[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      pageSize: (body?.metadata?.pageSize ?? params?.pageSize ?? 20) as number,
    } as PaginatedSaleReturns;
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
