import { create } from 'zustand';

interface UIState {
  sidebarExpanded: boolean;
  globalLoading: boolean;
  toggleSidebar: () => void;
  setGlobalLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  sidebarExpanded: true,
  globalLoading: false,
};

export const useUIStore = create<UIState>()((set) => ({
  ...initialState,

  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

  setGlobalLoading: (loading) =>
    set({ globalLoading: loading }),

  reset: () => set(initialState),
}));
