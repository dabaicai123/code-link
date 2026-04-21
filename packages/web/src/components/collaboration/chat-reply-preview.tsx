'use client';

import type { DraftMessage } from '@/types/draft';

interface ChatReplyPreviewProps {
  replyTo: DraftMessage | null;
  onCancel: () => void;
}

export function ChatReplyPreview({ replyTo, onCancel }: ChatReplyPreviewProps) {
  if (!replyTo) return null;

  return (
    <div className="flex items-center gap-2 mb-2 p-1.5 bg-background rounded-md">
      <span className="text-xs text-muted-foreground">回复 {replyTo.userName}:</span>
      <span className="text-xs text-foreground flex-1 truncate">
        {replyTo.content.slice(0, 50)}{replyTo.content.length > 50 ? '...' : ''}
      </span>
      <button type="button" onClick={onCancel} className="px-1.5 py-0.5 text-[10px] rounded bg-bg-hover text-text-muted hover:text-text-primary">
        取消
      </button>
    </div>
  );
}