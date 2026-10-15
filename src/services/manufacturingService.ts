import api from './api';

export type ProductionStatus = 'Planned' | 'InProgress' | 'Completed' | 'Cancelled' | 0 | 1 | 2 | 3 | string;

export const ProductionStatusEnum = {
  Planned: 'Planned' as ProductionStatus,
  InProgress: 'InProgress' as ProductionStatus,
  Completed: 'Completed' as ProductionStatus,
  Cancelled: 'Cancelled' as ProductionStatus,
};

export const ProductionStatusLabels: Record<string | number, { label: string; color: string }> = {
  'Planned': { label: 'Planned', color: 'blue' },
  'InProgress': { label: 'In Progress (WIP)', color: 'orange' },
  'Completed': { label: 'Completed', color: 'green' },
  'Cancelled': { label: 'Cancelled', color: 'red' },
  'planned': { label: 'Planned', color: 'blue' },
  'inprogress': { label: 'In Progress (WIP)', color: 'orange' },
  'completed': { label: 'Completed', color: 'green' },
  'cancelled': { label: 'Cancelled', color: 'red' },
  0: { label: 'Planned', color: 'blue' },
  1: { label: 'In Progress (WIP)', color: 'orange' },
  2: { label: 'Completed', color: 'green' },
  3: { label: 'Cancelled', color: 'red' },
};

export const getProductionStatusConfig = (status?: any) => {
  if (status === undefined || status === null) {
    return { label: 'Unknown', color: 'default' };
  }
  if (ProductionStatusLabels[status]) {
    return ProductionStatusLabels[status];
  }
  const key = String(status).toLowerCase();
  if (ProductionStatusLabels[key]) {
    return ProductionStatusLabels[key];
  }
  return { label: String(status), color: 'default' };
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
