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
  lines: KotOrderItemRequest[];
}

export const kotService = {
  // KOT Orders
  async create(data: KotOrderCreateRequest) {
    const response = await api.post('/api/kot-orders', data);
    return response.data.body as KotOrderResponse;
  },

  async getActive(prepStationId?: string) {
    const response = await api.get('/api/kot-orders/active', { params: { prepStationId } });
    return response.data.body as KotOrderResponse[];
  },

  async getByTokenOrId(query: string) {
    const response = await api.get(`/api/kot-orders/token/${query}`);
    return response.data.body as KotOrderResponse | null;
  },

  async updateItemStatus(orderId: number, itemId: number, status: string) {
    const response = await api.put(`/api/kot-orders/${orderId}/items/${itemId}/status`, JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data.body;
  },

  async updateOrderStatus(orderId: number, status: string) {
    const response = await api.put(`/api/kot-orders/${orderId}/status`, JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data.body;
  },

  async finalizePayment(orderId: number, saleVoucherNo: string) {
    const response = await api.put(`/api/kot-orders/${orderId}/finalize`, JSON.stringify(saleVoucherNo), {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data.body;
  },

  // Prep Stations
  async getPrepStations() {
    const response = await api.get('/api/prep-stations');
    return response.data.body as PrepStationDto[];
  },

  async createPrepStation(data: { id: string; name: string; active: boolean }) {
    const response = await api.post('/api/prep-stations', data);
    return response.data.body as PrepStationDto;
  },

  async updatePrepStation(id: string, data: { name: string; active: boolean }) {
    const response = await api.put(`/api/prep-stations/${id}`, data);
    return response.data.body;
  },

  async deletePrepStation(id: string) {
    const response = await api.delete(`/api/prep-stations/${id}`);
    return response.data.body;
  },

  // Dining Tables
  async getDiningTables() {
    const response = await api.get('/api/dining-tables');
    return response.data.body as DiningTableDto[];
  },

  async createDiningTable(data: { name: string; capacity: number; active: boolean }) {
    const response = await api.post('/api/dining-tables', data);
    return response.data.body as DiningTableDto;
  },

  async updateDiningTable(id: number, data: { name: string; capacity: number; status: string; active: boolean }) {
    const response = await api.put(`/api/dining-tables/${id}`, data);
    return response.data.body;
  },

  async deleteDiningTable(id: number) {
    const response = await api.delete(`/api/dining-tables/${id}`);
    return response.data.body;
  },
};
