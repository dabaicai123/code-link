'use client';

import { useState, useRef } from 'react';

export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
}

interface DisplayPanelProps {
  onAddElement: (element: SelectedElement) => void;
}

export function DisplayPanel({ onAddElement }: DisplayPanelProps) {
  const [url, setUrl] = useState('http://localhost:3000');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const handleAddElement = () => {
    if (selectedElement) {
      onAddElement(selectedElement);
      setSelectedElement(null);
    }
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
          onClick={() => setSelectMode(!selectMode)}
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

      {selectMode && selectedElement && (
        <div style={{ padding: '4px 12px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <button onClick={handleAddElement} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px' }}>
            + 添加
          </button>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          src={url}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
        />
      </div>
    </div>
  );
}
