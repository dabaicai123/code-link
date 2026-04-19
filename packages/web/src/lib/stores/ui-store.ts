import { create } from 'zustand';

interface UIState {
  // Sidebar 状态
  sidebarExpanded: boolean;
  toggleSidebar: () => void;

  // 模态框状态
  createProjectDialogOpen: boolean;
  setCreateProjectDialogOpen: (open: boolean) => void;

  createOrgDialogOpen: boolean;
  setCreateOrgDialogOpen: (open: boolean) => void;

  // 全局加载状态
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // 重置所有状态
  reset: () => void;
}

const initialState = {
  sidebarExpanded: true,
  createProjectDialogOpen: false,
  createOrgDialogOpen: false,
  globalLoading: false,
};

export const useUIStore = create<UIState>()((set) => ({
  ...initialState,

  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

  setCreateProjectDialogOpen: (open) =>
    set({ createProjectDialogOpen: open }),

  setCreateOrgDialogOpen: (open) =>
    set({ createOrgDialogOpen: open }),

  setGlobalLoading: (loading) =>
    set({ globalLoading: loading }),

  reset: () => set(initialState),
}));
