import { create } from 'zustand';
import { storage } from '../storage';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  initialized: false,

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
    set({ token, initialized: true });
  },

  setAuth: (token, user) => {
    storage.setToken(token);
    set({
      token,
      user,
      isAuthenticated: true,
      initialized: true,
    });
  },

  logout: () => {
    storage.removeToken();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      initialized: true,
    });
  },
}));

// Initialize token from storage on first client-side load
let initialized = false;
if (typeof window !== 'undefined' && !initialized) {
  initialized = true;
  const token = storage.getToken();
  if (token) {
    useAuthStore.getState().setToken(token);
  } else {
    useAuthStore.setState({ initialized: true });
  }
}
