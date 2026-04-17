'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Terminal } from './terminal';

export interface TerminalContainerProps {
  projectId: string;
  userId: string;
  wsUrl?: string;
  defaultOpen?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export function TerminalContainer({
  projectId,
  userId,
  wsUrl = 'ws://localhost:3001/terminal',
  defaultOpen = false,
  defaultHeight = 300,
  minHeight = 150,
  maxHeight = 600,
}: TerminalContainerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // 处理拖拽调整大小
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  }, [height]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeightRef.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minHeight, maxHeight]);

  const toggleTerminal = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleExit = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div ref={containerRef} className="terminal-wrapper">
      {/* 终端切换按钮 */}
      <button
        onClick={toggleTerminal}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        aria-label={isOpen ? 'Close terminal' : 'Open terminal'}
      >
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span>{isOpen ? 'Close Terminal' : 'Open Terminal'}</span>
      </button>

      {/* 终端容器 */}
      {isOpen && (
        <div
          className="mt-2 border border-gray-700 rounded-lg overflow-hidden bg-[#1e1e1e]"
          style={{ height: `${height}px` }}
        >
          {/* 调整大小手柄 */}
          <div
            className="h-1 bg-gray-600 hover:bg-blue-500 cursor-ns-resize transition-colors"
            onMouseDown={handleMouseDown}
          />

          {/* 终端组件 */}
          <div className="h-[calc(100%-4px)]">
            <Terminal
              projectId={projectId}
              userId={userId}
              wsUrl={wsUrl}
              onExit={handleExit}
              onError={(error) => console.error('Terminal error:', error)}
            />
          </div>
        </div>
      )}

      {/* 调整中指示器 */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-ns-resize" />
      )}
    </div>
  );
}

export default TerminalContainer;