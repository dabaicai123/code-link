'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { RightPanel } from './right-panel';
import { ResizableSplit } from './resizable-split';
import { SelectedElement } from '@/types/claude-message';
import { Loading } from '@/components/ui/loading';
import type { Project } from '@/types';

const ChatWorkspace = dynamic(
  () => import('@/components/chat').then((m) => ({ default: m.ChatWorkspace })),
  { loading: () => <Loading text="加载聊天..." /> }
);

interface WorkspaceProps {
  project: Project | null;
  userId: number;
  onRestart?: () => void;
}

export function Workspace({ project, userId, onRestart }: WorkspaceProps) {
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
        <ChatWorkspace
          project={project}
          userId={userId}
          elements={elements}
          onRemoveElement={handleRemoveElement}
          onSendMessage={handleSendMessage}
          onRestart={onRestart}
          onChatReady={handleTerminalReady}
        />
      }
      right={<RightPanel project={project} userId={userId} onAddElement={handleAddElement} />}
      defaultLeftWidth={55}
      minLeftWidth={30}
      maxLeftWidth={80}
    />
  );
}
