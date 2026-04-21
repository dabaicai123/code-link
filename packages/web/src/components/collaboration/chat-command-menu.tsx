'use client';

import { Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  cmd: string;
  desc: string;
  isSkill: boolean;
}

interface ChatCommandMenuProps {
  show: boolean;
  commands: CommandItem[];
  selectedIndex: number;
  onSelect: (cmd: CommandItem) => void;
  skillsLoading?: boolean;
  skillsError?: string | null;
  onRetry?: () => void;
}

export function ChatCommandMenu({
  show,
  commands,
  selectedIndex,
  onSelect,
  skillsLoading,
  skillsError,
  onRetry,
}: ChatCommandMenuProps) {
  if (!show) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 min-w-[280px] max-w-[360px] bg-bg-card border border-border-default rounded-xl shadow-warm overflow-auto z-50">
      {skillsLoading && (
        <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          加载命令列表...
        </div>
      )}

      {skillsError && !skillsLoading && (
        <div className="p-2 text-xs text-destructive">
          {skillsError}
          <button type="button" onClick={onRetry} className="ml-2 underline hover:no-underline">重试</button>
        </div>
      )}

      {!skillsLoading && commands.length > 0 && (
        <div className="p-1.5 max-h-[280px] overflow-auto">
          {commands.some(c => c.isSkill) && (
            <div className="mb-1">
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">
                <Zap className="w-3 h-3 inline mr-1" />Skills
              </div>
              {commands.filter(c => c.isSkill).map((cmd) => {
                const globalIdx = commands.indexOf(cmd);
                return (
                  <button
                    key={cmd.cmd}
                    type="button"
                    onClick={() => onSelect(cmd)}
                    className={cn(
                      'flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors w-full',
                      globalIdx === selectedIndex ? 'bg-accent-primary text-text-primary' : 'hover:bg-bg-hover'
                    )}
                  >
                    <span className="font-semibold text-sm text-accent-primary whitespace-nowrap">{cmd.cmd}</span>
                    <span className="text-[13px] text-text-secondary flex-1 overflow-hidden text-ellipsis">{cmd.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
          {commands.some(c => !c.isSkill) && (
            <div>
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">系统命令</div>
              {commands.filter(c => !c.isSkill).map((cmd) => {
                const globalIdx = commands.indexOf(cmd);
                return (
                  <button
                    key={cmd.cmd}
                    type="button"
                    onClick={() => onSelect(cmd)}
                    className={cn(
                      'flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors w-full',
                      globalIdx === selectedIndex ? 'bg-accent-primary text-text-primary' : 'hover:bg-bg-hover'
                    )}
                  >
                    <span className="font-semibold text-sm text-accent-primary whitespace-nowrap">{cmd.cmd}</span>
                    <span className="text-[13px] text-text-secondary flex-1 overflow-hidden text-ellipsis">{cmd.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!skillsLoading && commands.length === 0 && (
        <div className="p-3 text-xs text-muted-foreground text-center">没有匹配的命令</div>
      )}

      <div className="px-3 py-2 border-t border-border-default text-[10px] text-text-muted flex gap-3">
        <span>↑↓ 选择</span><span>Tab/Enter 确认</span><span>Esc 关闭</span>
      </div>
    </div>
  );
}