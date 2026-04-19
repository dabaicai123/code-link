'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
        toast.error(err.message);
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
        toast.error(err.message);
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
        className={cn(
          'project-card',
          isActive && 'active'
        )}
        onClick={onClick}
      >
        {/* 项目名称行 */}
        <div className="flex items-center mb-1">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className="text-[10px] text-[var(--text-muted)] mr-1 cursor-pointer w-4 text-center"
          >
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="text-[var(--text-primary)] text-[13px] font-medium">
            {project.name}
          </span>
          {/* 状态指示器 */}
          <span
            className={cn(
              'w-[6px] h-[6px] rounded-full ml-auto',
              isRunning && 'animate-pulse'
            )}
            style={{ background: statusColor }}
          />
        </div>

        {/* 模板类型 */}
        <div className="text-[var(--text-secondary)] text-[11px] ml-5">
          {TEMPLATE_LABELS[project.templateType]}
        </div>

        {/* 仓库数量摘要（折叠时显示） */}
        {!isExpanded && repos.length > 0 && (
          <div className="text-[var(--text-muted)] text-[11px] ml-5 mt-1">
            📦 {repos.length} 个仓库
          </div>
        )}

        {/* 展开的仓库列表 */}
        {isExpanded && (
          <div className="mt-2">
            {loadingRepos ? (
              <div className="text-[var(--text-muted)] text-xs py-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddRepo(true);
                  }}
                  className="w-[calc(100%-24px)] h-auto py-1.5 px-0 border border-dashed border-[var(--border-light)] text-[var(--text-muted)] text-[11px] mt-1 ml-6 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  + 添加仓库
                </Button>
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