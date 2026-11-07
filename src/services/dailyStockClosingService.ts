import api from './api';

export interface DailyStockClosingListItem {
  closingKey: string;
  date: string;
  purchaseVoucherNo?: string | null;
  purchaseAmount: number;
  saleVoucherNo?: string | null;
  saleAmount: number;
  remarks?: string | null;
  createdBy?: string | null;
  createdOn: string;
}

export interface DailyStockClosingItemLine {
  itemId: string;
  itemKey?: string | null;
  barcode?: string | null;
  title: string;
  categoryCode: string;
  categoryTitle?: string | null;
  unitId?: string | null;
  unitTitle?: string | null;
  openingQty: number;
  closingQty: number;
  purchasedQty: number;
  soldQty: number;
  purchaseRate: number;
  saleRate: number;
}

export interface DailyStockClosingSheet {
  date: string;
  isExisting: boolean;
  purchaseVoucherNo?: string | null;
  saleVoucherNo?: string | null;
  customerAccountId?: string | null;
  vendorAccountId?: string | null;
  cashAccountId?: string | null;
  reconciliationMode: 'DiscountAddLess' | 'ProRate';
  enteredSaleAmount?: number | null;
  enteredPurchaseAmount?: number | null;
  remarks?: string | null;
  items: DailyStockClosingItemLine[];
}

export interface DailyStockClosingSaveRequest {
  date: string;
  customerAccountId: string;
  vendorAccountId: string;
  cashAccountId?: string | null;
  reconciliationMode: 'DiscountAddLess' | 'ProRate';
  enteredSaleAmount?: number | null;
  enteredPurchaseAmount?: number | null;
  remarks?: string | null;
  lines: {
    itemId: string;
    openingQty: number;
    closingQty: number;
    purchasedQty: number;
    soldQty: number;
    purchaseRate: number;
    saleRate: number;
  }[];
}

export interface DailyStockClosingSaveResponse {
  date: string;
  purchaseVoucherNo?: string | null;
  saleVoucherNo?: string | null;
  totalPurchaseAmount: number;
  totalSaleAmount: number;
  cashReceived: number;
  cashPaid: number;
}

export const dailyStockClosingService = {
  async getList(params?: { fromDate?: string; toDate?: string }): Promise<DailyStockClosingListItem[]> {
    const response = await api.get('/api/daily-stock-closings', { params });
    return (response.data?.body ?? response.data ?? []) as DailyStockClosingListItem[];
  },

  async getSheet(date: string, categoryCode?: string): Promise<DailyStockClosingSheet> {
    const response = await api.get('/api/daily-stock-closings/sheet', {
      params: { date, categoryCode: categoryCode || undefined },
    });
    return (response.data?.body ?? response.data) as DailyStockClosingSheet;
  },

  async save(data: DailyStockClosingSaveRequest): Promise<DailyStockClosingSaveResponse> {
    const response = await api.post('/api/daily-stock-closings', data);
    return (response.data?.body ?? response.data) as DailyStockClosingSaveResponse;
  },

  async delete(date: string): Promise<void> {
    await api.delete(`/api/daily-stock-closings/${date}`);
  },
};
