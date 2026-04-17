'use client';

import { useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Build } from '@/types/build';

interface BuildResponse {
  id: number;
  projectId: number;
  status: string;
}

export function useBuild(projectId: number) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBuild = useCallback(async (): Promise<BuildResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<BuildResponse>('/builds', { projectId });
      return response;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '构建失败';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const getBuilds = useCallback(async (): Promise<Build[]> => {
    try {
      const response = await api.get<Build[]>(`/builds/project/${projectId}`);
      setError(null);
      return response;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '获取构建列表失败';
      setError(message);
      return [];
    }
  }, [projectId]);

  const getPreviewUrl = useCallback(async (): Promise<string | null> => {
    try {
      const response = await api.get<{ url: string }>(`/builds/preview/${projectId}`);
      setError(null);
      return response.url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      const message =
        err instanceof ApiError ? err.message : '获取预览 URL 失败';
      setError(message);
      return null;
    }
  }, [projectId]);

  const stopPreview = useCallback(async (): Promise<boolean> => {
    try {
      await api.delete(`/builds/preview/${projectId}`);
      setError(null);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '停止预览失败';
      setError(message);
      return false;
    }
  }, [projectId]);

  return {
    loading,
    error,
    startBuild,
    getBuilds,
    getPreviewUrl,
    stopPreview,
  };
}
