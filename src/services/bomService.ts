import api from './api';

export interface BomLineResponse {
  id: number;
  seq: number;
  rawItemId: string;
  rawItemTitle: string;
  rawItemBarcode?: string;
  qty: number;
  unitId?: string;
  unitTitle?: string;
  scrapPercentage: number;
  isOptional: boolean;
  currentRate: number;
  totalEstimatedCost: number;
}

export interface BomResponse {
  id: number;
  code: string;
  title: string;
  finishedItemId: string;
  finishedItemTitle: string;
  finishedItemBarcode?: string;
  outputQty: number;
  unitId?: string;
  unitTitle?: string;
  isActive: boolean;
  isDefault: boolean;
  laborCost: number;
  overheadCost: number;
  packagingCost: number;
  totalEstimatedMaterialCost: number;
  totalEstimatedCost: number;
  unitEstimatedCost: number;
  notes?: string;
  lines: BomLineResponse[];
}

export interface BomLineRequest {
  seq: number;
  rawItemId: string;
  qty: number;
  unitId?: string;
  scrapPercentage: number;
  isOptional: boolean;
}

export interface BomCreateOrUpdateRequest {
  code: string;
  title: string;
  finishedItemId: string;
  outputQty: number;
  unitId?: string;
  isActive: boolean;
  isDefault: boolean;
  laborCost: number;
  overheadCost: number;
  packagingCost: number;
  notes?: string;
  lines: BomLineRequest[];
}

export interface BomListFilter {
  keyword?: string;
  finishedItemId?: string;
  isActive?: boolean;
}

export const bomService = {
  async getList(filter?: BomListFilter) {
    const response = await api.get('/api/boms', { params: filter });
    return (response.data.body || response.data) as BomResponse[];
  },

  async getById(id: number) {
    const response = await api.get(`/api/boms/${id}`);
    return (response.data.body || response.data) as BomResponse;
  },

  async getDefaultByFinishedItem(finishedItemId: string) {
    const response = await api.get(`/api/boms/default/${finishedItemId}`);
    return (response.data.body || response.data) as BomResponse | null;
  },

  async create(request: BomCreateOrUpdateRequest) {
    const response = await api.post('/api/boms', request);
    return response.data.body || response.data;
  },

  async update(id: number, request: BomCreateOrUpdateRequest) {
    const response = await api.put(`/api/boms/${id}`, request);
    return response.data.body || response.data;
  },

  async delete(id: number) {
    const response = await api.delete(`/api/boms/${id}`);
    return response.data.body || response.data;
  }
};
