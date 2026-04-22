// packages/web/src/components/chat/attachment-tray.tsx
'use client';

import { useRef } from 'react';
import { X, Paperclip } from 'lucide-react';
import type { Attachment } from '@/types/chat';

interface AttachmentTrayProps {
  attachments: Attachment[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  maxCount?: number;
}

export function AttachmentTray({ attachments, onAdd, onRemove, maxCount = 4 }: AttachmentTrayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => /^image\//.test(f.type || '')
    );
    if (attachments.length + files.length > maxCount) {
      return;
    }
    onAdd(files);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileSelect}
      />
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 max-w-[800px] mx-auto mb-2.5" data-testid="attachment-tray">
          {attachments.map((att, index) => (
            <div key={att.id} className="inline-flex items-center gap-2 max-w-full px-2.5 py-1.5 border border-accent-primary/20 rounded-xl bg-bg-card/96 text-text-primary text-xs" data-index={index} data-testid={`attachment-${index}`}>
              <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover" />
              <span className="truncate max-w-[120px]">{att.name}</span>
              {att.status === 'error' && <span className="text-accent-primary text-xs">失败</span>}
              <X className="w-3.5 h-3.5 cursor-pointer text-text-muted hover:text-accent-primary ml-1" onClick={() => onRemove(att.id)} />
            </div>
          ))}
        </div>
      )}
      <button
        className="w-11 h-11 rounded-xl bg-transparent border border-border-default text-text-secondary cursor-pointer transition-all flex items-center justify-center hover:bg-bg-hover hover:text-text-primary hover:border-border-light"
        onClick={() => fileInputRef.current?.click()}
        title="添加图片"
        type="button"
      >
        <Paperclip className="w-4 h-4" />
      </button>
    </>
  );
}