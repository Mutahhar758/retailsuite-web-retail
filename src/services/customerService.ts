import api from './api';

export interface CustomerSupplyItemDto {
  customerAccountId?: string;
  itemId: string;
  itemTitle?: string;
  qty: number;
  secQty?: number;
  /** Override rate. undefined/null means use the item's default rate. */
  rate?: number;
  /** Override add/less amount. undefined/null means treat as 0. */
  addLess?: number;
  /** Override discount (Rs). undefined/null means treat as 0. */
  discount?: number;
  /** Carriage / Rent per item. undefined/null means treat as 0. */
  carriage?: number;
}

export interface CustomerResponse {
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
  mediaId?: string;
  mediaUrl?: string;
  customerCategoryId?: string;
  customerCategoryTitle?: string;
  parentCustomerAccountId?: string;
  parentCustomerTitle?: string;
  isSubAccount?: boolean;
  createdBy?: string;
  createdOn?: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
  supplyItems?: CustomerSupplyItemDto[];
}

export interface CustomerCreateRequest {
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
  mediaId?: string;
  customerCategoryId?: string;
  parentCustomerAccountId?: string | null;
  supplyItems?: CustomerSupplyItemDto[];
}

export interface CustomerUpdateRequest {
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
  mediaId?: string;
  customerCategoryId?: string;
  parentCustomerAccountId?: string | null;
  supplyItems?: CustomerSupplyItemDto[];
}

export const customerService = {
  async getCustomers() {
    const response = await api.get('/api/customers');
    return response.data.body as CustomerResponse[];
  },

  async create(data: CustomerCreateRequest) {
    const response = await api.post('/api/customers', data);
    return response.data.body as string;
  },

  async update(account: string, data: CustomerUpdateRequest) {
    const response = await api.put(`/api/customers/${account}`, data);
    return response.data.body as string;
  },

  async getPresignedUploadUrl(fileName: string) {
    const response = await api.post('/api/customers/presigned-upload-url', null, { params: { fileName } });
    const data = response?.data?.body;
    if (!data?.uploadUrl) {
      throw new Error(response?.data?.metadata?.message || 'Server did not return a valid upload URL for the media.');
    }
    return data as { fileId: string; uploadUrl: string; expiresAt: string };
  },

  async getSupplyItems(params?: { customerId?: string; itemId?: string }) {
    const response = await api.get('/api/customers/supply-items', { params });
    return response.data.body as CustomerSupplyItemDto[];
  },

  async bulkUpsert(data: CustomerBulkUpsertRequest) {
    const response = await api.post('/api/customers/bulk', data);
    return response.data.body as BulkOperationResult;
  }
};

export interface CustomerBulkItemDto {
  account?: string;
  title: string;
  phone1?: string;
  phone2?: string;
  email?: string;
  cnic?: string;
  address?: string;
  qualification?: string;
  fax?: string;
  smsNumber?: string;
  iban?: string;
  smsAlert?: boolean;
  emailAlert?: boolean;
  active?: boolean;
  customerCategoryId?: string;
}

export interface CustomerBulkUpsertRequest {
  customers: CustomerBulkItemDto[];
}

export interface BulkOperationResult {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errors: Array<{
    rowIndex: number;
    identifier: string;
    errorMessage: string;
  }>;
}
