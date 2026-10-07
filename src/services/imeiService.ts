import api from './api';

export interface ImeiStockResponse {
  imei: string;
  imei2?: string;
  itemId: string;
  itemTitle: string;
  brandTitle?: string;
  modelName?: string;
  storage?: string;
  ram?: string;
  color?: string;
  ptaStatus?: string;
  conditionNote?: string;
  batteryHealth?: number;
  purchaseVNo: string;
  purchaseDate: string;
  purchaseRate: number;
  addedCost: number;
  totalLandedCost: number;
  isInStock: boolean;
  saleVNo?: string;
  saleDate?: string;
  saleRate?: number;
}

export interface ImeiTransactionInfo {
  voucherType: string;
  voucherNo: string;
  date: string;
  accountId: string;
  accountTitle?: string;
  rate: number;
  ptaStatus?: string;
  conditionNote?: string;
  warrantyMonths?: number;
  warrantyExpiryDate?: string;
}

export interface ImeiCostAdditionResponse {
  id: number;
  imei: string;
  date: string;
  expenseType: string;
  description: string;
  amount: number;
  paidFromAccount?: string;
  paidFromTitle?: string;
  consumedItemId?: string;
  consumedItemTitle?: string;
  consumedQty?: number;
  createdOn: string;
}

export interface RepairJobSummaryResponse {
  jobNo: string;
  jobDate: string;
  deviceModel: string;
  faultDescription: string;
  status: string;
  totalAmount: number;
  saleVNo?: string;
}

export interface ImeiHistoryResponse {
  imei: string;
  imei2?: string;
  itemTitle: string;
  brandTitle?: string;
  modelName?: string;
  currentPtaStatus?: string;
  currentCondition?: string;
  isInStock: boolean;
  purchasedIn?: ImeiTransactionInfo;
  soldIn?: ImeiTransactionInfo;
  returnedIn?: ImeiTransactionInfo;
  costAdditions: ImeiCostAdditionResponse[];
  repairJobs: RepairJobSummaryResponse[];
}

export interface ImeiCostAdditionRequest {
  imei: string;
  date: string;
  expenseType: string; // PtaTax, CpidServer, SparePart, Labour
  description: string;
  amount: number;
  paidFromAccount?: string;
  consumedItemId?: string;
  consumedQty?: number;
  newPtaStatus?: string;
  newCondition?: string;
}

export const imeiService = {
  async getImeiStock(): Promise<ImeiStockResponse[]> {
    const response = await api.get('/api/imei/stock');
    return (response.data.body || []) as ImeiStockResponse[];
  },

  async getImeiHistory(imei: string): Promise<ImeiHistoryResponse | null> {
    const response = await api.get(`/api/imei/history/${encodeURIComponent(imei)}`);
    return response.data.body as ImeiHistoryResponse;
  },

  async addImeiCost(data: ImeiCostAdditionRequest): Promise<string> {
    const response = await api.post('/api/imei/cost', data);
    return response.data.body as string;
  }
};
