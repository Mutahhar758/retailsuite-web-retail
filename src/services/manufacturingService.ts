import api from './api';

export type ProductionStatus = 0 | 1 | 2 | 3;
export const ProductionStatusEnum = {
  Planned: 0 as ProductionStatus,
  InProgress: 1 as ProductionStatus,
  Completed: 2 as ProductionStatus,
  Cancelled: 3 as ProductionStatus,
};

export const ProductionStatusLabels: Record<ProductionStatus, { label: string; color: string }> = {
  0: { label: 'Planned', color: 'blue' },
  1: { label: 'In Progress (WIP)', color: 'orange' },
  2: { label: 'Completed', color: 'green' },
  3: { label: 'Cancelled', color: 'red' },
};

export interface ProductionLineResponse {
  seq: number;
  rawItemId: string;
  rawItemTitle: string;
  rawItemBarcode?: string;
  plannedQty: number;
  actualQty: number;
  unitId?: string;
  unitTitle?: string;
  unitCost: number;
  totalCost: number;
  availableStock: number;
  isIssued: boolean;
}

export interface ProductionResponse {
  id: number;
  date: string;
  time: string;
  vType: string;
  voucherNo: string;
  bomMasterId?: number;
  bomTitle?: string;
  finishedItemId: string;
  finishedItemTitle: string;
  finishedItemBarcode?: string;
  targetQty: number;
  producedQty: number;
  unitId?: string;
  unitTitle?: string;
  batchNo?: string;
  expiryDate?: string;
  totalMaterialCost: number;
  totalOverheadCost: number;
  totalProductionCost: number;
  unitProductionCost: number;
  narrationId?: string;
  narration?: string;
  remarks?: string;
  status: ProductionStatus;
  currentStage?: string;
  issuedDate?: string;
  completedDate?: string;
  createdBy?: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
  lines: ProductionLineResponse[];
}

export interface ProductionLineRequest {
  seq: number;
  rawItemId: string;
  plannedQty: number;
  actualQty: number;
  unitId?: string;
  unitCost: number;
  totalCost: number;
  isIssued: boolean;
}

export interface ProductionCreateOrUpdateRequest {
  date: string;
  vType?: string;
  bomMasterId?: number;
  finishedItemId: string;
  targetQty: number;
  producedQty: number;
  unitId?: string;
  batchNo?: string;
  expiryDate?: string;
  laborCost: number;
  overheadCost: number;
  packagingCost: number;
  narration?: string;
  remarks?: string;
  status: ProductionStatus;
  currentStage?: string;
  lines: ProductionLineRequest[];
}

export interface ProductionEstimateRequest {
  bomMasterId?: number;
  finishedItemId: string;
  targetQty: number;
}

export interface ProductionEstimateLine {
  seq: number;
  rawItemId: string;
  rawItemTitle: string;
  rawItemBarcode?: string;
  requiredQty: number;
  unitId?: string;
  unitTitle?: string;
  scrapPercentage: number;
  availableStock: number;
  isShortage: boolean;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
}

export interface ProductionEstimateResponse {
  targetQty: number;
  estimatedMaterialCost: number;
  estimatedLaborCost: number;
  estimatedOverheadCost: number;
  estimatedPackagingCost: number;
  estimatedTotalCost: number;
  estimatedUnitCost: number;
  lines: ProductionEstimateLine[];
}

export interface ProductionListFilter {
  fromDate?: string;
  toDate?: string;
  finishedItemId?: string;
  voucherNo?: string;
  status?: ProductionStatus;
  vType?: string;
}

export const manufacturingService = {
  async getList(filter?: ProductionListFilter) {
    const response = await api.get('/api/manufacturing', { params: filter });
    return (response.data.body || response.data) as ProductionResponse[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/manufacturing/${voucherNo}`);
    return (response.data.body || response.data) as ProductionResponse;
  },

  async calculateEstimate(request: ProductionEstimateRequest) {
    const response = await api.post('/api/manufacturing/estimate', request);
    return (response.data.body || response.data) as ProductionEstimateResponse;
  },

  async create(request: ProductionCreateOrUpdateRequest) {
    const response = await api.post('/api/manufacturing', request);
    return (response.data.body || response.data) as string; // voucherNo
  },

  async update(voucherNo: string, request: ProductionCreateOrUpdateRequest) {
    const response = await api.put(`/api/manufacturing/${voucherNo}`, request);
    return response.data.body || response.data;
  },

  async updateStatus(voucherNo: string, status: ProductionStatus) {
    const response = await api.patch(`/api/manufacturing/${voucherNo}/status`, null, {
      params: { status }
    });
    return response.data.body || response.data;
  },

  async delete(voucherNo: string) {
    const response = await api.delete(`/api/manufacturing/${voucherNo}`);
    return response.data.body || response.data;
  }
};
