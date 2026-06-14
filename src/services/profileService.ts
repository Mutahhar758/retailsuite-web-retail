import api from './api';

export interface UserProfileDto {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  imageUrl?: string;
}

export const profileService = {
  async getProfile() {
    const response = await api.get('/api/personal/profile');
    return response.data.body as UserProfileDto;
  },

  async changePassword(request: any) {
    const response = await api.post('/api/users/change-password', request);
    return response.data;
  }
};

export const logoutService = {
  async logout() {
    try {
      await api.post('/api/users/Logout');
    } catch (error) {
      console.error('Backend logout failed', error);
    }
  }
};
