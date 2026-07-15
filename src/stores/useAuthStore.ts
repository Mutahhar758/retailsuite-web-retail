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
    isOwner?: boolean;
  } | null;
  permissions: string[];
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: any) => void;
  setPermissions: (permissions: string[]) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setPermissions: (permissions) => set({ permissions }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null, permissions: [] }),
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'retail-auth-storage',
    }
  )
);
