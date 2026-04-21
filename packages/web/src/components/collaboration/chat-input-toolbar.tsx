'use client';

import { ImageIcon, Code, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessageType } from '@/types/draft';

interface ChatInputToolbarProps {
  messageType: MessageType;
  onToggleCodeMode: () => void;
  onOpenSlashCommand: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ChatInputToolbar({
  messageType,
  onToggleCodeMode,
  onOpenSlashCommand,
  fileInputRef,
  onImageSelect,
}: ChatInputToolbarProps) {
  return (
    <div className="flex gap-1 mt-2 px-1">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-11 h-11 rounded-xl border border-border-default text-text-secondary cursor-pointer transition-all flex items-center justify-center hover:bg-bg-hover hover:text-text-primary hover:border-border-light"
        title="上传图片 (支持粘贴)"
      >
        <ImageIcon className="w-4 h-4" />
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onImageSelect} />

      <button
        type="button"
        onClick={onToggleCodeMode}
        className={cn(
          'p-2 rounded-lg transition-colors',
          messageType === 'code' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
        )}
        title="代码模式"
      >
        <Code className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onOpenSlashCommand}
        className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="斜杠命令"
      >
        <Sparkles className="w-4 h-4" />
      </button>
    </div>
  );
}