'use client';

import { useState } from 'react';
import { DisplayPanel, SelectedElement } from './display-panel';

interface CollaborationPanelProps {
  onAddElement: (element: SelectedElement) => void;
}

type PanelType = 'display' | 'docs';

export function CollaborationPanel({ onAddElement }: CollaborationPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('display');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>协作面板</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActivePanel('display')}
            className="btn"
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              backgroundColor: activePanel === 'display' ? 'var(--accent-color)' : 'var(--bg-hover)',
              color: activePanel === 'display' ? 'white' : 'var(--text-secondary)',
            }}
          >
            展示
          </button>
          <button
            onClick={() => setActivePanel('docs')}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            文档
          </button>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>+</button>
        </div>
      </div>

      {activePanel === 'display' && <DisplayPanel onAddElement={onAddElement} />}
      {activePanel === 'docs' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          文档功能开发中...
        </div>
      )}
    </div>
  );
}
