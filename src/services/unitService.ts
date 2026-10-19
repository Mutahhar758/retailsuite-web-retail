import api from './api';

export interface UnitDto {
  code: string;
  title: string;
  shortTitle?: string | null;
  parentUnitId?: string | null;
  parentUnitTitle?: string | null;
  conversionRatio?: number | null;
}

export interface CreateUnitRequest {
  title: string;
  shortTitle?: string | null;
  parentUnitId?: string | null;
  conversionRatio?: number | null;
  active: boolean;
}

export interface UpdateUnitRequest {
  title: string;
  shortTitle?: string | null;
  parentUnitId?: string | null;
  conversionRatio?: number | null;
  active: boolean;
}

export const unitService = {
  async getActiveUnits() {
    const response = await api.get('/api/units');
    return response.data.body as UnitDto[];
  },

  async getActiveUnitsLookup() {
    const response = await api.get('/api/units/lookup');
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
