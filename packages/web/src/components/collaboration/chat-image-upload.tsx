'use client';

import { X } from 'lucide-react';

export interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

interface ChatImageUploadProps {
  previews: ImagePreview[];
  onRemove: (id: string) => void;
}

export function ChatImageUpload({ previews, onRemove }: ChatImageUploadProps) {
  if (previews.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 max-w-[800px] mx-auto mb-2.5">
      {previews.map(preview => (
        <div key={preview.id} className="inline-flex items-center gap-2 max-w-full px-2.5 py-1.5 border border-accent-primary/20 rounded-xl bg-bg-card text-text-primary text-xs relative group">
          <img src={preview.url} alt="预览" className="w-16 h-16 object-cover rounded border border-border" />
          <button
            type="button"
            onClick={() => onRemove(preview.id)}
            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}