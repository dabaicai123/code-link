'use client';

import { useState } from 'react';
import { Globe, ExternalLink, RefreshCw } from 'lucide-react';

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

export function DisplayPanel({ url: initialUrl }: DisplayPanelProps) {
  const [manualUrl, setManualUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState(initialUrl || '');

  const activeUrl = iframeUrl || initialUrl;

  const handleNavigate = () => {
    if (manualUrl.trim()) {
      setIframeUrl(manualUrl.trim());
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* URL bar */}
      <div className="h-[40px] border-b border-border-default px-4 flex items-center gap-2">
        <Globe className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          value={activeUrl || manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="输入 URL 查看预览..."
          className="flex-1 h-7 px-2 text-[13px] bg-bg-secondary border border-border-default rounded-md text-text-primary placeholder:text-text-muted focus:border-accent-primary outline-none transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNavigate();
          }}
        />
        {activeUrl && (
          <button
            onClick={() => setIframeUrl(activeUrl)}
            className="h-7 px-2 rounded-md border border-border-default text-[12px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        )}
        {activeUrl && (
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2 rounded-md border border-border-default text-[12px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            外部打开
          </a>
        )}
      </div>

      {/* Preview content */}
      {activeUrl ? (
        <div className="flex-1 relative">
          <iframe
            src={activeUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="页面预览"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-bg-secondary/30">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-bg-secondary flex items-center justify-center mx-auto mb-3">
              <Globe className="w-5 h-5 text-text-muted" />
            </div>
            <p className="text-text-muted text-[13px]">输入 URL 查看页面预览</p>
            <p className="text-text-muted text-[11px] mt-1">项目运行后将自动显示预览地址</p>
          </div>
        </div>
      )}
    </div>
  );
}