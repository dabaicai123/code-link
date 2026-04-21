// packages/web/src/lib/socket/types.ts
import { z } from 'zod';

// 与服务端保持一致的类型定义

// WebSocket 事件类型
export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'user_joined'
  | 'user_left'
  | 'chat'
  | 'file_change'
  | 'build_status';

export interface BaseWSMessage {
  type: string;
  timestamp: string;
}

export interface ChatWSMessage extends BaseWSMessage {
  type: 'chat';
  projectId: number;
  userId: number;
  userName: string;
  content: string;
}

export interface UserEventWSMessage extends BaseWSMessage {
  type: 'user_joined' | 'user_left';
  projectId: number;
  userId: number;
  userName: string;
}

export const ProjectEvents = {
  subscribe: z.object({ projectId: z.number() }),
  unsubscribe: z.object({ projectId: z.number() }),
  chat: z.object({ projectId: z.number(), content: z.string() }),
  fileChange: z.object({
    projectId: z.number(),
    path: z.string(),
    action: z.enum(['created', 'modified', 'deleted']),
    content: z.string().optional(),
  }),

  subscribed: z.object({ projectId: z.number(), userCount: z.number() }),
  userJoined: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    timestamp: z.string(),
  }),
  userLeft: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    timestamp: z.string(),
  }),
  chatMessage: z.object({
    projectId: z.number(),
    userId: z.number(),
    userName: z.string(),
    content: z.string(),
    timestamp: z.string(),
  }),
  buildStatus: z.object({
    projectId: z.number(),
    status: z.enum(['pending', 'running', 'success', 'failed']),
    previewPort: z.number().optional(),
    error: z.string().optional(),
    timestamp: z.string(),
  }),
};

export const DraftEvents = {
  subscribe: z.object({ draftId: z.number() }),
  unsubscribe: z.object({ draftId: z.number() }),
  message: z.object({
    draftId: z.number(),
    content: z.string(),
    parentId: z.number().nullable().optional(),
  }),

  subscribed: z.object({
    draftId: z.number(),
    memberCount: z.number(),
    onlineUsers: z.array(z.object({ userId: z.number(), userName: z.string() })),
  }),
  memberJoined: z.object({
    draftId: z.number(),
    userId: z.number(),
    userName: z.string(),
    memberCount: z.number(),
    timestamp: z.string(),
  }),
  memberLeft: z.object({
    draftId: z.number(),
    userId: z.number(),
    userName: z.string(),
    memberCount: z.number(),
    timestamp: z.string(),
  }),
  draftMessage: z.object({
    draftId: z.number(),
    message: z.object({
      id: z.number(),
      draft_id: z.number(),
      parent_id: z.number().nullable(),
      user_id: z.number(),
      user_name: z.string(),
      content: z.string(),
      message_type: z.string(),
      metadata: z.string().nullable(),
      created_at: z.string(),
    }),
    timestamp: z.string(),
  }),
};

export const TerminalEvents = {
  start: z.object({ projectId: z.number(), cols: z.number().default(80), rows: z.number().default(24) }),
  input: z.object({ sessionId: z.string(), data: z.string() }),
  resize: z.object({ sessionId: z.string(), cols: z.number(), rows: z.number() }),
  ping: z.object({}),
  claudeMessage: z.object({
    sessionId: z.string(),
    data: z.string(),
    mode: z.enum(['default', 'plan', 'yolo']).optional(),
    agent: z.enum(['claude', 'codex']).optional(),
  }),

  started: z.object({ sessionId: z.string() }),
  output: z.object({ data: z.string() }),
  exit: z.object({}),
  error: z.object({ message: z.string() }),
  pong: z.object({}),
  claudeStream: z.object({
    sessionId: z.string(),
    text: z.string(),
  }),
  toolStart: z.object({
    sessionId: z.string(),
    toolUseId: z.string(),
    name: z.string(),
    input: z.string(),
    kind: z.string().optional(),
  }),
  toolEnd: z.object({
    sessionId: z.string(),
    toolUseId: z.string(),
    result: z.string().optional(),
  }),
  claudeDone: z.object({
    sessionId: z.string(),
    cost: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalCost: z.number(),
    }).optional(),
  }),
  claudeError: z.object({
    sessionId: z.string(),
    message: z.string(),
  }),
  cost: z.object({
    sessionId: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalCost: z.number(),
  }),
};

// 类型导出
export type ProjectSubscribeEvent = z.infer<typeof ProjectEvents.subscribe>;
export type ProjectChatMessageEvent = z.infer<typeof ProjectEvents.chatMessage>;
export type ProjectBuildStatusEvent = z.infer<typeof ProjectEvents.buildStatus>;

export type DraftSubscribeEvent = z.infer<typeof DraftEvents.subscribe>;
export type DraftMessageBroadcast = z.infer<typeof DraftEvents.draftMessage>;
export type DraftOnlineUser = { userId: number; userName: string };

export type TerminalStartEvent = z.infer<typeof TerminalEvents.start>;
export type TerminalOutputEvent = z.infer<typeof TerminalEvents.output>;
export type TerminalClaudeMessageEvent = z.infer<typeof TerminalEvents.claudeMessage>;
export type TerminalClaudeStreamEvent = z.infer<typeof TerminalEvents.claudeStream>;
export type TerminalToolStartEvent = z.infer<typeof TerminalEvents.toolStart>;
export type TerminalToolEndEvent = z.infer<typeof TerminalEvents.toolEnd>;
export type TerminalClaudeDoneEvent = z.infer<typeof TerminalEvents.claudeDone>;
export type TerminalClaudeErrorEvent = z.infer<typeof TerminalEvents.claudeError>;
export type TerminalCostEvent = z.infer<typeof TerminalEvents.cost>;