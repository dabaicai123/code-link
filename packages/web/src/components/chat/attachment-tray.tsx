// packages/web/src/components/chat/attachment-tray.tsx
'use client';

import { useRef } from 'react';
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
        <div className="attachment-tray" data-testid="attachment-tray">
          {attachments.map((att, index) => (
            <div key={att.id} className="attachment-chip" data-index={index} data-testid={`attachment-${index}`}>
              <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover" />
              <span className="truncate max-w-[120px]">{att.name}</span>
              {att.status === 'error' && <span className="text-[#c0553a] text-xs">失败</span>}
              <span
                className="cursor-pointer text-[#9a8b7d] hover:text-[#c0553a] ml-1"
                onClick={() => onRemove(att.id)}
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      )}
      <button
        className="attach-btn"
        onClick={() => fileInputRef.current?.click()}
        title="添加图片"
        type="button"
      >
        📎
      </button>
    </>
  );
}