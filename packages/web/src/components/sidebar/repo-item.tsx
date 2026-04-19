'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';

interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repoName: string;
  repoUrl: string;
  cloned: boolean;
}

interface RepoItemProps {
  repo: Repo;
  onClone?: () => void;
  onDelete?: () => void;
  isCloning?: boolean;
}

const PROVIDER_CONFIG = {
  github: {
    icon: 'GH',
    color: 'text-muted-foreground',
    label: 'GitHub',
  },
  gitlab: {
    icon: 'GL',
    color: 'text-orange-500',
    label: 'GitLab',
  },
};

export function RepoItem({ repo, onClone, onDelete, isCloning }: RepoItemProps) {
  const config = PROVIDER_CONFIG[repo.provider];

  return (
    <div className="px-3 py-2 pl-6 flex items-center gap-2 bg-secondary rounded mb-1">
      <span className={cn('text-[10px] font-semibold w-5 text-center', config.color)}>
        {config.icon}
      </span>
      <span className="text-foreground text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {repo.repoName}
      </span>
      {repo.cloned ? (
        onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive text-[11px] opacity-60 hover:opacity-100 h-auto py-1 px-2"
          >
            删除
          </Button>
        )
      ) : onClone && (
        <Button
          variant="default"
          size="sm"
          onClick={onClone}
          disabled={isCloning}
          className="h-auto py-1 px-2 text-[10px]"
        >
          {isCloning ? (
            <>
              <LoadingSpinner size="sm" className="mr-1" />
              clone中...
            </>
          ) : (
            'clone'
          )}
        </Button>
      )}
    </div>
  );
}
