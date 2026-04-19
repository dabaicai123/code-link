import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../storage';

export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setToken: (token) => {
        if (token) {
          storage.setToken(token);
        } else {
          storage.removeToken();
        }
        set({ token });
      },

      logout: () => {
        storage.removeToken();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);

// 初始化时从 storage 恢复 token
if (typeof window !== 'undefined') {
  const token = storage.getToken();
  if (token) {
    useAuthStore.getState().setToken(token);
  }
}