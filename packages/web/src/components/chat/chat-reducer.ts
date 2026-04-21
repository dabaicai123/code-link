// packages/web/src/components/chat/chat-reducer.ts
'use client';

import { useReducer, useCallback } from 'react';
import type { ChatSessionState, ChatAction, ChatMessage, ToolCall, AgentType, PermissionMode } from '@/types/chat';

const initialState: ChatSessionState = {
  messages: [],
  isRunning: false,
  agent: 'claude',
  permissionMode: 'default',
  streamingContent: '',
};

function chatReducer(state: ChatSessionState, action: ChatAction): ChatSessionState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'START_STREAMING':
      return { ...state, isRunning: true, streamingContent: '' };

    case 'APPEND_STREAM':
      return { ...state, streamingContent: state.streamingContent + action.content };

    case 'FINISH_STREAM': {
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: action.content,
        timestamp: Date.now(),
        cost: action.cost,
      };
      return {
        ...state,
        messages: [...state.messages, assistantMsg],
        isRunning: false,
        streamingContent: '',
      };
    }

    case 'ADD_TOOL_CALL': {
      const toolMsg: ChatMessage = {
        id: `tool-${action.toolCall.id}`,
        role: 'tool',
        content: action.toolCall.input,
        timestamp: Date.now(),
        toolCall: action.toolCall,
      };
      return { ...state, messages: [...state.messages, toolMsg] };
    }

    case 'UPDATE_TOOL_CALL':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.toolCall?.id === action.id
            ? { ...msg, toolCall: { ...msg.toolCall!, output: action.output, status: action.status } }
            : msg
        ),
      };

    case 'SET_RUNNING':
      return { ...state, isRunning: action.isRunning };

    case 'SET_AGENT':
      return { ...state, agent: action.agent };

    case 'SET_PERMISSION_MODE':
      return { ...state, permissionMode: action.mode };

    case 'RESET_SESSION':
      return initialState;

    default:
      return state;
  }
}

export function useChatSession() {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const addUserMessage = useCallback((content: string, elements?: import('@/types/claude-message').SelectedElement[], attachments?: import('@/types/chat').Attachment[]) => {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      elements,
      attachments,
    };
    dispatch({ type: 'ADD_USER_MESSAGE', message: msg });
  }, []);

  const startStreaming = useCallback(() => dispatch({ type: 'START_STREAMING' }), []);
  const appendStream = useCallback((content: string) => dispatch({ type: 'APPEND_STREAM', content }), []);
  const finishStream = useCallback((content: string, cost?: ChatMessage['cost']) => dispatch({ type: 'FINISH_STREAM', content, cost }), []);
  const addToolCall = useCallback((toolCall: ToolCall) => dispatch({ type: 'ADD_TOOL_CALL', toolCall }), []);
  const updateToolCall = useCallback((id: string, output: string, status: ToolCall['status']) => dispatch({ type: 'UPDATE_TOOL_CALL', id, output, status }), []);
  const setRunning = useCallback((isRunning: boolean) => dispatch({ type: 'SET_RUNNING', isRunning }), []);
  const setAgent = useCallback((agent: AgentType) => dispatch({ type: 'SET_AGENT', agent }), []);
  const setPermissionMode = useCallback((mode: PermissionMode) => dispatch({ type: 'SET_PERMISSION_MODE', mode }), []);
  const resetSession = useCallback(() => dispatch({ type: 'RESET_SESSION' }), []);

  return {
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
  };
}