// packages/web/src/components/chat/chat-header.tsx
'use client';

import { RefreshCw, Columns2, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import { TEMPLATE_LABELS } from '@/types';

interface ChatHeaderProps {
  project: Project | null;
  onRestart?: () => void;
  onShowPanel?: () => void;
  onShowDraft?: () => void;
}

export function ChatHeader({ project, onRestart, onShowPanel, onShowDraft }: ChatHeaderProps) {
  const isRunning = project?.status === 'running';

  return (
    <div className="h-[52px] border-b border-border-default bg-bg-card flex items-center px-5 justify-between">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full inline-block',
            isRunning ? 'bg-status-running animate-pulse' : 'bg-status-stopped'
          )} />
          <span className="text-text-primary text-[14px] font-semibold">
            {project?.name || '未选择项目'}
          </span>
        </div>

        {project && (
          <>
            <span className="px-2 py-0.5 rounded-md bg-bg-secondary text-text-muted text-[11px] font-mono">
              {TEMPLATE_LABELS[project.templateType]}
            </span>

            {isRunning ? (
              <span className="px-2 py-0.5 rounded-md bg-accent-light text-accent-primary text-[11px] font-medium">
                运行中
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-bg-hover text-text-muted text-[11px] font-medium">
                已停止
              </span>
            )}
          </>
        )}
      </div>

      {/* Right side */}
      {project && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-3">
            <span className="w-6 h-6 rounded-full bg-accent-light flex items-center justify-center text-accent-primary text-[10px] font-bold">L</span>
            <span className="w-6 h-6 rounded-full bg-bg-hover flex items-center justify-center text-text-secondary text-[10px] font-bold">K</span>
            <span className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center text-text-muted text-[10px] font-bold">+2</span>
          </div>

          {onRestart && (
            <button
              onClick={onRestart}
              type="button"
              className="h-8 px-3 rounded-lg border border-border-default text-[13px] text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重启
            </button>
          )}

          {onShowPanel && (
            <button
              onClick={onShowPanel}
              type="button"
              className="h-8 px-3 rounded-lg border border-border-default text-[13px] text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1.5"
            >
              <Columns2 className="w-3.5 h-3.5" />
              展示面板
            </button>
          )}

          {onShowDraft && (
            <button
              onClick={onShowDraft}
              type="button"
              className="h-8 px-3 rounded-lg border border-border-default text-[13px] text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1.5"
            >
              <PenLine className="w-3.5 h-3.5" />
              草稿
            </button>
          )}
        </div>
      )}
    </div>
  );
}