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
  const [isLoading, setIsLoading] = useState(false);

  const activeUrl = iframeUrl || initialUrl;

  const handleNavigate = () => {
    if (manualUrl.trim()) {
      setIframeUrl(manualUrl.trim());
      setIsLoading(true);
    }
  };

  const handleRefresh = () => {
    if (activeUrl) {
      setIframeUrl(activeUrl);
      setIsLoading(true);
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* URL bar */}
      <div className="h-[40px] border-b border-border-default px-3 flex items-center gap-2">
        <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <input
          type="text"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder={activeUrl || '输入 URL 查看页面预览'}
          className="flex-1 h-7 px-2 text-[13px] bg-bg-primary border border-border-default rounded-md text-text-primary placeholder:text-text-muted focus:border-accent-primary outline-none transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNavigate();
          }}
        />
        {activeUrl && (
          <button
            onClick={handleRefresh}
            className="h-7 px-2 rounded-md border border-border-default text-[13px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
        {activeUrl && (
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2 rounded-md border border-border-default text-[13px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Preview content */}
      {activeUrl ? (
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 z-10">
              <div className="text-[13px] text-text-muted">加载预览...</div>
            </div>
          )}
          <iframe
            src={activeUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            title="页面预览"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-bg-secondary/30">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-bg-secondary flex items-center justify-center mx-auto mb-3">
              <Globe className="w-5 h-5 text-text-muted" />
            </div>
            <p className="text-text-muted text-[13px]">输入 URL 查看页面预览</p>
          </div>
        </div>
      )}
    </div>
  );
}
