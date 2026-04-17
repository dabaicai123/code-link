'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface ResizableSplitProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

export function ResizableSplit({ left, right, defaultLeftWidth = 55, minLeftWidth = 30, maxLeftWidth = 80 }: ResizableSplitProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    const clampedWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, newWidth));
    setLeftWidth(clampedWidth);
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: `${leftWidth}%`, overflow: 'hidden' }}>{left}</div>

      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '4px',
          backgroundColor: isDragging ? 'var(--accent-color)' : 'var(--border-color)',
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: isDragging ? 'none' : 'background-color 0.15s',
        }}
      >
        <div style={{ width: '2px', height: '32px', backgroundColor: 'var(--border-light)', borderRadius: '1px' }} />
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>{right}</div>
    </div>
  );
}
