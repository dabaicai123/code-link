'use client';

import { useState, useRef, useCallback } from 'react';

export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
  children?: SelectedElement[];
}

interface DisplayPanelProps {
  onAddElement: (element: SelectedElement) => void;
}

export function DisplayPanel({ onAddElement }: DisplayPanelProps) {
  const [url, setUrl] = useState('http://localhost:3000');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [selectedElementRect, setSelectedElementRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [hoveredElement, setHoveredElement] = useState<SelectedElement | null>(null);
  const [hoveredElementRect, setHoveredElementRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const handleAddElement = () => {
    if (selectedElement) {
      onAddElement(selectedElement);
      // 清除选中状态，但保持选择模式
      setSelectedElement(null);
      setSelectedElementRect(null);
      setClickPosition(null);
    }
  };

  const handleCancelSelection = () => {
    setSelectedElement(null);
    setSelectedElementRect(null);
    setClickPosition(null);
  };

  // 计算元素的 CSS 选择器
  const getSelector = useCallback((element: Element): string => {
    if (element.id) {
      return `#${element.id}`;
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current.tagName !== 'HTML') {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes.slice(0, 2).join('.')}`;
        }
      }

      const siblings = current.parentElement?.children;
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }, []);

  // 提取元素及其子元素信息
  const extractElementInfo = useCallback((element: Element): SelectedElement => {
    const selector = getSelector(element);
    const content = element.textContent?.trim().slice(0, 100) || undefined;
    const children: SelectedElement[] = [];

    // 提取直接子元素
    Array.from(element.children).forEach((child) => {
      if (child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
        children.push(extractElementInfo(child));
      }
    });

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tagName: element.tagName.toLowerCase(),
      selector,
      content,
      children: children.length > 0 ? children : undefined,
    };
  }, [getSelector]);

  // 处理 iframe 内的点击（通过 overlay 捕获坐标）
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectMode || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeRect = iframe.getBoundingClientRect();

    // 计算点击位置相对于 iframe 的坐标
    const x = e.clientX - iframeRect.left;
    const y = e.clientY - iframeRect.top;

    // 获取 iframe 内的元素
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      const element = iframeDoc.elementFromPoint(x, y);
      if (!element || element.tagName === 'HTML' || element.tagName === 'BODY') return;

      // 提取元素及其子元素信息
      const elementInfo = extractElementInfo(element);

      setSelectedElement(elementInfo);

      // 获取元素在 iframe 内的位置
      const elementRect = element.getBoundingClientRect();
      setSelectedElementRect({
        x: elementRect.left,
        y: elementRect.top,
        width: elementRect.width,
        height: elementRect.height,
      });

      // 存储点击位置（相对于 overlay）
      setClickPosition({ x, y });

      // 清除 hover 状态
      setHoveredElement(null);
      setHoveredElementRect(null);
    } catch (err) {
      console.error('无法访问 iframe 内容（可能是跨域限制）:', err);
    }
  }, [selectMode, extractElementInfo]);

  // 处理 hover 显示预览（只在没有选中元素时生效）
  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 如果已经有选中元素，不更新 hover
    if (!selectMode || !iframeRef.current || selectedElement) return;

    const iframe = iframeRef.current;
    const iframeRect = iframe.getBoundingClientRect();
    const x = e.clientX - iframeRect.left;
    const y = e.clientY - iframeRect.top;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        setHoveredElement(null);
        setHoveredElementRect(null);
        return;
      }

      const element = iframeDoc.elementFromPoint(x, y);
      if (!element || element.tagName === 'HTML' || element.tagName === 'BODY') {
        setHoveredElement(null);
        setHoveredElementRect(null);
        return;
      }

      const selector = getSelector(element);
      const content = element.textContent?.trim().slice(0, 50) || undefined;

      setHoveredElement({
        id: 'preview',
        tagName: element.tagName.toLowerCase(),
        selector,
        content,
      });

      const elementRect = element.getBoundingClientRect();
      setHoveredElementRect({
        x: elementRect.left,
        y: elementRect.top,
        width: elementRect.width,
        height: elementRect.height,
      });
    } catch {
      setHoveredElement(null);
      setHoveredElementRect(null);
    }
  }, [selectMode, selectedElement, getSelector]);

  const handleOverlayMouseLeave = useCallback(() => {
    // 只在没有选中元素时清除 hover
    if (!selectedElement) {
      setHoveredElement(null);
      setHoveredElementRect(null);
    }
  }, [selectedElement]);

  // 计算添加按钮的位置
  const getAddButtonPosition = () => {
    if (!clickPosition) return { top: 0, left: 0 };
    const overlay = overlayRef.current;
    if (!overlay) return { top: clickPosition.y + 10, left: clickPosition.x };

    const overlayRect = overlay.getBoundingClientRect();
    const buttonWidth = 100;
    const buttonHeight = 32;
    const padding = 10;

    let top = clickPosition.y + padding;
    let left = clickPosition.x;

    if (left + buttonWidth > overlayRect.width) {
      left = overlayRect.width - buttonWidth - padding;
    }

    if (top + buttonHeight > overlayRect.height) {
      top = clickPosition.y - buttonHeight - padding;
    }

    return { top, left: Math.max(padding, left) };
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 8px' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
          />
        </div>
        <button onClick={handleRefresh} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>刷新</button>
        <button
          onClick={() => {
            setSelectMode(!selectMode);
            if (!selectMode) {
              setSelectedElement(null);
              setSelectedElementRect(null);
              setClickPosition(null);
              setHoveredElement(null);
              setHoveredElementRect(null);
            }
          }}
          className="btn"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: selectMode ? 'rgba(248, 113, 113, 0.2)' : 'var(--accent-color)',
            border: selectMode ? '1px solid var(--status-error)' : 'none',
            color: selectMode ? 'var(--status-error)' : 'white',
          }}
        >
          {selectMode ? '✕ 取消选择' : '🎯 选择'}
        </button>
      </div>

      {selectMode && (
        <div style={{ padding: '4px 12px', backgroundColor: 'rgba(124, 58, 237, 0.1)', borderBottom: '1px solid var(--accent-color)', fontSize: '11px', color: 'var(--accent-light)' }}>
          选择模式已开启，点击页面元素可添加到消息中
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          src={url}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
        />
        {/* 选择模式覆盖层 */}
        {selectMode && (
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            onMouseMove={handleOverlayMouseMove}
            onMouseLeave={handleOverlayMouseLeave}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              cursor: selectedElement ? 'default' : 'crosshair',
              zIndex: 10,
              backgroundColor: 'transparent',
            }}
          >
            {/* hover 时的高亮框（只在未选中时显示） */}
            {hoveredElementRect && !selectedElement && (
              <div
                style={{
                  position: 'absolute',
                  top: hoveredElementRect.y,
                  left: hoveredElementRect.x,
                  width: hoveredElementRect.width,
                  height: hoveredElementRect.height,
                  border: '2px solid var(--accent-color)',
                  backgroundColor: 'rgba(124, 58, 237, 0.1)',
                  pointerEvents: 'none',
                  borderRadius: '2px',
                }}
              />
            )}

            {/* 选中元素的高亮框 */}
            {selectedElementRect && (
              <div
                style={{
                  position: 'absolute',
                  top: selectedElementRect.y,
                  left: selectedElementRect.x,
                  width: selectedElementRect.width,
                  height: selectedElementRect.height,
                  border: '2px solid var(--status-success)',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  pointerEvents: 'none',
                  borderRadius: '2px',
                }}
              />
            )}

            {/* 点击后出现在鼠标附近的添加按钮 */}
            {selectedElement && clickPosition && (
              <div
                style={{
                  position: 'absolute',
                  top: getAddButtonPosition().top,
                  left: getAddButtonPosition().left,
                  display: 'flex',
                  gap: '4px',
                  zIndex: 20,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddElement();
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  + 添加 &lt;{selectedElement.tagName}&gt;
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 8px',
                    fontSize: '11px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}