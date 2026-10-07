import api from './api';

export interface RepairJobListFilter {
  fromDate?: string;
  toDate?: string;
  status?: string;
  customerAcc?: string;
  searchText?: string;
}

export interface RepairJobPartItem {
  id?: number;
  itemId: string;
  itemTitle?: string;
  qty: number;
  rate: number;
  amount?: number;
}

export interface RepairJobServiceItem {
  id?: number;
  serviceItemId?: string;
  description: string;
  amount: number;
  technicianShare?: number;
}

export interface RepairJobResponse {
  jobNo: string;
  jobDate: string;
  customerAcc: string;
  customerAccountTitle?: string;
  customerName?: string;
  customerPhone?: string;
  brandId?: string;
  brandTitle?: string;
  deviceModel: string;
  imei?: string;
  passcodeOrPattern?: string;
  faultDescription: string;
  physicalCondition?: string;
  estimatedCost: number;
  advancePaid: number;
  status: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  expectedDelivery?: string;
  deliveredOn?: string;
  saleVNo?: string;
  remarks?: string;
  createdOn: string;
  parts: RepairJobPartItem[];
  services: RepairJobServiceItem[];
  totalPartsAmount: number;
  totalServicesAmount: number;
  totalAmount: number;
  balanceDue: number;
}

export interface RepairJobCreateRequest {
  jobDate: string;
  customerAcc: string;
  customerName?: string;
  customerPhone?: string;
  brandId?: string;
  deviceModel: string;
  imei?: string;
  passcodeOrPattern?: string;
  faultDescription: string;
  physicalCondition?: string;
  estimatedCost: number;
  advancePaid: number;
  assignedTechnicianId?: string;
  expectedDelivery?: string;
  remarks?: string;
  parts?: { itemId: string; qty: number; rate: number }[];
  services?: { serviceItemId?: string; description: string; amount: number; technicianShare?: number }[];
}

export interface RepairJobUpdateRequest extends RepairJobCreateRequest {
  status: string;
}

export interface RepairJobStatusUpdateRequest {
  status: string;
  remarks?: string;
}

export interface RepairJobBillRequest {
  cashReceipt: number;
  discount: number;
  narrationId?: string;
  description?: string;
}

export const repairJobService = {
  async getList(filter?: RepairJobListFilter): Promise<RepairJobResponse[]> {
    const response = await api.get('/api/repair-jobs', { params: filter });
    return (response.data.body || []) as RepairJobResponse[];
  },

  async getById(jobNo: string): Promise<RepairJobResponse | null> {
    const response = await api.get(`/api/repair-jobs/${encodeURIComponent(jobNo)}`);
    return response.data.body as RepairJobResponse;
  },

  async create(data: RepairJobCreateRequest): Promise<string> {
    const response = await api.post('/api/repair-jobs', data);
    return response.data.body as string;
  },

  async update(jobNo: string, data: RepairJobUpdateRequest): Promise<void> {
    await api.put(`/api/repair-jobs/${encodeURIComponent(jobNo)}`, data);
  },

  async updateStatus(jobNo: string, data: RepairJobStatusUpdateRequest): Promise<void> {
    await api.put(`/api/repair-jobs/${encodeURIComponent(jobNo)}/status`, data);
  },

  async billJob(jobNo: string, data: RepairJobBillRequest): Promise<string> {
    const response = await api.post(`/api/repair-jobs/${encodeURIComponent(jobNo)}/bill`, data);
    return response.data.body as string;
  },

  async delete(jobNo: string): Promise<void> {
    await api.delete(`/api/repair-jobs/${encodeURIComponent(jobNo)}`);
  }
};
