import api from './api';

export interface PrepStationDto {
  id: string;
  name: string;
  active: boolean;
}

export interface DiningTableDto {
  id: number;
  name: string;
  capacity: number;
  status: string; // Available, Occupied, Reserved
  active: boolean;
}

export interface KotOrderItemResponse {
  id: number;
  itemId: string;
  itemTitle: string;
  itemCategoryCode?: string;
  prepStationId?: string;
  qty: number;
  rate: number;
  notes?: string;
  status: string; // Pending, Preparing, Ready, Served, Cancelled
}

export interface KotOrderResponse {
  id: number;
  tokenNo: number;
  orderDate: string;
  orderTime: string;
  orderType: string; // Takeaway, DineIn, Delivery
  tableId?: number;
  tableName?: string;
  status: string; // Pending, Preparing, Ready, Served, Cancelled, Paid
  saleVoucherNo?: string;
  customerId?: string;
  customerName?: string;
  totalAmount: number;
  remarks?: string;
  lines: KotOrderItemResponse[];
  createdBy: string;
  createdOn: string;
}

export interface KotOrderItemRequest {
  itemId: string;
  qty: number;
  rate: number;
  notes?: string;
}

export interface KotOrderCreateRequest {
  orderType: string;
  tableId?: number;
  customerId?: string;
  remarks?: string;
  saleVoucherNo?: string | null;
  status?: string;
  lines: KotOrderItemRequest[];
}

export const kotService = {
  // KOT Orders
  async create(data: KotOrderCreateRequest) {
    const response = await api.post('/api/kotorders', data);
    return (response.data?.body ?? response.data) as KotOrderResponse;
  },

  async getActive(prepStationId?: string) {
    const response = await api.get('/api/kotorders/active', { params: { prepStationId } });
    const list = response.data?.body ?? response.data;
    return Array.isArray(list) ? (list as KotOrderResponse[]) : [];
  },

  async getByTokenOrId(query: string) {
    const response = await api.get(`/api/kotorders/token/${query}`);
    return (response.data?.body ?? response.data ?? null) as KotOrderResponse | null;
  },

  async updateItemStatus(orderId: number, itemId: number, status: string) {
    const response = await api.put(`/api/kotorders/${orderId}/items/${itemId}/status`, JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data?.body ?? response.data;
  },

  async updateOrderStatus(orderId: number, status: string) {
    const response = await api.put(`/api/kotorders/${orderId}/status`, JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data?.body ?? response.data;
  },

  async finalizePayment(orderId: number, saleVoucherNo: string) {
    const response = await api.put(`/api/kotorders/${orderId}/finalize`, JSON.stringify(saleVoucherNo), {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data?.body ?? response.data;
  },

  async appendLines(orderId: number, lines: KotOrderItemRequest[]) {
    const response = await api.post(`/api/kotorders/${orderId}/items`, lines);
    return (response.data?.body ?? response.data) as KotOrderResponse;
  },

  // Prep Stations
  async getPrepStations() {
    const response = await api.get('/api/prepstations');
    const list = response.data?.body ?? response.data;
    return Array.isArray(list) ? (list as PrepStationDto[]) : [];
  },

  async createPrepStation(data: { id: string; name: string; active: boolean }) {
    const response = await api.post('/api/prepstations', data);
    return (response.data?.body ?? response.data) as PrepStationDto;
  },

  async updatePrepStation(id: string, data: { name: string; active: boolean }) {
    const response = await api.put(`/api/prepstations/${id}`, data);
    return response.data?.body ?? response.data;
  },

  async deletePrepStation(id: string) {
    const response = await api.delete(`/api/prepstations/${id}`);
    return response.data?.body ?? response.data;
  },

  // Dining Tables
  async getDiningTables() {
    const response = await api.get('/api/diningtables');
    const list = response.data?.body ?? response.data;
    return Array.isArray(list) ? (list as DiningTableDto[]) : [];
  },

  async createDiningTable(data: { name: string; capacity: number; active: boolean }) {
    const response = await api.post('/api/diningtables', data);
    return (response.data?.body ?? response.data) as DiningTableDto;
  },

  async updateDiningTable(id: number, data: { name: string; capacity: number; status: string; active: boolean }) {
    const response = await api.put(`/api/diningtables/${id}`, data);
    return response.data?.body ?? response.data;
  },

  async deleteDiningTable(id: number) {
    const response = await api.delete(`/api/diningtables/${id}`);
    return response.data?.body ?? response.data;
  },
};
