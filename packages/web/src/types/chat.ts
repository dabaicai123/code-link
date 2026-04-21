// packages/web/src/types/chat.ts

export interface Attachment {
  id: string;
  type: 'image';
  url: string;
  name: string;
  size: number;
  status: 'pending' | 'uploaded' | 'error';
}

export interface ToolCall {
  id: string;
  name: string;
  input: string;
  output?: string;
  status: 'running' | 'completed' | 'error';
  kind?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: number;
  elements?: import('./claude-message').SelectedElement[];
  toolCall?: ToolCall;
  attachments?: Attachment[];
  cost?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}

export type AgentType = 'claude' | 'codex';
export type PermissionMode = 'default' | 'plan' | 'yolo';

export interface ChatSessionState {
  messages: ChatMessage[];
  isRunning: boolean;
  agent: AgentType;
  permissionMode: PermissionMode;
  streamingContent: string;
}

export type ChatAction =
  | { type: 'ADD_USER_MESSAGE'; message: ChatMessage }
  | { type: 'START_STREAMING' }
  | { type: 'APPEND_STREAM'; content: string }
  | { type: 'FINISH_STREAM'; content: string; cost?: ChatMessage['cost'] }
  | { type: 'ADD_TOOL_CALL'; toolCall: ToolCall }
  | { type: 'UPDATE_TOOL_CALL'; id: string; output: string; status: ToolCall['status'] }
  | { type: 'SET_RUNNING'; isRunning: boolean }
  | { type: 'SET_AGENT'; agent: AgentType }
  | { type: 'SET_PERMISSION_MODE'; mode: PermissionMode }
  | { type: 'RESET_SESSION' };
