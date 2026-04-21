// packages/web/src/components/chat/tool-call-block.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ToolCall } from '@/types/chat';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

function toolTitle(tool: ToolCall): string {
  return tool.name || 'Tool';
}

function toolSubtitle(tool: ToolCall): string {
  if (tool.kind === 'command_execution') {
    try {
      const input = JSON.parse(tool.input);
      return input.command?.slice(0, 60) || '';
    } catch {
      return tool.input.slice(0, 60);
    }
  }
  if (tool.kind === 'file_change' || tool.kind === 'mcp_tool_call') {
    try {
      const input = JSON.parse(tool.input);
      return input.file_path || input.path || '';
    } catch {
      return '';
    }
  }
  return '';
}

function stateLabel(status: ToolCall['status']): string {
  switch (status) {
    case 'running': return '运行中';
    case 'completed': return '完成';
    case 'error': return '错误';
    default: return '';
  }
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [isOpen, setIsOpen] = useState(
    toolCall.name === 'AskUserQuestion' || (toolCall.status === 'running' && toolCall.kind === 'command_execution')
  );
  const subtitle = toolSubtitle(toolCall);

  return (
    <details
      data-tool-name={toolCall.name}
      data-status={toolCall.status}
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      className={cn(
        'tool-call rounded-lg border mb-2',
        toolCall.status === 'running' && 'border-[#5b7ea1]/40 bg-[#f5f0e8]',
        toolCall.status === 'completed' && 'border-[#ddd0c0] bg-[#faf6f0]',
        toolCall.status === 'error' && 'border-[#c0553a]/40 bg-[#f5ddd4]',
      )}
    >
      <summary data-action="toggle" className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none text-[13px]">
        <span className={cn(
          'tool-call-icon w-2 h-2 rounded-full',
          toolCall.status === 'running' ? 'bg-[#5b7ea1] animate-pulse' : 'bg-[#5d8a54]',
        )} />
        <span className="tool-call-summary-main flex-1 min-w-0">
          <span className="tool-call-label font-semibold text-[#2d1f14]">{toolTitle(toolCall)}</span>
          {subtitle && <span className="tool-call-subtitle text-[#9a8b7d] ml-2 truncate">{subtitle}</span>}
        </span>
        <span className={cn(
          'tool-call-state text-xs px-1.5 py-0.5 rounded',
          toolCall.status === 'running' ? 'text-[#5b7ea1] bg-[#5b7ea1]/10' :
          toolCall.status === 'completed' ? 'text-[#5d8a54] bg-[#5d8a54]/10' :
          'text-[#c0553a] bg-[#c0553a]/10',
        )}>
          {stateLabel(toolCall.status)}
        </span>
      </summary>
      <div className="px-3 pb-3 text-[13px] text-[#2d1f14]">
        {toolCall.kind === 'command_execution' ? (
          <div className="space-y-2">
            <div>
              <span className="text-[#9a8b7d] text-xs">Command</span>
              <pre className="bg-[#eee8d5] rounded p-2 mt-1 text-[12px] overflow-x-auto font-mono whitespace-pre-wrap">
                {(() => {
                  try { return JSON.parse(toolCall.input).command || toolCall.input; } catch { return toolCall.input; }
                })()}
              </pre>
            </div>
            {toolCall.output && (
              <div>
                <span className="text-[#9a8b7d] text-xs">Output</span>
                <pre className="bg-[#eee8d5] rounded p-2 mt-1 text-[12px] overflow-x-auto font-mono whitespace-pre-wrap max-h-[200px]">
                  {toolCall.output}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <pre className="bg-[#eee8d5] rounded p-2 text-[12px] overflow-x-auto font-mono whitespace-pre-wrap">
            {(() => {
              try { return JSON.stringify(JSON.parse(toolCall.input), null, 2); } catch { return toolCall.input; }
            })()}
          </pre>
        )}
      </div>
    </details>
  );
}