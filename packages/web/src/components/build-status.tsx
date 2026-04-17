'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProjectSync } from '@/hooks/use-project-sync';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Build } from '@/types/build';

interface BuildStatusProps {
  projectId: number;
}

/**
 * 状态中文映射
 */
const STATUS_MAP: Record<Build['status'], string> = {
  pending: '等待中',
  running: '构建中',
  success: '成功',
  failed: '失败',
};

/**
 * 状态样式映射
 */
const STATUS_STYLE_MAP: Record<Build['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function BuildStatus({ projectId }: BuildStatusProps) {
  const { user } = useAuth();
  const { buildStatus, isConnected } = useProjectSync(
    projectId,
    user ? parseInt(user.id, 10) : 0,
    user?.username || ''
  );

  const [builds, setBuilds] = useState<Build[]>([]);

  useEffect(() => {
    loadBuilds();
  }, [projectId]);

  useEffect(() => {
    if (buildStatus?.status === 'success' || buildStatus?.status === 'failed') {
      loadBuilds();
    }
  }, [buildStatus]);

  const loadBuilds = useCallback(async () => {
    try {
      const response = await api.get<Build[]>(`/builds/project/${projectId}`);
      setBuilds(response);
    } catch (err) {
      console.error('获取构建列表失败:', err);
    }
  }, [projectId]);

  return (
    <div className="build-status">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">构建状态</h3>

      {!isConnected && (
        <div className="warning p-3 bg-yellow-50 text-yellow-700 rounded-md mb-4">
          WebSocket 未连接
        </div>
      )}

      {buildStatus && (
        <div
          className={`current-status p-3 rounded-md mb-4 ${STATUS_STYLE_MAP[buildStatus.status]}`}
        >
          当前状态: {STATUS_MAP[buildStatus.status]}
          {buildStatus.previewPort && (
            <span className="ml-2">(端口: {buildStatus.previewPort})</span>
          )}
        </div>
      )}

      <h4 className="text-md font-medium text-gray-700 mb-2">构建历史</h4>
      {builds.length === 0 ? (
        <div className="text-gray-500 text-sm">暂无构建记录</div>
      ) : (
        <ul className="space-y-2">
          {builds.map((build) => (
            <li
              key={build.id}
              className="build-item flex items-center gap-3 p-3 bg-gray-50 rounded-md"
            >
              <span className="text-gray-600 font-mono text-sm">#{build.id}</span>
              <span
                className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_STYLE_MAP[build.status]}`}
              >
                {STATUS_MAP[build.status]}
              </span>
              <span className="text-gray-500 text-sm">
                {new Date(build.created_at).toLocaleString('zh-CN')}
              </span>
              {build.preview_port && (
                <span className="text-gray-500 text-sm">:{build.preview_port}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
