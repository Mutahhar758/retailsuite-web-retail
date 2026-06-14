import api from './api';

export interface OpeningBalanceDto {
  parentCode: string;
  code: string;
  title: string;
  bal: number;
}

export interface OpeningBalanceUpsertRequest {
  account: string;
  drAmount?: number | null;
  crAmount?: number | null;
}

export const openingBalanceService = {
  async getAll(parentAccountId?: string) {
    const url = parentAccountId
      ? `/api/openingbalances?parentAccountId=${encodeURIComponent(parentAccountId)}`
      : '/api/openingbalances';
    const response = await api.get(url);
    return response.data.body as OpeningBalanceDto[];
  },

  async upsert(data: OpeningBalanceUpsertRequest) {
    const response = await api.put('/api/openingbalances', data);
    return response.data.body;
  },
};
