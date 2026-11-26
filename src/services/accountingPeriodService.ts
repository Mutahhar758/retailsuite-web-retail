import api from './api';

export interface PeriodLockStatusResponse {
  lockDate: string | null;
  lastClosedPeriodId: number | null;
  lastClosedPeriodName: string | null;
  nextOpenDate: string | null;
  defaultTargetEquityAccountId: string;
  defaultTargetEquityAccountTitle: string;
}

export interface ClosingVoucherLineDto {
  seq: number;
  drAccountId: string;
  drAccountTitle: string;
  crAccountId: string;
  crAccountTitle: string;
  amount: number;
  remarks: string;
}

export interface AccountingPeriodCloseResponse {
  id: number;
  periodName: string;
  periodStartDate: string;
  closingDate: string;
  status: 'Closed' | 'Reopened' | string;
  closingVoucherNo: string;
  targetEquityAccountId: string;
  targetEquityAccountTitle: string;
  closedDrawings: boolean;
  openingStockValue: number;
  closingStockValue: number;
  totalIncome: number;
  totalCogs: number;
  totalExpenses: number;
  netProfitLoss: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
  canReopen: boolean;
  notes?: string | null;
  closedBy?: string | null;
  closedOn: string;
  reopenedBy?: string | null;
  reopenedOn?: string | null;
  reopenReason?: string | null;
}

export interface AccountingPeriodCloseDetailResponse extends AccountingPeriodCloseResponse {
  closingEntries: ClosingVoucherLineDto[];
}

export interface PeriodClosePreviewRequest {
  closingDate: string;
  targetEquityAccountId?: string | null;
  closeDrawings: boolean;
}

export interface PeriodClosePreviewResponse {
  periodStartDate: string;
  closingDate: string;
  targetEquityAccountId: string;
  targetEquityAccountTitle: string;
  closeDrawings: boolean;
  openingStockValue: number;
  closingStockValue: number;
  currentGlInventoryBalance: number;
  inventoryAdjustment: number;
  totalIncome: number;
  totalPurchases: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfitLoss: number;
  totalDrawingsClosed: number;
  postCloseTotalAssets: number;
  postCloseTotalLiabilities: number;
  postCloseTotalEquity: number;
  balanceSheetDifference: number;
  isBalanced: boolean;
  canClose: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  proposedEntries: ClosingVoucherLineDto[];
}

export interface PeriodCloseExecuteRequest {
  periodName: string;
  closingDate: string;
  targetEquityAccountId?: string | null;
  closeDrawings: boolean;
  notes?: string | null;
}

export const accountingPeriodService = {
  async getLockStatus(): Promise<PeriodLockStatusResponse> {
    const response = await api.get('/api/v1/accounting-periods/lock-status');
    return response.data.body as PeriodLockStatusResponse;
  },

  async getHistory(): Promise<AccountingPeriodCloseResponse[]> {
    const response = await api.get('/api/v1/accounting-periods');
    return response.data.body as AccountingPeriodCloseResponse[];
  },

  async getDetail(id: number): Promise<AccountingPeriodCloseDetailResponse> {
    const response = await api.get(`/api/v1/accounting-periods/${id}`);
    return response.data.body as AccountingPeriodCloseDetailResponse;
  },

  async previewClose(request: PeriodClosePreviewRequest): Promise<PeriodClosePreviewResponse> {
    const response = await api.post('/api/v1/accounting-periods/preview', request);
    return response.data.body as PeriodClosePreviewResponse;
  },

  async executeClose(request: PeriodCloseExecuteRequest): Promise<AccountingPeriodCloseResponse> {
    const response = await api.post('/api/v1/accounting-periods/close', request);
    return response.data.body as AccountingPeriodCloseResponse;
  },

  async reopenLatest(id: number, reason: string): Promise<AccountingPeriodCloseResponse> {
    const response = await api.post(`/api/v1/accounting-periods/${id}/reopen`, { reason });
    return response.data.body as AccountingPeriodCloseResponse;
  },
};
