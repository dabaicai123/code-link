'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';

interface ProjectRepo {
  id: number;
  projectId: number;
  provider: 'github' | 'gitlab';
  repoUrl: string;
  repoName: string;
  branch: string;
  createdAt: string;
}

const PROVIDER_INFO: Record<ProjectRepo['provider'], { name: string; color: string }> = {
  github: { name: 'GitHub', color: 'var(--text-primary)' },
  gitlab: { name: 'GitLab', color: 'var(--status-warning)' },
};

interface RepoListProps {
  projectId: number;
  containerId: string | null;
}

export function RepoList({ projectId, containerId }: RepoListProps) {
  const user = useAuthStore((s) => s.user);
  const [repos, setRepos] = useState<ProjectRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushingRepoId, setPushingRepoId] = useState<number | null>(null);
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [showPushDialog, setShowPushDialog] = useState<number | null>(null);

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
      const message = err instanceof ApiError ? err.message : '获取仓库列表失败';
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
      setShowPushDialog(null);
      setCommitMessage('');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '推送代码失败';
      setError(message);
    } finally {
      setPushingRepoId(null);
    }
  };

  const handleRemoveRepo = async (repo: ProjectRepo) => {
    if (!confirm(`确定要移除仓库 "${repo.repoName}" 的关联吗？`)) return;
    try {
      await api.delete(`/repos/${projectId}?repoUrl=${encodeURIComponent(repo.repoUrl)}`);
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '移除仓库关联失败';
      setError(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-6 w-6 text-accent-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error && repos.length === 0) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-md p-4">
        <p className="text-[13px] text-destructive">{error}</p>
        <button onClick={loadRepos} className="mt-2 text-[13px] text-destructive font-medium cursor-pointer">
          重试
        </button>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="mt-2 text-[13px] text-text-secondary">暂无关联的仓库</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-md p-3 mb-4">
          <p className="text-[13px] text-destructive">{error}</p>
        </div>
      )}

      {repos.map((repo) => (
        <div
          key={repo.id}
          className="bg-bg-card border border-border-default rounded-md p-4 transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium" style={{ color: PROVIDER_INFO[repo.provider].color }}>
                  {PROVIDER_INFO[repo.provider].name}
                </span>
                <span className="text-text-primary font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                  {repo.repoName}
                </span>
              </div>

              <div className="mt-1 flex items-center text-[13px] text-text-secondary">
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{repo.branch}</span>
              </div>

              <a
                href={repo.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-accent-primary overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {repo.repoUrl}
              </a>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setShowPushDialog(repo.id)}
                disabled={!containerId || pushingRepoId === repo.id}
                className="px-3 py-1.5 text-[13px] font-medium rounded-md border-none cursor-pointer transition-colors"
                style={{
                  backgroundColor: !containerId || pushingRepoId === repo.id ? 'var(--bg-hover)' : 'var(--accent-light)',
                  color: !containerId || pushingRepoId === repo.id ? 'var(--text-muted)' : 'var(--accent-primary)',
                  cursor: !containerId || pushingRepoId === repo.id ? 'not-allowed' : 'pointer',
                }}
                title={!containerId ? '容器未启动' : '推送代码'}
              >
                {pushingRepoId === repo.id ? (
                  <span className="flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    推送中
                  </span>
                ) : '推送'}
              </button>
              <button
                onClick={() => handleRemoveRepo(repo)}
                className="px-3 py-1.5 text-[13px] font-medium bg-destructive/10 text-destructive rounded-md border-none cursor-pointer"
              >
                移除
              </button>
            </div>
          </div>

          {showPushDialog === repo.id && (
            <div className="mt-4 p-3 bg-bg-secondary rounded-md">
              <label className="block text-[13px] font-medium text-text-primary mb-2">提交信息</label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="输入提交信息，如：Update code"
                className="w-full px-3 py-2 text-[13px] bg-bg-primary border border-border-default rounded-md text-text-primary"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => { setShowPushDialog(null); setCommitMessage(''); }}
                  className="px-3 py-1.5 text-[13px] font-medium rounded-md border border-border-default bg-bg-card text-text-secondary cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={() => handlePush(repo)}
                  disabled={!commitMessage.trim() || pushingRepoId === repo.id}
                  style={{
                    backgroundColor: !commitMessage.trim() || pushingRepoId === repo.id ? 'var(--text-muted)' : 'var(--accent-primary)',
                    color: 'white',
                    cursor: !commitMessage.trim() || pushingRepoId === repo.id ? 'not-allowed' : 'pointer',
                  }}
                  className="px-3 py-1.5 text-[13px] font-medium rounded-md border-none"
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