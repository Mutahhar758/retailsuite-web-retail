import api from './api';

export interface JournalVoucherDto {
  date: string;
  voucherNo: string;
  amount: number;
  narration: string;
  narrationId?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface JournalVoucherLineDto {
  seq: number;
  date: string;
  voucherNo: string;
  drAccountId: string;
  crAccountId: string;
  amount: number;
  narration: string;
  narrationId?: string;
  remarks?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface JournalVoucherLineRequest {
  seq: number;
  drAccount: string;
  crAccount: string;
  amount: number;
  remarks?: string;
}

export interface JournalVoucherCreateRequest {
  date: string;
  narration?: string;
  lines: JournalVoucherLineRequest[];
}

export interface JournalVoucherUpdateRequest {
  date: string;
  narration?: string;
  lines: JournalVoucherLineRequest[];
}

export interface JournalVoucherListParams {
  fromDate?: string;
  toDate?: string;
  account?: string;
  narration?: string;
  voucherNo?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PaginatedJournalVouchers {
  data: JournalVoucherDto[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export const journalVoucherService = {
  async getList(params?: JournalVoucherListParams) {
    const response = await api.get('/api/journalvouchers/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as JournalVoucherDto[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      pageSize: (body?.metadata?.pageSize ?? params?.pageSize ?? 20) as number,
    } as PaginatedJournalVouchers;
  },

  async getDetail(voucherNo: string, account?: string) {
    const response = await api.get(`/api/journalvouchers/${voucherNo}`, {
      params: { account },
    });
    return response.data.body as JournalVoucherLineDto[];
  },

  async getAccountBalance(accountId: string) {
    const response = await api.get(`/api/journalvouchers/accounts/${accountId}/balance`);
    return response.data.body.balance as number;
  },

  async create(request: JournalVoucherCreateRequest) {
    const response = await api.post('/api/journalvouchers', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: JournalVoucherUpdateRequest) {
    await api.put(`/api/journalvouchers/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/journalvouchers/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/journalvouchers/${voucherNo}/lines/${seq}`);
  },
};
