'use client';

import { useState, useCallback } from 'react';
import { TabBar } from './tab-bar';
import { TerminalPanel } from './terminal-panel';
import { MessageEditor, SelectedElement } from './message-editor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
      <div className="panel-container items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-30">📁</div>
          <div className="text-muted-foreground text-sm">选择一个项目开始工作</div>
        </div>
      </div>
    );
  }

  const isRunning = project.status === 'running';

  return (
    <div className="panel-container">
      {/* 头部 */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              isRunning ? 'bg-status-running animate-pulse' : 'bg-status-stopped'
            )}
          />
          <span className="text-primary text-[13px]">{project.name}</span>
          <span className="text-muted-foreground text-xs">— 终端</span>
        </div>
        <Button onClick={onRestart} variant="secondary" size="sm" className="h-6 text-[11px] px-2.5">
          重启
        </Button>
      </div>

      <TabBar tabs={tabs} activeTabId={activeTabId} onTabSelect={setActiveTabId} onTabClose={handleCloseTab} onNewTab={handleNewTab} />

      <div className="flex-1 min-h-0">
        {tabs.map((tab) => (
          <div key={tab.id} className={cn('h-full', activeTabId === tab.id ? 'block' : 'hidden')}>
            <TerminalPanel projectId={String(project.id)} />
          </div>
        ))}
      </div>

      <MessageEditor elements={elements} onRemoveElement={onRemoveElement} onSend={onSendMessage} />
    </div>
  );
}