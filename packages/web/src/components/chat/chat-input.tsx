'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Send, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlashCommandMenu } from './slash-command-menu';
import { AttachmentTray } from './attachment-tray';
import type { SelectedElement } from '@/types/claude-message';
import type { Attachment, AgentType, PermissionMode } from '@/types/chat';

interface ChatInputProps {
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSend: (message: string, elements: SelectedElement[], attachments: Attachment[]) => void;
  onAbort: () => void;
  isRunning: boolean;
  agent: AgentType;
  permissionMode: PermissionMode;
  onAgentChange: (agent: AgentType) => void;
  onModeChange: (mode: PermissionMode) => void;
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

export function ChatInput({
  elements,
  onRemoveElement,
  onSend,
  onAbort,
  isRunning,
  agent,
  permissionMode,
  onAgentChange,
  onModeChange,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const cmdFilter = text.startsWith('/') ? text : '';

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCmdMenu) return;

    if (e.key === 'Backspace' && text === '' && elements.length > 0) {
      onRemoveElement(elements[elements.length - 1].id);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && elements.length === 0 && attachments.length === 0) return;
    onSend(trimmed, elements, attachments);
    setText('');
    setAttachments([]);
  }, [text, elements, attachments, onSend]);

  const handleCmdSelect = useCallback((cmd: string) => {
    setShowCmdMenu(false);
    onSend(cmd, [], []);
  }, [onSend]);

  const handleAddFiles = useCallback((files: File[]) => {
    const newAttachments: Attachment[] = files.map((file, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'image' as const,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      status: 'pending' as const,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <div data-testid="chat-input" className="border-t border-border-default bg-bg-card px-5 py-4">
      {showCmdMenu && cmdFilter && (
        <SlashCommandMenu
          filter={cmdFilter}
          onSelect={handleCmdSelect}
          onClose={() => setShowCmdMenu(false)}
        />
      )}

      {/* Agent & Mode toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => onAgentChange(agent === 'claude' ? 'codex' : 'claude')}
          className={cn(
            'px-2 py-0.5 rounded-md text-[12px] font-semibold transition-colors',
            agent === 'claude'
              ? 'bg-accent-light text-accent-primary'
              : 'bg-bg-hover text-text-secondary'
          )}
          type="button"
        >
          {AGENT_LABELS[agent]}
        </button>
        <select
          value={permissionMode}
          onChange={(e) => onModeChange(e.target.value as PermissionMode)}
          className="px-2 py-0.5 rounded-md bg-bg-hover text-text-secondary text-[12px] border border-border-default outline-none cursor-pointer"
        >
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <AttachmentTray
        attachments={attachments}
        onAdd={handleAddFiles}
        onRemove={handleRemoveAttachment}
      />

      <div className="flex items-end gap-3">
        {/* Input wrapper with border */}
        <div className="flex-1 min-h-[44px] max-h-[120px] bg-bg-primary border border-border-default rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-1">
          {elements.map((el) => (
            <span key={el.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent-primary/15 border border-accent-primary rounded-sm font-mono text-[11px] text-accent-primary whitespace-nowrap">
              &lt;{el.tagName}&gt;
              <X className="w-3 h-3 cursor-pointer" onClick={() => onRemoveElement(el.id)} />
            </span>
          ))}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.startsWith('/')) {
                setShowCmdMenu(true);
              } else {
                setShowCmdMenu(false);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={elements.length > 0 ? '描述修改...' : '输入消息或 / 使用命令...'}
            rows={1}
            className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-text-primary text-[14px] placeholder:text-text-muted resize-none"
          />
        </div>

        {isRunning ? (
          <button
            onClick={onAbort}
            type="button"
            className="h-[44px] px-4 bg-bg-hover rounded-lg text-[14px] font-medium text-text-secondary hover:bg-border-default transition-colors flex items-center gap-1.5"
          >
            <Square className="w-4 h-4" />
            停止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && elements.length === 0 && attachments.length === 0}
            type="button"
            className={cn(
              'h-[44px] px-4 rounded-lg text-[14px] font-medium shadow-warm-sm transition-colors flex items-center gap-1.5',
              text.trim() || elements.length > 0 || attachments.length > 0
                ? 'bg-accent-primary hover:bg-accent-hover text-white'
                : 'bg-bg-hover text-text-muted cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
            发送
          </button>
        )}
      </div>
    </div>
  );
}