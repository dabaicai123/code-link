import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/lib/stores/auth-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('initializes with null user', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('sets user correctly', () => {
    const user = { id: 1, email: 'test@example.com', name: 'Test', avatar: null };
    useAuthStore.getState().setUser(user);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('clears user on logout', () => {
    const user = { id: 1, email: 'test@example.com', name: 'Test', avatar: null };
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});