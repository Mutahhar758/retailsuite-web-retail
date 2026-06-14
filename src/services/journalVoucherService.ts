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

export const journalVoucherService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    account?: string;
    narration?: string;
  }) {
    const response = await api.get('/api/journalvouchers', { params });
    return response.data.body as JournalVoucherDto[];
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
