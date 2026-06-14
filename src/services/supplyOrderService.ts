import api from './api';

export interface SupplyOrderDetail {
  customerId: string;
  sortOrder: number;
}

export interface SupplyOrder {
  id: number;
  title: string;
  details: SupplyOrderDetail[];
}

export interface SupplyOrderUpsertRequest {
  title: string;
  details: SupplyOrderDetail[];
}

const BASE_PATH = '/api/SupplyOrders';

export const supplyOrderService = {
  async getList(): Promise<SupplyOrder[]> {
    const response = await api.get(BASE_PATH);
    return response.data.body || [];
  },

  async getById(id: number): Promise<SupplyOrder | null> {
    const response = await api.get(`${BASE_PATH}/${id}`);
    return response.data.body || null;
  },

  async create(request: SupplyOrderUpsertRequest): Promise<SupplyOrder> {
    const response = await api.post(BASE_PATH, request);
    return response.data.body;
  },

  async update(id: number, request: SupplyOrderUpsertRequest): Promise<SupplyOrder> {
    const response = await api.put(`${BASE_PATH}/${id}`, request);
    return response.data.body;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`${BASE_PATH}/${id}`);
  }
};
