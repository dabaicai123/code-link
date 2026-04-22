'use client';

import { Globe } from 'lucide-react';

export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
  children?: SelectedElement[];
}

interface DisplayPanelProps {
  url?: string;
}

export function DisplayPanel({ url }: DisplayPanelProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg-secondary/30">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-bg-secondary flex items-center justify-center mx-auto mb-3">
          <Globe className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-text-muted text-[13px]">输入 URL 查看页面预览</p>
        <div className="mt-3 w-[280px] mx-auto">
          <input
            type="text"
            placeholder="https://example.com"
            className="w-full h-10 px-3 bg-bg-primary border border-border-default rounded-lg text-[13px] text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all"
          />
        </div>
      </div>
    </div>
  );
}