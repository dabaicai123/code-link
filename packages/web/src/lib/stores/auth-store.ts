import { create } from 'zustand';
import { storage } from '../storage';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
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
}));

// Initialize token from storage on first client-side load
// Use a flag to ensure this only runs once
let initialized = false;
if (typeof window !== 'undefined' && !initialized) {
  initialized = true;
  const token = storage.getToken();
  if (token) {
    useAuthStore.getState().setToken(token);
  }
}