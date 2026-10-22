import api from './api';

export interface ReceiptDto {
  date: string;
  clearingDate?: string;
  voucherNo: string;
  amount: number;
  narration: string;
  narrationId?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface ReceiptLineDto {
  seq: number;
  date: string;
  clearingDate?: string;
  voucherNo: string;
  cashBankAccountId: string;
  accountId: string;
  amount: number;
  narration: string;
  narrationId?: string;
  checkNum?: string;
  checkDate?: string;
  remarks?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface ReceiptLineRequest {
  seq: number;
  account: string;
  amount: number;
  checkNum?: string;
  checkDate?: string;
  remarks?: string;
}

export interface ReceiptCreateRequest {
  date: string;
  clearingDate?: string;
  cashBankAccount: string;
  narration?: string;
  lines: ReceiptLineRequest[];
}

export interface ReceiptUpdateRequest {
  date: string;
  clearingDate?: string;
  cashBankAccount: string;
  narration?: string;
  lines: ReceiptLineRequest[];
}

export interface ReceiptListParams {
  fromDate?: string;
  toDate?: string;
  cashBankAccount?: string;
  account?: string;
  narration?: string;
  voucherNo?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PaginatedReceipts {
  data: ReceiptDto[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export const receiptService = {
  async getList(params?: ReceiptListParams) {
    const response = await api.get('/api/receipts/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as ReceiptDto[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      pageSize: (body?.metadata?.pageSize ?? params?.pageSize ?? 20) as number,
    } as PaginatedReceipts;
  },

  async getDetail(voucherNo: string, cashBankAccount?: string) {
    const response = await api.get(`/api/receipts/${voucherNo}`, {
      params: { cashBankAccount },
    });
    return response.data.body as ReceiptLineDto[];
  },

  async getAccountBalance(accountId: string) {
    // Assuming same balance endpoint pattern or similar
    const response = await api.get(`/api/receipts/accounts/${accountId}/balance`);
    return response.data.body.balance as number;
  },

  async create(request: ReceiptCreateRequest) {
    const response = await api.post('/api/receipts', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: ReceiptUpdateRequest) {
    await api.put(`/api/receipts/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/receipts/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/receipts/${voucherNo}/lines/${seq}`);
  },
};
