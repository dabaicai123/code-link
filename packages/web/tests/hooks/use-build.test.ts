import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBuild } from '@/hooks/use-build';

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
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

describe('useBuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a build successfully', async () => {
    const mockResponse = { id: 1, projectId: 10, status: 'pending' };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useBuild(10));
    const build = await result.current.startBuild();

    expect(api.post).toHaveBeenCalledWith('/builds', { projectId: 10 });
    expect(build).toEqual(mockResponse);
  });

  it('returns null on start build error', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('构建失败'));

    const { result } = renderHook(() => useBuild(10));
    const build = await result.current.startBuild();

    expect(build).toBeNull();

    await waitFor(() => {
      expect(result.current.error).toBe('构建失败');
    });
  });

  it('gets builds for a project', async () => {
    const mockBuilds = [{ id: 1, projectId: 10, status: 'success' }];
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockBuilds);

    const { result } = renderHook(() => useBuild(10));
    const builds = await result.current.getBuilds();

    expect(api.get).toHaveBeenCalledWith('/builds/project/10');
    expect(builds).toEqual(mockBuilds);
  });

  it('returns empty array on get builds error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('获取构建列表失败'));

    const { result } = renderHook(() => useBuild(10));
    const builds = await result.current.getBuilds();

    expect(builds).toEqual([]);

    await waitFor(() => {
      expect(result.current.error).toBe('获取构建列表失败');
    });
  });

  it('gets preview URL', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ url: 'http://localhost:4001' });

    const { result } = renderHook(() => useBuild(10));
    const url = await result.current.getPreviewUrl();

    expect(url).toBe('http://localhost:4001');
  });

  it('returns null when preview not found (404)', async () => {
    const { ApiError } = await import('@/lib/api');
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('Not found', 404, 0));

    const { result } = renderHook(() => useBuild(10));
    const url = await result.current.getPreviewUrl();

    expect(url).toBeNull();
  });

  it('stops preview successfully', async () => {
    (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { result } = renderHook(() => useBuild(10));
    const success = await result.current.stopPreview();

    expect(success).toBe(true);
  });

  it('returns false on stop preview error', async () => {
    (api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('停止预览失败'));

    const { result } = renderHook(() => useBuild(10));
    const success = await result.current.stopPreview();

    expect(success).toBe(false);

    await waitFor(() => {
      expect(result.current.error).toBe('停止预览失败');
    });
  });
});