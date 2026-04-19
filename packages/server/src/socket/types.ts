// packages/server/src/socket/types.ts
import { z } from 'zod';

// ==================== Project 命名空间 ====================

export const ProjectEvents = {
  // 客户端 -> 服务端
  subscribe: z.object({
    projectId: z.number(),
  }),
  unsubscribe: z.object({
    projectId: z.number(),
  }),
  chat: z.object({
    projectId: z.number(),
    content: z.string(),
  }),
  fileChange: z.object({
    projectId: z.number(),
    path: z.string(),
    action: z.enum(['created', 'modified', 'deleted']),
    content: z.string().optional(),
  }),

  // 服务端 -> 客户端
  subscribed: z.object({
    projectId: z.number(),
    userCount: z.number(),
  }),
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

// ==================== Draft 命名空间 ====================

export const DraftEvents = {
  // 客户端 -> 服务端
  subscribe: z.object({
    draftId: z.number(),
  }),
  unsubscribe: z.object({
    draftId: z.number(),
  }),
  message: z.object({
    draftId: z.number(),
    content: z.string(),
    parentId: z.number().nullable().optional(),
  }),

  // 服务端 -> 客户端
  subscribed: z.object({
    draftId: z.number(),
    memberCount: z.number(),
    onlineUsers: z.array(z.object({
      userId: z.number(),
      userName: z.string(),
    })),
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
      created_at: z.string(),
    }),
    timestamp: z.string(),
  }),
};

// ==================== Terminal 命名空间 ====================

export const TerminalEvents = {
  // 客户端 -> 服务端
  start: z.object({
    projectId: z.number(),
    cols: z.number().default(80),
    rows: z.number().default(24),
  }),
  input: z.object({
    sessionId: z.string(),
    data: z.string(), // Base64 编码
  }),
  resize: z.object({
    sessionId: z.string(),
    cols: z.number(),
    rows: z.number(),
  }),
  ping: z.object({}),
  claudeMessage: z.object({
    sessionId: z.string(),
    data: z.string(), // Base64 编码
  }),

  // 服务端 -> 客户端
  started: z.object({
    sessionId: z.string(),
  }),
  output: z.object({
    data: z.string(), // Base64 编码
  }),
  exit: z.object({}),
  error: z.object({
    message: z.string(),
  }),
  pong: z.object({}),
};

// ==================== 类型导出 ====================

export type ProjectSubscribeEvent = z.infer<typeof ProjectEvents.subscribe>;
export type ProjectChatEvent = z.infer<typeof ProjectEvents.chat>;
export type ProjectChatMessageEvent = z.infer<typeof ProjectEvents.chatMessage>;

export type DraftSubscribeEvent = z.infer<typeof DraftEvents.subscribe>;
export type DraftMessageEvent = z.infer<typeof DraftEvents.message>;
export type DraftMessageBroadcast = z.infer<typeof DraftEvents.draftMessage>;

export type TerminalStartEvent = z.infer<typeof TerminalEvents.start>;
export type TerminalInputEvent = z.infer<typeof TerminalEvents.input>;
export type TerminalOutputEvent = z.infer<typeof TerminalEvents.output>;
export type TerminalClaudeMessageEvent = z.infer<typeof TerminalEvents.claudeMessage>;

// Socket 数据类型
export interface SocketData {
  userId: number;
  userName: string;
}
