'use client';

import { useState, useRef, useCallback } from 'react';
import { Globe, ExternalLink, RefreshCw, Crosshair, XCircle } from 'lucide-react';
import type { SelectedElement } from '@/types/claude-message';

interface DisplayPanelProps {
  url?: string;
  onAddElement?: (element: SelectedElement) => void;
}

export function DisplayPanel({ url: initialUrl, onAddElement }: DisplayPanelProps) {
  const [manualUrl, setManualUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState(initialUrl || '');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedEl, setSelectedEl] = useState<SelectedElement | null>(null);
  const [selectedRect, setSelectedRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hoveredRect, setHoveredRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const activeUrl = iframeUrl || initialUrl;

  const handleNavigate = () => {
    if (manualUrl.trim()) setIframeUrl(manualUrl.trim());
  };

  const handleRefresh = () => {
    if (iframeRef.current && activeUrl) iframeRef.current.src = activeUrl;
  };

  const clearSelection = () => {
    setSelectedEl(null);
    setSelectedRect(null);
    setClickPos(null);
  };

  const clearHover = () => {
    setHoveredRect(null);
  };

  const toggleSelectMode = () => {
    const next = !selectMode;
    setSelectMode(next);
    if (!next) {
      clearSelection();
      clearHover();
    }
  };

  const buildSelector = useCallback((el: Element): string => {
    if (el.id) return `#${el.id}`;
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.tagName !== 'HTML') {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(`#${cur.id}`); break; }
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\s+/).filter(Boolean);
        if (cls.length) seg += `.${cls.slice(0, 2).join('.')}`;
      }
      const sibs = cur.parentElement?.children;
      if (sibs && sibs.length > 1) seg += `:nth-child(${Array.from(sibs).indexOf(cur) + 1})`;
      parts.unshift(seg);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }, []);

  const extractInfo = useCallback((el: Element): SelectedElement => {
    const children: SelectedElement[] = [];
    for (const ch of Array.from(el.children)) {
      if (ch.tagName !== 'SCRIPT' && ch.tagName !== 'STYLE') children.push(extractInfo(ch));
    }
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tagName: el.tagName.toLowerCase(),
      selector: buildSelector(el),
      content: el.textContent?.trim().slice(0, 100) || undefined,
      children: children.length ? children : undefined,
    };
  }, [buildSelector]);

  const iframeDoc = useCallback(() => {
    const f = iframeRef.current;
    if (!f) return null;
    return f.contentDocument || f.contentWindow?.document;
  }, []);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectMode || !iframeRef.current) return;
    const fRect = iframeRef.current.getBoundingClientRect();
    const x = e.clientX - fRect.left;
    const y = e.clientY - fRect.top;
    try {
      const doc = iframeDoc();
      if (!doc) return;
      const el = doc.elementFromPoint(x, y);
      if (!el || el.tagName === 'HTML' || el.tagName === 'BODY') return;
      setSelectedEl(extractInfo(el));
      const r = el.getBoundingClientRect();
      setSelectedRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      setClickPos({ x, y });
      clearHover();
    } catch { /* cross-origin */ }
  }, [selectMode, extractInfo, iframeDoc]);

  const handleOverlayMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectMode || !iframeRef.current || selectedEl) return;
    const fRect = iframeRef.current.getBoundingClientRect();
    const x = e.clientX - fRect.left;
    const y = e.clientY - fRect.top;
    try {
      const doc = iframeDoc();
      if (!doc) { clearHover(); return; }
      const el = doc.elementFromPoint(x, y);
      if (!el || el.tagName === 'HTML' || el.tagName === 'BODY') { clearHover(); return; }
      const r = el.getBoundingClientRect();
      setHoveredRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    } catch { clearHover(); }
  }, [selectMode, selectedEl, iframeDoc]);

  const handleOverlayLeave = useCallback(() => {
    if (!selectedEl) clearHover();
  }, [selectedEl]);

  const addButtonPos = () => {
    if (!clickPos) return { top: 0, left: 0 };
    const overlay = overlayRef.current;
    if (!overlay) return { top: clickPos.y + 10, left: clickPos.x };
    const oRect = overlay.getBoundingClientRect();
    const pad = 10;
    let top = clickPos.y + pad;
    let left = clickPos.x;
    if (left + 130 > oRect.width) left = oRect.width - 130 - pad;
    if (top + 36 > oRect.height) top = clickPos.y - 36 - pad;
    return { top, left: Math.max(pad, left) };
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
          onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(); }}
        />
        {activeUrl && (
          <button onClick={handleRefresh} className="h-7 px-2 rounded-md border border-border-default text-[12px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />刷新
          </button>
        )}
        {activeUrl && (
          <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="h-7 px-2 rounded-md border border-border-default text-[12px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />外部打开
          </a>
        )}
        {activeUrl && onAddElement && (
          <button
            onClick={toggleSelectMode}
            className={`h-7 px-2 rounded-md text-[12px] flex items-center gap-1 transition-colors ${
              selectMode
                ? 'bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500/30'
                : 'bg-accent-primary text-white hover:bg-accent-hover'
            }`}
          >
            {selectMode ? <><XCircle className="w-3 h-3" />取消选择</> : <><Crosshair className="w-3 h-3" />选择元素</>}
          </button>
        )}
      </div>

      {/* Select mode banner */}
      {selectMode && (
        <div className="px-4 py-1 bg-accent-primary/10 border-b border-accent-primary text-[11px] text-accent-primary">
          选择模式已开启，点击页面元素可添加到消息中
        </div>
      )}

      {/* Preview content */}
      {activeUrl ? (
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            src={activeUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="页面预览"
          />
          {selectMode && (
            <div
              ref={overlayRef}
              onClick={handleOverlayClick}
              onMouseMove={handleOverlayMove}
              onMouseLeave={handleOverlayLeave}
              className="absolute inset-0 z-10"
              style={{ cursor: selectedEl ? 'default' : 'crosshair' }}
            >
              {hoveredRect && !selectedEl && (
                <div
                  className="absolute border-2 border-accent-primary bg-accent-primary/10 rounded-sm pointer-events-none"
                  style={{ top: hoveredRect.y, left: hoveredRect.x, width: hoveredRect.w, height: hoveredRect.h }}
                />
              )}
              {selectedRect && (
                <div
                  className="absolute border-2 border-green-500 bg-green-500/15 rounded-sm pointer-events-none"
                  style={{ top: selectedRect.y, left: selectedRect.x, width: selectedRect.w, height: selectedRect.h }}
                />
              )}
              {selectedEl && clickPos && (
                <div className="absolute z-20 flex gap-1" style={{ top: addButtonPos().top, left: addButtonPos().left }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddElement!(selectedEl); clearSelection(); }}
                    className="px-3 py-1.5 rounded-md bg-accent-primary text-white text-[11px] shadow-lg hover:bg-accent-hover transition-colors"
                  >
                    + 添加 &lt;{selectedEl.tagName}&gt;
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                    className="px-2 py-1.5 rounded-md border border-border-default bg-bg-primary text-text-muted text-[11px] shadow-lg hover:text-text-secondary transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
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