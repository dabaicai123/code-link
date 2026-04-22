'use client';

import { useCallback } from 'react';
import { Power, PowerOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCodeServerStatus, useStartCodeServer, useStopCodeServer } from '@/lib/queries/use-code';
import type { Project } from '@/types';

interface CodePanelProps {
  project: Project | null;
  userId: number;
}

export function CodePanel({ project, userId }: CodePanelProps) {
  const projectId = project?.id ?? null;

  const statusQuery = useCodeServerStatus(projectId);
  const startMutation = useStartCodeServer(projectId);
  const stopMutation = useStopCodeServer(projectId);

  const handleStart = useCallback(() => {
    startMutation.mutate();
  }, [startMutation]);

  const handleStop = useCallback(() => {
    stopMutation.mutate();
  }, [stopMutation]);

  const isStarting = startMutation.isPending;
  const isRunning = statusQuery.data?.running ?? false;
  const url = statusQuery.data?.url ?? null;

  return (
    <div className="h-full flex flex-col bg-code-bg-base">
      {/* Toolbar overlay */}
      <div className="h-[32px] flex items-center gap-2 px-2 bg-code-bg-surface border-b border-code-border shrink-0">
        <span className="text-[11px] text-code-text-secondary font-mono">
          {project?.name ?? '未选择项目'}
        </span>

        {isRunning ? (
          <button
            onClick={handleStop}
            disabled={stopMutation.isPending}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] rounded text-code-text-primary bg-code-bg-hover hover:bg-code-bg-active transition-colors"
          >
            <PowerOff className="w-3 h-3" />
            {stopMutation.isPending ? '停止中...' : '停止'}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] rounded text-white bg-code-accent hover:bg-code-accent-hover transition-colors disabled:opacity-50"
          >
            {isStarting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Power className="w-3 h-3" />
            )}
            {isStarting ? '启动中...' : '启动'}
          </button>
        )}
      </div>

      {/* iframe or placeholder */}
      {isRunning && url ? (
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          title="code-server"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-code-text-muted text-[13px]">
          {isStarting ? '正在启动 code-server...' : '点击「启动」以打开 VS Code 编辑器'}
        </div>
      )}
    </div>
  );
}