import api from './api';
import type { BulkOperationResult } from './customerService';

export interface Item {
  id: string;
  barcode?: string;
  itemCategoryCode: string;
  title: string;
  itemKey?: string;
  priRate: number;
  secRate: number;
  costRate?: number;
  lastPurchaseRate?: number | null;
  lastPurchaseSecRate?: number | null;
  secCostRate?: number;
  primaryUnit?: string;
  primaryUnitTitle?: string;
  secondaryUnit?: string;
  secondaryUnitTitle?: string;
  defaultUnit?: string;
  defaultUnitTitle?: string;
  qtyInPack?: number;
  alert: boolean;
  lowStockAlert?: boolean;
  lowStockQty?: number;
  minSalePrice?: number | null;
  opnStock?: number;
  opnRate?: number;
  itemType?: string;
  mediaId?: string;
  mediaUrl?: string;
  quickQtyPresets?: string;
  additionalUnits?: string | null;
  requireImei?: boolean;
  brandId?: string;
  brandTitle?: string;
  modelName?: string;
  storage?: string;
  ram?: string;
  color?: string;
}

export interface InventoryItemUpsertRequest {
  id?: string;
  itemCategoryCode: string;
  barcode?: string;
  title: string;
  itemKey?: string;
  priRate: number;
  secRate: number;
  primaryUnit: string;
  secondaryUnit?: string;
  defaultUnit?: string;
  qtyInPack?: number;
  alert: boolean;
  lowStockAlert?: boolean;
  lowStockQty?: number;
  minSalePrice?: number | null;
  opnStock?: number;
  opnRate?: number;
  itemType?: string;
  mediaId?: string;
  quickQtyPresets?: string;
  additionalUnits?: string | null;
  requireImei?: boolean;
  brandId?: string;
  modelName?: string;
  storage?: string;
  ram?: string;
  color?: string;
}

export interface Unit {
  code: string;
  title: string;
  shortTitle?: string | null;
  parentUnitId?: string | null;
  parentUnitTitle?: string | null;
  conversionRatio?: number | null;
}

export interface PaginatedItems {
  data: Item[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ItemListParams {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  itemCategoryCode?: string;
  brandId?: string;
  itemType?: string;
}

export const inventoryService = {
  async getPagedItems(params?: ItemListParams) {
    const response = await api.get('/api/inventory/items/paged', { params });
    return response.data.body as PaginatedItems;
  },

  async getItems(categoryCode?: string) {
    const response = await api.get('/api/inventory/items', { params: { itemCategoryCode: categoryCode } });
    return response.data.body as Item[];
  },

  async getItemsLookup(categoryCode?: string, includeLastPurchaseRate: boolean = false) {
    const response = await api.get('/api/inventory/items/lookup', { params: { itemCategoryCode: categoryCode, ...(includeLastPurchaseRate ? { includeLastPurchaseRate: true } : {}) } });
    return response.data.body as Item[];
  },

  async getById(id: string) {
    const response = await api.get(`/api/inventory/items/${id}`);
    return response.data.body as Item;
  },

  async getUnits() {
    const response = await api.get('/api/units');
    return response.data.body as Unit[];
  },

  async getUnitsLookup() {
    const response = await api.get('/api/units/lookup');
    return response.data.body as Unit[];
  },

  async create(data: InventoryItemUpsertRequest) {
    const response = await api.post('/api/inventory/items', data);
    return response.data.body as string;
  },

  async update(id: string, data: InventoryItemUpsertRequest) {
    const response = await api.put(`/api/inventory/items/${id}`, data);
    return response.data.body as string;
  },

  async delete(id: string) {
    const response = await api.delete(`/api/inventory/items/${id}`);
    return response.data.body as string;
  },

  async getPresignedUploadUrl(fileName: string) {
    const response = await api.post('/api/inventory/items/presigned-upload-url', null, { params: { fileName } });
    const data = response?.data?.body;
    if (!data?.uploadUrl) {
      throw new Error(response?.data?.metadata?.message || 'Server did not return a valid upload URL for the media.');
    }
    return data as { fileId: string; uploadUrl: string; expiresAt: string };
  },

  async bulkUpsert(data: InventoryItemBulkUpsertRequest) {
    const response = await api.post('/api/inventory/items/bulk', data);
    return response.data.body as BulkOperationResult;
  },

  async getCustomerCategoryPrices(customerCategoryId?: string) {
    const response = await api.get('/api/inventory/customer-category-prices', {
      params: { customerCategoryId }
    });
    return response.data.body as ItemCustomerCategoryPriceDto[];
  },

  async getItemCategoryPrices(itemId: string) {
    const response = await api.get(`/api/inventory/items/${itemId}/customer-category-prices`);
    return response.data.body as ItemCustomerCategoryPriceDto[];
  },

  async saveItemCategoryPrices(itemId: string, prices: ItemCustomerCategoryPriceUpsertRequest[]) {
    const response = await api.put(`/api/inventory/items/${itemId}/customer-category-prices`, prices);
    return response.data.body as string;
  }
};

export interface ItemCustomerCategoryPriceDto {
  id: number;
  itemId: string;
  customerCategoryId: string;
  customerCategoryTitle: string;
  priRate: number;
  secRate?: number;
}

export interface ItemCustomerCategoryPriceUpsertRequest {
  customerCategoryId: string;
  priRate: number;
  secRate?: number;
}

export interface InventoryItemBulkItemDto {
  id?: string;
  barcode?: string;
  itemCategoryCode: string;
  title: string;
  itemKey?: string;
  priRate: number;
  secRate: number;
  primaryUnit: string;
  secondaryUnit?: string;
  defaultUnit?: string;
  qtyInPack?: number;
  alert?: boolean;
  lowStockAlert?: boolean;
  lowStockQty?: number;
  minSalePrice?: number | null;
  opnStock?: number;
  opnRate?: number;
  itemType?: string;
  quickQtyPresets?: string;
  requireImei?: boolean;
  brandId?: string;
  modelName?: string;
  storage?: string;
  ram?: string;
  color?: string;
}

export interface InventoryItemBulkUpsertRequest {
  items: InventoryItemBulkItemDto[];
}

