'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

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
  const { user } = useAuth();
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
    if (!confirm(`确定要移除仓库 "${repo.repoName}" 的关联吗？`)) {
      return;
    }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
        <svg style={{ animation: 'spin 1s linear infinite', height: '24px', width: '24px', color: 'var(--accent-color)' }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error && repos.length === 0) {
    return (
      <div style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--status-error)' }}>{error}</p>
        <button onClick={loadRepos} style={{ marginTop: '8px', fontSize: '13px', color: 'var(--status-error)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          重试
        </button>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <svg style={{ margin: '0 auto', height: '40px', width: '40px', color: 'var(--text-disabled)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>暂无关联的仓库</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {error && (
        <div style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--status-error)' }}>{error}</p>
        </div>
      )}

      {repos.map((repo) => (
        <div
          key={repo.id}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            transition: 'box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: PROVIDER_INFO[repo.provider].color }}>
                  {PROVIDER_INFO[repo.provider].name}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.repoName}
                </span>
              </div>

              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <svg style={{ height: '16px', width: '16px', marginRight: '4px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{repo.branch}</span>
              </div>

              <a
                href={repo.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: '4px', fontSize: '12px', color: 'var(--accent-color)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {repo.repoUrl}
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
              <button
                onClick={() => setShowPushDialog(repo.id)}
                disabled={!containerId || pushingRepoId === repo.id}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: !containerId || pushingRepoId === repo.id ? 'not-allowed' : 'pointer',
                  backgroundColor: !containerId || pushingRepoId === repo.id ? 'var(--bg-hover)' : 'rgba(124, 58, 237, 0.1)',
                  color: !containerId || pushingRepoId === repo.id ? 'var(--text-disabled)' : 'var(--accent-color)',
                }}
                title={!containerId ? '容器未启动' : '推送代码'}
              >
                {pushingRepoId === repo.id ? (
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <svg style={{ animation: 'spin 1s linear infinite', height: '16px', width: '16px', marginRight: '4px' }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    推送中
                  </span>
                ) : '推送'}
              </button>
              <button
                onClick={() => handleRemoveRepo(repo)}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(248, 113, 113, 0.1)',
                  color: 'var(--status-error)',
                }}
              >
                移除
              </button>
            </div>
          </div>

          {showPushDialog === repo.id && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                提交信息
              </label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="输入提交信息，如：Update code"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => {
                    setShowPushDialog(null);
                    setCommitMessage('');
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => handlePush(repo)}
                  disabled={!commitMessage.trim() || pushingRepoId === repo.id}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: !commitMessage.trim() || pushingRepoId === repo.id ? 'not-allowed' : 'pointer',
                    backgroundColor: !commitMessage.trim() || pushingRepoId === repo.id ? 'var(--text-disabled)' : 'var(--accent-color)',
                    color: 'white',
                  }}
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