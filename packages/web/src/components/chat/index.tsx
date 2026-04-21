'use client';

import { useEffect, useCallback } from 'react';
import { ChatHeader } from './chat-header';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { useChatSession } from './chat-reducer';
import { useTerminalSocket } from '@/lib/socket/terminal';
import type { SelectedElement } from '@/types/claude-message';
import type { Attachment } from '@/types/chat';
import type { Project } from '@/types';

interface ChatWorkspaceProps {
  project: Project | null;
  userId: number;
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSendMessage?: (message: string, elements: SelectedElement[]) => void;
  onRestart?: () => void;
  onChatReady?: (sendFn: (elements: SelectedElement[], message: string) => void) => void;
}

export function ChatWorkspace({
  project,
  userId,
  elements,
  onRemoveElement,
  onSendMessage,
  onRestart,
  onChatReady,
}: ChatWorkspaceProps) {
  const {
    state,
    addUserMessage,
    startStreaming,
    appendStream,
    finishStream,
    addToolCall,
    updateToolCall,
    setRunning,
    setAgent,
    setPermissionMode,
    resetSession,
  } = useChatSession();

  const { isConnected, isStarted, start, sendClaudeMessage } = useTerminalSocket({
    projectId: project?.id ?? null,
    onClaudeStream: (text) => {
      appendStream(text);
    },
    onToolStart: (data) => {
      addToolCall({
        id: data.toolUseId,
        name: data.name,
        input: data.input,
        status: 'running',
        kind: data.kind,
      });
    },
    onToolEnd: (data) => {
      updateToolCall(data.toolUseId, data.result || '', 'completed');
    },
    onClaudeDone: (data) => {
      finishStream(state.streamingContent, data.cost);
    },
    onClaudeError: (message) => {
      finishStream(state.streamingContent);
    },
    onError: (message) => {
      setRunning(false);
    },
    onExit: () => {
      setRunning(false);
    },
  });

  // Start terminal session when project is running
  useEffect(() => {
    if (isConnected && !isStarted && project?.status === 'running') {
      start(80, 24);
    }
  }, [isConnected, isStarted, project?.status, start]);

  // Notify parent when chat is ready
  useEffect(() => {
    if (onChatReady && sendClaudeMessage) {
      onChatReady(sendClaudeMessage);
    }
  }, [onChatReady, sendClaudeMessage]);

  // Reset session when project changes
  useEffect(() => {
    if (project) {
      resetSession();
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(
    (message: string, els: SelectedElement[], attachments: Attachment[]) => {
      addUserMessage(message, els.length > 0 ? els : undefined, attachments.length > 0 ? attachments : undefined);
      if (sendClaudeMessage) {
        sendClaudeMessage(els, message, state.permissionMode, state.agent);
      }
      if (onSendMessage) {
        onSendMessage(message, els);
      }
    },
    [addUserMessage, sendClaudeMessage, state.permissionMode, state.agent, onSendMessage]
  );

  const handleAbort = useCallback(() => {
    if (isStarted) {
      setRunning(false);
    }
  }, [isStarted, setRunning]);

  if (!project) {
    return (
      <div className="panel-container items-center justify-center bg-[#faf6f0]">
        <div className="text-center">
          <div className="text-5xl mb-4 text-[#c0553a] opacity-30">✿</div>
          <div className="text-[#9a8b7d] text-sm">选择一个项目开始对话</div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="chat-workspace" className="panel-container chat-washi bg-[#faf6f0]">
      <ChatHeader
        project={project}
        agent={state.agent}
        permissionMode={state.permissionMode}
        onAgentChange={setAgent}
        onModeChange={setPermissionMode}
        onRestart={onRestart}
      />
      <MessageList
        messages={state.messages}
        streamingContent={state.streamingContent}
        isRunning={state.isRunning}
      />
      <ChatInput
        elements={elements}
        onRemoveElement={onRemoveElement}
        onSend={handleSend}
        onAbort={handleAbort}
        isRunning={state.isRunning}
      />
    </div>
  );
}