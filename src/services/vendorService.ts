import api from './api';

export interface VendorResponse {
  account: string;
  title: string;
  email?: string;
  fax?: string;
  cnic?: string;
  address?: string;
  qualification?: string;
  phone1?: string;
  phone2?: string;
  smsNumber?: string;
  iban?: string;
  smsAlert: boolean;
  emailAlert: boolean;
  active: boolean;
  showInSales: boolean;
  createdBy?: string;
  createdOn?: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface VendorCreateRequest {
  title: string;
  email?: string;
  fax?: string;
  cnic?: string;
  address?: string;
  qualification?: string;
  phone1?: string;
  phone2?: string;
  smsNumber?: string;
  iban?: string;
  smsAlert: boolean;
  emailAlert: boolean;
  active: boolean;
  showInSales: boolean;
}

export interface VendorUpdateRequest {
  title?: string;
  email?: string;
  fax?: string;
  cnic?: string;
  address?: string;
  qualification?: string;
  phone1?: string;
  phone2?: string;
  smsNumber?: string;
  iban?: string;
  smsAlert: boolean;
  emailAlert: boolean;
  active: boolean;
  showInSales: boolean;
}

export const vendorService = {
  async getVendors() {
    const response = await api.get('/api/vendors');
    return response.data.body as VendorResponse[];
  },

  async create(data: VendorCreateRequest) {
    const response = await api.post('/api/vendors', data);
    return response.data.body as string;
  },

  async update(account: string, data: VendorUpdateRequest) {
    const response = await api.put(`/api/vendors/${account}`, data);
    return response.data.body as string;
  }
};
