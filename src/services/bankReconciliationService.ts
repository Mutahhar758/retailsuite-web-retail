import api from './api';

export interface BankReconciliationLine {
  voucherNo: string;
  date: string;
  checkDate?: string;
  checkNum?: string;
  reconcileDate?: string;
  title: string;
  dr: number;
  cr: number;
  clear: boolean;
  vSeq: number;
}

export interface BankReconciliationSnapshot {
  lines: BankReconciliationLine[];
  reconcileBalance: number;
  statementBalance: number;
}

export interface BankReconciliationFilter {
  bankAccount: string;
  fromDate: string;
  toDate: string;
}

export interface BankReconciliationLineSaveRequest {
  voucherNo: string;
  vSeq: number;
  clear: boolean;
  reconcileDate?: string;
}

export interface BankReconciliationSaveRequest {
  lines: BankReconciliationLineSaveRequest[];
}

export const bankReconciliationService = {
  async getSnapshot(filter: BankReconciliationFilter) {
    const response = await api.get('/api/BankReconciliations', {
      params: filter
    });
    return response.data.body as BankReconciliationSnapshot;
  },

  async save(request: BankReconciliationSaveRequest) {
    const response = await api.put('/api/BankReconciliations', request);
    return response.data.body;
  }
};
