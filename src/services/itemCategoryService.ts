import api from './api';

export interface ItemCategoryDto {
  code: string;
  title: string;
  active: boolean;
  mediaId?: string;
  mediaUrl?: string;
}

export interface CreateItemCategoryRequest {
  title: string;
  active: boolean;
  mediaId?: string;
}

export interface UpdateItemCategoryRequest {
  title: string;
  active: boolean;
  mediaId?: string;
}

export const itemCategoryService = {
  async getActiveItemCategories() {
    const response = await api.get('/api/itemcategories');
    return response.data.body as ItemCategoryDto[];
  },

  async create(data: CreateItemCategoryRequest) {
    const response = await api.post('/api/itemcategories', data);
    return response.data.body;
  },

  async update(code: string, data: UpdateItemCategoryRequest) {
    const response = await api.put(`/api/itemcategories/${code}`, data);
    return response.data.body;
  },

  async delete(code: string) {
    const response = await api.delete(`/api/itemcategories/${code}`);
    return response.data.body;
  },

  async getPresignedUploadUrl(fileName: string) {
    const response = await api.post(`/api/itemcategories/presigned-upload-url?fileName=${encodeURIComponent(fileName)}`);
    return response.data.body as { fileId: string; uploadUrl: string };
  },
};
