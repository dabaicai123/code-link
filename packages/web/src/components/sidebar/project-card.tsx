'use client';

import { useState, memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RepoItem } from './repo-item';
import { AddRepoDialog } from './add-repo-dialog';
import { useRepos, useCloneRepo, useDeleteRepo } from '@/lib/queries';
import { ApiError } from '@/lib/api';
import type { Project } from '@/types';
import { TEMPLATE_LABELS } from '@/types';

interface ProjectCardProps {
  project: Project;
  isActive?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  onRefresh?: () => void;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  isActive,
  isExpanded,
  onToggleExpand,
  onClick,
  onRefresh
}: ProjectCardProps) {
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);

  const { data: repos = [], isLoading: loadingRepos, refetch: refetchRepos } = useRepos(project.id);
  const cloneRepo = useCloneRepo();
  const deleteRepo = useDeleteRepo();

  const isRunning = project.status === 'running';

  const handleClone = async (repoId: number) => {
    setCloningRepoId(repoId);
    try {
      await cloneRepo.mutateAsync({ projectId: project.id, repoId });
    } catch (err) {
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
      await deleteRepo.mutateAsync({ projectId: project.id, repoId });
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      }
    }
  };

  const handleAddRepoSuccess = () => {
    setShowAddRepo(false);
    refetchRepos();
    onRefresh?.();
  };

  return (
    <>
      <div
        className={cn(
          'py-2.5 px-3 rounded-lg cursor-pointer mb-1.5 transition-all border border-transparent',
          isActive && 'bg-accent-light/80 border-accent-primary/20',
          !isActive && 'hover:bg-bg-hover'
        )}
        onClick={onClick}
      >
        <div className="flex items-center mb-1">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className="text-muted-foreground mr-1 cursor-pointer w-4 h-4 flex items-center justify-center"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <span className="text-foreground text-[13px]">
            {project.name}
          </span>
          <span
            className={cn(
              'ml-auto w-1.5 h-1.5 rounded-full inline-block',
              isRunning && 'bg-status-running animate-pulse',
              !isRunning && 'bg-status-stopped'
            )}
          />
        </div>

        <div className="text-muted-foreground text-[11px] ml-5">
          {TEMPLATE_LABELS[project.templateType]}
        </div>

        {/* 展开的仓库列表 */}
        {isExpanded && (
          <div className="mt-2">
            {loadingRepos ? (
              <div className="text-muted-foreground text-xs py-2">
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
                  className="w-[calc(100%-24px)] h-auto py-1.5 px-0 border border-dashed border-border-light text-muted-foreground text-[11px] mt-1 ml-6 hover:bg-hover hover:text-foreground"
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
});