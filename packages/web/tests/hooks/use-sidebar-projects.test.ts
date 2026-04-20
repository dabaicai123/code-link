import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSidebarProjects } from '@/hooks/use-sidebar-projects';

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code: number;
    constructor(message: string, status: number, code: number) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { api } from '@/lib/api';

describe('useSidebarProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty projects when no organizationId', () => {
    const { result } = renderHook(() =>
      useSidebarProjects({ organizationId: null })
    );

    expect(result.current.projects).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetches projects for an organization', async () => {
    const mockProjects = [
      { id: 1, name: 'Project 1', status: 'running', organizationId: 10 },
      { id: 2, name: 'Project 2', status: 'stopped', organizationId: 10 },
    ];
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProjects);

    const { result } = renderHook(() =>
      useSidebarProjects({ organizationId: 10 })
    );

    // Wait for the effect to run
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledWith('/projects?organizationId=10');
    expect(result.current.projects).toEqual(mockProjects);
    expect(result.current.runningProjects).toEqual([mockProjects[0]]);
    expect(result.current.stoppedProjects).toEqual([mockProjects[1]]);
  });

  it('handles fetch error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('获取项目列表失败'));

    const { result } = renderHook(() =>
      useSidebarProjects({ organizationId: 10 })
    );

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('获取项目列表失败');
    expect(result.current.projects).toEqual([]);
  });

  it('refetches when refreshKey changes', async () => {
    const mockProjects = [{ id: 1, name: 'Project 1', status: 'running', organizationId: 10 }];
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProjects);

    const { result, rerender } = renderHook(
      ({ organizationId, refreshKey }) =>
        useSidebarProjects({ organizationId, refreshKey }),
      { initialProps: { organizationId: 10, refreshKey: 1 } }
    );

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledTimes(1);

    rerender({ organizationId: 10, refreshKey: 2 });

    await vi.waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });
});