import api from './api';

export interface BankAccountResponse {
  account: string;
  bankName?: string;
  accountTitle: string;
  accountNumber?: string;
  iban?: string;
  branchName?: string;
  branchCode?: string;
  swiftCode?: string;
  currency?: string;
  notes?: string;
  active: boolean;
  openingBalance?: number;
  createdBy?: string;
  createdOn?: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface BankAccountCreateRequest {
  bankName: string;
  accountTitle: string;
  accountNumber?: string;
  iban?: string;
  branchName?: string;
  branchCode?: string;
  swiftCode?: string;
  currency?: string;
  notes?: string;
  active: boolean;
  openingBalance?: number;
}

export interface BankAccountUpdateRequest {
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
  branchName?: string;
  branchCode?: string;
  swiftCode?: string;
  currency?: string;
  notes?: string;
  active?: boolean;
  openingBalance?: number;
}

export const bankAccountService = {
  async getBankAccounts() {
    const response = await api.get('/api/bankaccounts');
    return (response.data.body || []) as BankAccountResponse[];
  },

  async getBankAccount(account: string) {
    const response = await api.get(`/api/bankaccounts/${encodeURIComponent(account)}`);
    return response.data.body as BankAccountResponse;
  },

  async create(data: BankAccountCreateRequest) {
    const response = await api.post('/api/bankaccounts', data);
    return response.data.body as string;
  },

  async update(account: string, data: BankAccountUpdateRequest) {
    const response = await api.put(`/api/bankaccounts/${encodeURIComponent(account)}`, data);
    return response.data.body as string;
  },

  async delete(account: string) {
    const response = await api.delete(`/api/bankaccounts/${encodeURIComponent(account)}`);
    return response.data.body as string;
  },
};
