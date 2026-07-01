import api from './api';

export interface UserResponse {
  id: string;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  status: string;
  isActive: boolean;
  emailConfirmed: boolean;
  imageUrl: string | null;
}

export interface UserListFilter {
  pageNumber?: number;
  pageSize?: number;
  keyword?: string;
  orderBy?: string[];
}

export interface PaginatedUserResponse {
  data: UserResponse[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

export interface UserCreateRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  userName?: string;
}

export interface UserUpdateRequest {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  userName?: string;
}

export const userService = {
  async getUsers(filter: UserListFilter = {}) {
    const response = await api.post('/api/users/list', {
      pageNumber: filter.pageNumber ?? 1,
      pageSize: filter.pageSize ?? 20,
      keyword: filter.keyword || undefined,
      orderBy: filter.orderBy ?? [],
    });
    return response.data.body as PaginatedUserResponse;
  },

  async getUser(id: string) {
    const response = await api.get(`/api/users/${id}`);
    return response.data.body as UserResponse;
  },

  async create(data: UserCreateRequest) {
    const response = await api.post('/api/users', data);
    return response.data.body as string;
  },

  async update(id: string, data: UserUpdateRequest) {
    const response = await api.put(`/api/users/${id}`, data);
    return response.data.body as string;
  },

  async toggleStatus(userId: string, activateUser: boolean) {
    await api.post(`/api/users/${userId}/toggle-status`, {
      userId,
      activateUser,
    });
  },
};
