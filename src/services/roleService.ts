import api from './api';

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  permissions?: string[];
}

export interface PermissionResponse {
  name: string;
  description: string;
  action: string;
  resource: string;
  isBasic: boolean;
}

export interface CreateOrUpdateRoleRequest {
  id?: string;
  name: string;
  description?: string;
}

export interface UpdateRolePermissionsRequest {
  roleId: string;
  permissions: string[];
}

export const roleService = {
  async getRoles() {
    const response = await api.get('/api/roles/list');
    return response.data.body as RoleResponse[];
  },

  async getRole(id: string) {
    const response = await api.get(`/api/roles/${id}`);
    return response.data.body as RoleResponse;
  },

  async getRoleWithPermissions(id: string) {
    const response = await api.get(`/api/roles/${id}/permissions`);
    return response.data.body as RoleResponse;
  },

  async createOrUpdate(data: CreateOrUpdateRoleRequest) {
    const response = await api.post('/api/roles', data);
    return response.data.body as string;
  },

  async updatePermissions(data: UpdateRolePermissionsRequest) {
    const response = await api.put('/api/roles/permissions', data);
    return response.data.body as string;
  },

  async delete(id: string) {
    const response = await api.delete(`/api/roles/${id}`);
    return response.data.body as string;
  },

  async getAllPermissions() {
    const response = await api.get('/api/roles/permissions');
    return response.data.body as PermissionResponse[];
  },
};
