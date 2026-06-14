import api from './api';
// Force reload


export interface ChartOfAccountHeadDto {
  account: string;
  title: string;
}

export interface ChartOfAccountDto {
  account: string;
  title: string;
  parentId: string;
  accType: string;
  accLevel: number;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export const chartOfAccountService = {
  async getHeads(level: number) {
    const response = await api.get(`/api/chartofaccounts/heads?level=${level}`);
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async getActiveAccounts() {
    const response = await api.get('/api/chartofaccounts');
    return response.data.body as ChartOfAccountDto[];
  },

  async getDetailAccounts() {
    const response = await api.get('/api/chartofaccounts/detail');
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async getCashBankAccounts() {
    const response = await api.get('/api/chartofaccounts/cashbanks');
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async getSupplierAccounts() {
    const response = await api.get('/api/chartofaccounts/suppliers');
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async getCustomerAccounts() {
    const response = await api.get('/api/chartofaccounts/customers');
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async create(data: { title: string; parentId: string }) {
    const response = await api.post('/api/chartofaccounts', data);
    return response.data.body as string;
  },

  async update(account: string, data: { title: string }) {
    const response = await api.put(`/api/chartofaccounts/${account}`, data);
    return response.data.body as string;
  },

  async delete(account: string) {
    const response = await api.delete(`/api/chartofaccounts/${account}`);
    return response.data.body as string;
  },
};
