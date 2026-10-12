import api from './api';

export interface RecurringChainDto {
  id: number;
  name: string;
  voucherType: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  isActive: boolean;
  lastRunDate?: string;
  lastVoucherNo?: string;
  notes?: string;
  createdOn: string;
}

export interface RecurringChainCreateRequest {
  name: string;
  voucherType: string;
  sourceVoucherNo: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  notes?: string;
}

export interface RecurringChainUpdateRequest {
  name: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  isActive: boolean;
  notes?: string;
}

export const recurringChainService = {
  async getList() {
    const response = await api.get('/api/recurringchains');
    return (response.data?.body || response.data) as RecurringChainDto[];
  },

  async getById(id: number) {
    const response = await api.get(`/api/recurringchains/${id}`);
    return (response.data?.body || response.data) as RecurringChainDto;
  },

  async createFromVoucher(request: RecurringChainCreateRequest) {
    const response = await api.post('/api/recurringchains', request);
    return (response.data?.body || response.data) as string;
  },

  async update(id: number, request: RecurringChainUpdateRequest) {
    await api.put(`/api/recurringchains/${id}`, request);
  },

  async toggleActive(id: number, isActive: boolean) {
    await api.put(`/api/recurringchains/${id}/toggle`, null, {
      params: { isActive },
    });
  },

  async delete(id: number) {
    await api.delete(`/api/recurringchains/${id}`);
  },

  async runToday(id: number, targetDate?: string) {
    const response = await api.post(`/api/recurringchains/${id}/run`, null, {
      params: { targetDate },
    });
    return (response.data?.body || response.data) as string;
  },
};
