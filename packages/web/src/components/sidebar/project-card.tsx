'use client';

import { useState, useEffect } from 'react';
import { RepoItem } from './repo-item';
import { AddRepoDialog } from './add-repo-dialog';
import { api, ApiError, Repo } from '@/lib/api';

interface Project {
  id: number;
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

interface ProjectCardProps {
  project: Project;
  isActive?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  onRefresh?: () => void;
}

const TEMPLATE_LABELS: Record<Project['templateType'], string> = {
  node: 'Node.js',
  'node+java': 'Java',
  'node+python': 'Python',
};

export function ProjectCard({
  project,
  isActive,
  isExpanded,
  onToggleExpand,
  onClick,
  onRefresh
}: ProjectCardProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);

  const statusColor = {
    running: 'var(--status-running)',
    stopped: 'var(--status-stopped)',
    created: 'var(--text-muted)',
  }[project.status];

  const isRunning = project.status === 'running';

  // 加载仓库列表
  useEffect(() => {
    if (isExpanded) {
      fetchRepos();
    }
  }, [isExpanded]);

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const data = await api.getRepos(project.id);
      setRepos(data);
    } catch (err) {
      console.error('Failed to fetch repos:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleClone = async (repoId: number) => {
    setCloningRepoId(repoId);
    try {
      await api.cloneRepo(project.id, repoId);
    } catch (err) {
      console.error('Clone failed:', err);
      if (err instanceof ApiError) {
        alert(err.message);
      }
    } finally {
      setCloningRepoId(null);
    }
  };

  const handleDeleteRepo = async (repoId: number) => {
    if (!confirm('确定要删除这个仓库吗？')) return;
    try {
      await api.deleteRepo(project.id, repoId);
      setRepos(repos.filter(r => r.id !== repoId));
    } catch (err) {
      console.error('Delete failed:', err);
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const handleAddRepoSuccess = () => {
    setShowAddRepo(false);
    fetchRepos();
    onRefresh?.();
  };

  return (
    <>
      <div
        style={{
          padding: '10px 12px',
          backgroundColor: isActive ? 'rgba(217, 119, 87, 0.08)' : 'transparent',
          border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          marginBottom: '6px',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
        onClick={onClick}
      >
        {/* 激活状态顶部指示条 */}
        {isActive && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'var(--accent-primary)',
          }} />
        )}

        {/* 项目名称行 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginRight: '4px',
              cursor: 'pointer',
              width: '16px',
              textAlign: 'center',
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
            {project.name}
          </span>
          {/* 状态指示器 */}
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: statusColor,
            marginLeft: 'auto',
            animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
        </div>

        {/* 模板类型 */}
        <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '20px' }}>
          {TEMPLATE_LABELS[project.templateType]}
        </div>

        {/* 仓库数量摘要（折叠时显示） */}
        {!isExpanded && repos.length > 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '20px', marginTop: '4px' }}>
            📦 {repos.length} 个仓库
          </div>
        )}

        {/* 展开的仓库列表 */}
        {isExpanded && (
          <div style={{ marginTop: '8px' }}>
            {loadingRepos ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 0' }}>
                加载中...
              </div>
            ) : (
              <>
                {repos.map((repo) => (
                  <RepoItem
                    key={repo.id}
                    repo={repo}
                    onClone={() => handleClone(repo.id)}
                    onDelete={() => handleDeleteRepo(repo.id)}
                    isCloning={cloningRepoId === repo.id}
                  />
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddRepo(true);
                  }}
                  style={{
                    width: 'calc(100% - 24px)',
                    padding: '6px',
                    background: 'transparent',
                    border: '1px dashed var(--border-light)',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    marginTop: '4px',
                    marginLeft: '24px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  + 添加仓库
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 添加仓库弹窗 */}
      {showAddRepo && (
        <AddRepoDialog
          projectId={project.id}
          isOpen={showAddRepo}
          onClose={() => setShowAddRepo(false)}
          onSuccess={handleAddRepoSuccess}
        />
      )}
    </>
  );
}