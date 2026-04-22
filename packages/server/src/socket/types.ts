// packages/server/src/socket/types.ts
import { z } from 'zod';


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
      metadata: z.string().nullable(),
      created_at: z.string(),
    }),
    timestamp: z.string(),
  }),
};


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
    mode: z.enum(['default', 'plan', 'yolo']).optional(),
    agent: z.enum(['claude', 'codex']).optional(),
  }),

  // AI 执行事件 — 客户端 -> 服务端
  executeAI: z.object({
    sessionId: z.string(),
    projectId: z.number(),
    draftId: z.number(),
    command: z.string(),
    args: z.string(),
    contextCardId: z.string().optional(),
  }),
  pauseAIExecution: z.object({
    sessionId: z.string(),
  }),
  resumeAIExecution: z.object({
    sessionId: z.string(),
    newCommand: z.string(),
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

  // AI 执行事件 — 服务端 -> 客户端
  aiExecutionStarted: z.object({
    sessionId: z.string(),
    projectId: z.number(),
    draftId: z.number(),
    cardId: z.string(),
  }),
  aiExecutionOutput: z.object({
    sessionId: z.string(),
    chunk: z.string(),
  }),
  aiExecutionComplete: z.object({
    sessionId: z.string(),
    projectId: z.number(),
    draftId: z.number(),
    cardId: z.string(),
    success: z.boolean(),
    summary: z.string().optional(),
  }),
  aiExecutionError: z.object({
    sessionId: z.string(),
    message: z.string(),
  }),
  aiExecutionPaused: z.object({
    sessionId: z.string(),
    cardId: z.string(),
  }),
  aiExecutionResumed: z.object({
    sessionId: z.string(),
    cardId: z.string(),
  }),

  // 驾驶权变更通知 — 服务端 -> 客户端
  codingLockAcquired: z.object({
    projectId: z.number(),
    draftId: z.number(),
    holderId: z.number(),
    holderName: z.string(),
    cardId: z.string().nullable(),
  }),
  codingLockReleased: z.object({
    projectId: z.number(),
    draftId: z.number(),
  }),
};


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
export type TerminalClaudeStreamEvent = z.infer<typeof TerminalEvents.claudeStream>;
export type TerminalToolStartEvent = z.infer<typeof TerminalEvents.toolStart>;
export type TerminalToolEndEvent = z.infer<typeof TerminalEvents.toolEnd>;
export type TerminalClaudeDoneEvent = z.infer<typeof TerminalEvents.claudeDone>;
export type TerminalClaudeErrorEvent = z.infer<typeof TerminalEvents.claudeError>;
export type TerminalCostEvent = z.infer<typeof TerminalEvents.cost>;
export type TerminalExecuteAIEvent = z.infer<typeof TerminalEvents.executeAI>;
export type TerminalPauseAIExecutionEvent = z.infer<typeof TerminalEvents.pauseAIExecution>;
export type TerminalResumeAIExecutionEvent = z.infer<typeof TerminalEvents.resumeAIExecution>;
export type TerminalAIExecutionStartedEvent = z.infer<typeof TerminalEvents.aiExecutionStarted>;
export type TerminalAIExecutionOutputEvent = z.infer<typeof TerminalEvents.aiExecutionOutput>;
export type TerminalAIExecutionCompleteEvent = z.infer<typeof TerminalEvents.aiExecutionComplete>;
export type TerminalAIExecutionErrorEvent = z.infer<typeof TerminalEvents.aiExecutionError>;
export type TerminalAIExecutionPausedEvent = z.infer<typeof TerminalEvents.aiExecutionPaused>;
export type TerminalAIExecutionResumedEvent = z.infer<typeof TerminalEvents.aiExecutionResumed>;
export type TerminalCodingLockAcquiredEvent = z.infer<typeof TerminalEvents.codingLockAcquired>;
export type TerminalCodingLockReleasedEvent = z.infer<typeof TerminalEvents.codingLockReleased>;

// Socket 数据类型
export interface SocketData {
  userId: number;
  userName: string;
}
