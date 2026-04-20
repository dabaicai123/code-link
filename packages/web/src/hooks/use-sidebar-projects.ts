'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Project } from '@/types';

interface UseSidebarProjectsOptions {
  organizationId: number | null;
  refreshKey?: number;
}

export function useSidebarProjects({ organizationId, refreshKey }: UseSidebarProjectsOptions) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!organizationId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.get<Project[]>(`/projects?organizationId=${organizationId}`);
      setProjects(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '获取项目列表失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, refreshKey]);

  const runningProjects = projects.filter((p) => p.status === 'running');
  const stoppedProjects = projects.filter((p) => p.status !== 'running');

  return {
    projects,
    runningProjects,
    stoppedProjects,
    loading,
    error,
    refetch: fetchProjects,
  };
}
