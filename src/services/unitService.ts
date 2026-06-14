import api from './api';

export interface UnitDto {
  code: string;
  title: string;
}

export interface CreateUnitRequest {
  title: string;
  active: boolean;
}

export interface UpdateUnitRequest {
  title: string;
  active: boolean;
}

export const unitService = {
  async getActiveUnits() {
    const response = await api.get('/api/units');
    return response.data.body as UnitDto[];
  },

  async create(data: CreateUnitRequest) {
    const response = await api.post('/api/units', data);
    return response.data.body;
  },

  async update(code: string, data: UpdateUnitRequest) {
    const response = await api.put(`/api/units/${code}`, data);
    return response.data.body;
  },

  async delete(code: string) {
    const response = await api.delete(`/api/units/${code}`);
    return response.data.body;
  },
};
