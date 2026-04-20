import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/lib/stores/ui-store';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarExpanded: true,
      globalLoading: false,
    });
  });

  it('initializes with sidebar expanded and no global loading', () => {
    const state = useUIStore.getState();
    expect(state.sidebarExpanded).toBe(true);
    expect(state.globalLoading).toBe(false);
  });

  it('toggles sidebar', () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarExpanded).toBe(false);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarExpanded).toBe(true);
  });

  it('sets global loading', () => {
    useUIStore.getState().setGlobalLoading(true);
    expect(useUIStore.getState().globalLoading).toBe(true);

    useUIStore.getState().setGlobalLoading(false);
    expect(useUIStore.getState().globalLoading).toBe(false);
  });

  it('resets to initial state', () => {
    useUIStore.getState().toggleSidebar();
    useUIStore.getState().setGlobalLoading(true);
    useUIStore.getState().reset();

    const state = useUIStore.getState();
    expect(state.sidebarExpanded).toBe(true);
    expect(state.globalLoading).toBe(false);
  });
});