// packages/web/src/components/chat/chat-header.tsx
'use client';

import { cn } from '@/lib/utils';
import type { AgentType, PermissionMode } from '@/types/chat';
import type { Project } from '@/types';

interface ChatHeaderProps {
  project: Project | null;
  agent: AgentType;
  permissionMode: PermissionMode;
  onAgentChange: (agent: AgentType) => void;
  onModeChange: (mode: PermissionMode) => void;
  onRestart?: () => void;
}

const MODE_LABELS: Record<PermissionMode, string> = {
  default: 'Default',
  plan: 'Plan',
  yolo: 'YOLO',
};

const AGENT_LABELS: Record<AgentType, string> = {
  claude: 'Claude',
  codex: 'Codex',
};

export function ChatHeader({ project, agent, permissionMode, onAgentChange, onModeChange, onRestart }: ChatHeaderProps) {
  const isRunning = project?.status === 'running';

  return (
    <div className="px-2 py-1.5 bg-bg-secondary border-b border-border-default flex items-center gap-2 justify-between bg-[#f2ebe2] border-b border-[#ddd0c0]">
      <div className="flex items-center gap-2">
        <span className={cn(
          'w-1.5 h-1.5 rounded-full inline-block',
          isRunning && 'bg-status-running animate-pulse',
          !isRunning && 'bg-status-stopped'
        )} />
        <span className="text-[#2d1f14] text-[13px] font-medium">{project?.name || '未选择项目'}</span>

        <button
          onClick={() => onAgentChange(agent === 'claude' ? 'codex' : 'claude')}
          className="chat-agent-btn px-2 py-1 rounded-md bg-[#e9e0d4] text-[#2d1f14] text-[12px] font-semibold hover:bg-[#ddd0c0] transition-colors"
          type="button"
        >
          {AGENT_LABELS[agent]}
        </button>

        <select
          value={permissionMode}
          onChange={(e) => onModeChange(e.target.value as PermissionMode)}
          className="mode-select px-2 py-1 rounded-md bg-[#e9e0d4] text-[#2d1f14] text-[12px] border border-[#ddd0c0] outline-none cursor-pointer"
        >
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {onRestart && (
        <button
          onClick={onRestart}
          type="button"
          className="px-2.5 py-1 rounded-md bg-[#e9e0d4] text-[#2d1f14] text-[11px] hover:bg-[#ddd0c0] transition-colors"
        >
          重启
        </button>
      )}
    </div>
  );
}