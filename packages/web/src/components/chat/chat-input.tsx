// packages/web/src/components/chat/chat-input.tsx
'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Send, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlashCommandMenu } from './slash-command-menu';
import { AttachmentTray } from './attachment-tray';
import type { SelectedElement } from '@/types/claude-message';
import type { Attachment } from '@/types/chat';

interface ChatInputProps {
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSend: (message: string, elements: SelectedElement[], attachments: Attachment[]) => void;
  onAbort: () => void;
  isRunning: boolean;
}

export function ChatInput({ elements, onRemoveElement, onSend, onAbort, isRunning }: ChatInputProps) {
  const [text, setText] = useState('');
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
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
    <div data-testid="chat-input" className="relative bg-bg-secondary border-t border-border-default px-4 pb-[max(14px,env(safe-area-inset-bottom,14px))] pt-2.5">
      {showCmdMenu && cmdFilter && (
        <SlashCommandMenu
          filter={cmdFilter}
          onSelect={handleCmdSelect}
          onClose={() => setShowCmdMenu(false)}
        />
      )}

      <AttachmentTray
        attachments={attachments}
        onAdd={handleAddFiles}
        onRemove={handleRemoveAttachment}
      />

      <div className="flex gap-2 items-end max-w-[800px] mx-auto">
        {elements.map((el) => (
          <span key={el.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent-primary/15 border border-accent-primary rounded-sm font-mono text-[11px] text-accent-primary whitespace-nowrap">
            &lt;{el.tagName}&gt;
            <X className="w-3 h-3" onClick={() => onRemoveElement(el.id)} />
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
          placeholder={elements.length > 0 ? '描述修改...' : '输入消息… 输入 / 查看指令'}
          rows={1}
          className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-text-primary text-[13px] placeholder:text-text-muted resize-none py-2"
        />

        {isRunning ? (
          <button onClick={onAbort} type="button" className="send-btn w-[44px] h-[44px] rounded-xl bg-accent-primary text-white flex items-center justify-center">
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && elements.length === 0 && attachments.length === 0}
            type="button"
            className={cn(
              'send-btn w-[44px] h-[44px] rounded-xl flex items-center justify-center transition-colors',
              text.trim() || elements.length > 0
                ? 'bg-accent-primary text-white'
                : 'bg-bg-hover text-text-muted'
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}