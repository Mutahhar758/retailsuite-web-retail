import api from './api';

export interface TrialBalanceLine {
  lvl1: string;
  lvl2: string;
  lvl3: string;
  lvl4: string;
  title: string;
  priBal: number;
  dr: number;
  cr: number;
  curBal: number;
}

export interface BalanceDetailLine {
  account: string;
  balance: number;
}

export interface AccountStatementLine {
  vDate: string;
  vNo: string | null;
  vSeq: number;
  particular: string;
  dr: number;
  cr: number;
}

export interface AccountStatementWithDueLine extends AccountStatementLine {
  dueDays: number | null;
}

export interface StockBalanceLine {
  item: string;
  unit: string;
  priQty: number;
  qty: number;
  qtyIn: number;
  qtyOut: number;
  qtyBal: number;
  rate: number;
}

export interface StockLedgerLine {
  vdate: string;
  vno: string | null;
  particular: string;
  qtyIn: number;
  qtyOut: number;
  rate: number | null;
}

export interface BalanceSheetLine {
  lvl1: string;
  lvl2: string;
  lvl3: string;
  lvl4: string;
  title: string;
  priBal: number;
  drCr: number;
  curBal: number;
}

export interface IncomeSummaryLine {
  vType: string;
  title: string;
  dr: number;
  cr: number;
  bal: number;
}

export interface CustomerBillLine {
  date: string;
  vNo: string;
  item: string;
  unitTitle: string;
  qty: number;
  rate: number;
  addLess: number;
  amount: number;
}

export interface CustomerBillResponse {
  lines: CustomerBillLine[];
  summary: {
    previousBalance: number;
    payment: number;
    balance: number;
  };
}

export const reportService = {
  async getTrialBalance(params: { fromDate: string; toDate: string }) {
    const response = await api.get('/api/reports/trial-balance', { params });
    return response.data.body as TrialBalanceLine[];
  },

  async getBalanceDetail(params: { toDate: string; account: string }) {
    const response = await api.get('/api/reports/balance-detail', { params });
    return response.data.body as BalanceDetailLine[];
  },

  async getAccountStatement(params: { fromDate: string; toDate: string; account: string }) {
    const response = await api.get('/api/reports/account-statement', { params });
    return response.data.body as AccountStatementLine[];
  },

  async getAccountStatementWithDue(params: { fromDate: string; toDate: string; account: string }) {
    const response = await api.get('/api/reports/account-statement-with-due', { params });
    return response.data.body as AccountStatementWithDueLine[];
  },

  async getStockBalance(params: { fromDate: string; toDate: string; catagory?: string }) {
    const response = await api.get('/api/reports/stock-balance', { params });
    return response.data.body as StockBalanceLine[];
  },

  async getStockLedger(params: { fromDate: string; toDate: string; fkItem: string }) {
    const response = await api.get('/api/reports/stock-ledger', { params });
    return response.data.body as StockLedgerLine[];
  },

  async getBalanceSheet(params: { toDate: string }) {
    const response = await api.get('/api/reports/balance-sheet', { params });
    return response.data.body as BalanceSheetLine[];
  },

  async getIncomeSummary(params: { fromDate: string; toDate: string }) {
    const response = await api.get('/api/reports/income-summary', { params });
    return response.data.body as IncomeSummaryLine[];
  },

  async getCustomerBill(params: { fromDate: string; toDate: string; account: string }) {
    const response = await api.get('/api/reports/customer-bill', { params });
    return response.data.body as CustomerBillResponse;
  },
};
