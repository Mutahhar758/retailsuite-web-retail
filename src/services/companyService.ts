import api from './api';

export interface CompanyDetailDto {
  companyName: string;
  urCompanyName?: string | null;
  descr?: string | null;
  address?: string | null;
  phone?: string | null;
  cell?: string | null;
  cell2?: string | null;
  contactHeader?: string | null;
  email?: string | null;
  website?: string | null;
  ntn?: string | null;
  strn?: string | null;
  logoMediaId?: string | null;
  logoUrl?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedOn?: string | null;
}

export interface CompanyDetailUpdateRequest {
  urCompanyName?: string | null;
  descr?: string | null;
  address?: string | null;
  phone?: string | null;
  cell?: string | null;
  cell2?: string | null;
  contactHeader?: string | null;
  email?: string | null;
  website?: string | null;
  ntn?: string | null;
  strn?: string | null;
  logoMediaId?: string | null;
}

export const companyService = {
  async getCurrent(): Promise<CompanyDetailDto> {
    const response = await api.get('/api/companies/current');
    return response.data?.body || response.data || { companyName: '' };
  },

  async updateCurrent(request: CompanyDetailUpdateRequest): Promise<CompanyDetailDto> {
    const response = await api.put('/api/companies/current', request);
    return response.data?.body || response.data;
  },

  async getLogoUploadUrl(fileName: string): Promise<{ fileId: string; uploadUrl: string; expiresAt?: string }> {
    const response = await api.post('/api/companies/presigned-upload-url', null, {
      params: { fileName },
    });
    const data = response?.data?.body;
    if (!data?.uploadUrl) {
      throw new Error(response?.data?.metadata?.message || 'Server did not return a valid upload URL for the company logo.');
    }
    return data as { fileId: string; uploadUrl: string; expiresAt?: string };
  },
};
