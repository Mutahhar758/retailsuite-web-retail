import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    userId?: string;
    userName?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  } | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: any) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'retail-auth-storage',
    }
  )
);
