import api from './api';

export interface NarrationDto {
  code: string;
  title: string;
  status: number;
}

export interface CreateNarrationRequest {
  title: string;
}

export interface UpdateNarrationRequest {
  title: string;
}

export const narrationService = {
  async getActiveNarrations() {
    const response = await api.get('/api/narrations');
    return response.data.body as NarrationDto[];
  },

  async create(data: CreateNarrationRequest) {
    const response = await api.post('/api/narrations', data);
    return response.data.body;
  },

  async update(code: string, data: UpdateNarrationRequest) {
    const response = await api.put(`/api/narrations/${code}`, data);
    return response.data.body;
  },

  async delete(code: string) {
    const response = await api.delete(`/api/narrations/${code}`);
    return response.data.body;
  },
};
