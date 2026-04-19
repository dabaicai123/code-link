'use client';

import { useState, useCallback, useRef } from 'react';
import { TerminalWorkspace } from '@/components/terminal';
import { CollaborationPanel } from '@/components/collaboration';
import { ResizableSplit } from './resizable-split';
import { SelectedElement } from '@/components/collaboration/display-panel';

interface Project {
  id: number;
  name: string;
  templateType: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

interface WorkspaceProps {
  project: Project | null;
  userId: number;
  wsUrl?: string;
  onRestart?: () => void;
}

export function Workspace({ project, userId, wsUrl, onRestart }: WorkspaceProps) {
  const [elements, setElements] = useState<SelectedElement[]>([]);
  const sendClaudeMessageRef = useRef<((elements: SelectedElement[], message: string) => void) | null>(null);

  const handleAddElement = useCallback((element: SelectedElement) => {
    setElements((prev) => [...prev, element]);
  }, []);

  const handleRemoveElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
  }, []);

  const handleSendMessage = useCallback((message: string, els: SelectedElement[]) => {
    // 发送消息到 Claude Code 终端
    if (sendClaudeMessageRef.current) {
      sendClaudeMessageRef.current(els, message);
      setElements([]);
    } else {
      console.warn('Terminal not ready, message not sent:', { message, elements: els });
    }
  }, []);

  const handleTerminalReady = useCallback((sendFn: (elements: SelectedElement[], message: string) => void) => {
    sendClaudeMessageRef.current = sendFn;
  }, []);

  return (
    <ResizableSplit
      left={
        <TerminalWorkspace
          project={project}
          userId={userId}
          wsUrl={wsUrl}
          elements={elements}
          onRemoveElement={handleRemoveElement}
          onSendMessage={handleSendMessage}
          onRestart={onRestart}
          onTerminalReady={handleTerminalReady}
        />
      }
      right={<CollaborationPanel onAddElement={handleAddElement} />}
      defaultLeftWidth={55}
      minLeftWidth={30}
      maxLeftWidth={80}
    />
  );
}
