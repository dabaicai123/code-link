'use client';

import { useState, useCallback } from 'react';
import { TabBar } from './tab-bar';
import { TerminalPanel } from './terminal-panel';
import { MessageEditor, SelectedElement } from './message-editor';

interface Project {
  id: number;
  name: string;
  status: 'created' | 'running' | 'stopped';
}

interface TerminalWorkspaceProps {
  project: Project | null;
  userId: number;
  wsUrl?: string;
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSendMessage: (message: string, elements: SelectedElement[]) => void;
  onRestart?: () => void;
}

export function TerminalWorkspace({
  project,
  userId,
  wsUrl,
  elements,
  onRemoveElement,
  onSendMessage,
  onRestart,
}: TerminalWorkspaceProps) {
  const [tabs, setTabs] = useState([{ id: 'terminal-1', label: 'bash' }]);
  const [activeTabId, setActiveTabId] = useState('terminal-1');
  const [tabCounter, setTabCounter] = useState(1);

  const handleNewTab = useCallback(() => {
    const newId = `terminal-${tabCounter + 1}`;
    setTabs((prev) => [...prev, { id: newId, label: `终端 ${tabCounter + 1}` }]);
    setActiveTabId(newId);
    setTabCounter((prev) => prev + 1);
  }, [tabCounter]);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  if (!project) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📁</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>选择一个项目开始工作</div>
        </div>
      </div>
    );
  }

  const isRunning = project.status === 'running';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* 头部 */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isRunning ? 'var(--status-running)' : 'var(--status-stopped)',
            animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{project.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>— 终端</span>
        </div>
        <button onClick={onRestart} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
          重启
        </button>
      </div>

      <TabBar tabs={tabs} activeTabId={activeTabId} onTabSelect={setActiveTabId} onTabClose={handleCloseTab} onNewTab={handleNewTab} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {tabs.map((tab) => (
          <div key={tab.id} style={{ height: '100%', display: activeTabId === tab.id ? 'block' : 'none' }}>
            <TerminalPanel projectId={String(project.id)} userId={String(userId)} wsUrl={wsUrl} />
          </div>
        ))}
      </div>

      <MessageEditor elements={elements} onRemoveElement={onRemoveElement} onSend={onSendMessage} />
    </div>
  );
}