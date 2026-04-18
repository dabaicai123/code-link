'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * 项目仓库信息
 */
interface ProjectRepo {
  id: number;
  projectId: number;
  provider: 'github' | 'gitlab';
  repoUrl: string;
  repoName: string;
  branch: string;
  createdAt: string;
}

/**
 * 提供商图标和名称映射
 */
const PROVIDER_INFO: Record<ProjectRepo['provider'], { name: string; color: string }> = {
  github: { name: 'GitHub', color: 'text-gray-700' },
  gitlab: { name: 'GitLab', color: 'text-orange-500' },
};

interface RepoListProps {
  projectId: number;
  containerId: string | null;
}

/**
 * 项目仓库列表组件
 */
export function RepoList({ projectId, containerId }: RepoListProps) {
  const { user } = useAuth();
  const [repos, setRepos] = useState<ProjectRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushingRepoId, setPushingRepoId] = useState<number | null>(null);
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [showPushDialog, setShowPushDialog] = useState<number | null>(null);

  // 获取仓库列表
  useEffect(() => {
    if (projectId) {
      loadRepos();
    }
  }, [projectId]);

  const loadRepos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<ProjectRepo[]>(`/repos/${projectId}`);
      setRepos(data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '获取仓库列表失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePush = async (repo: ProjectRepo) => {
    if (!containerId) {
      setError('容器未启动，无法推送代码');
      return;
    }

    if (!commitMessage.trim()) {
      setError('请输入提交信息');
      return;
    }

    setPushingRepoId(repo.id);
    setError(null);

    try {
      await api.post(`/repos/${projectId}/push`, {
        repoUrl: repo.repoUrl,
        branch: repo.branch,
        containerId,
        commitMessage: commitMessage.trim(),
      });

      // 推送成功，关闭对话框
      setShowPushDialog(null);
      setCommitMessage('');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '推送代码失败';
      setError(message);
    } finally {
      setPushingRepoId(null);
    }
  };

  const handleRemoveRepo = async (repo: ProjectRepo) => {
    if (!confirm(`确定要移除仓库 "${repo.repoName}" 的关联吗？`)) {
      return;
    }

    try {
      await api.delete(`/repos/${projectId}?repoUrl=${encodeURIComponent(repo.repoUrl)}`);
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '移除仓库关联失败';
      setError(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg
          className="animate-spin h-6 w-6 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={loadRepos}
          className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          重试
        </button>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">暂无关联的仓库</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 错误提示 */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 仓库列表 */}
      {repos.map((repo) => (
        <div
          key={repo.id}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* 提供商和仓库名 */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${PROVIDER_INFO[repo.provider].color}`}
                >
                  {PROVIDER_INFO[repo.provider].name}
                </span>
                <span className="text-gray-900 font-medium truncate">
                  {repo.repoName}
                </span>
              </div>

              {/* 分支信息 */}
              <div className="mt-1 flex items-center text-sm text-gray-500">
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span>{repo.branch}</span>
              </div>

              {/* 仓库地址 */}
              <a
                href={repo.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 truncate block"
              >
                {repo.repoUrl}
              </a>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setShowPushDialog(repo.id)}
                disabled={!containerId || pushingRepoId === repo.id}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                  !containerId
                    ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    : pushingRepoId === repo.id
                    ? 'text-gray-400 bg-gray-100 cursor-wait'
                    : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                }`}
                title={!containerId ? '容器未启动' : '推送代码'}
              >
                {pushingRepoId === repo.id ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    推送中
                  </span>
                ) : (
                  '推送'
                )}
              </button>
              <button
                onClick={() => handleRemoveRepo(repo)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
              >
                移除
              </button>
            </div>
          </div>

          {/* 推送对话框 */}
          {showPushDialog === repo.id && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                提交信息
              </label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="输入提交信息，如：Update code"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    setShowPushDialog(null);
                    setCommitMessage('');
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => handlePush(repo)}
                  disabled={!commitMessage.trim() || pushingRepoId === repo.id}
                  className={`px-3 py-1.5 text-sm font-medium text-white rounded-md ${
                    !commitMessage.trim() || pushingRepoId === repo.id
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {pushingRepoId === repo.id ? '推送中...' : '确认推送'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}