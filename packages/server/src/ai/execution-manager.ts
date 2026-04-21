// packages/server/src/ai/execution-manager.ts
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../core/logger/index.js';
import {
  createCard,
  updateCard,
  appendTranscript,
} from './transcript.js';
import type { CardData, CardType, CardStatus } from '../modules/draft/file-types.js';

const logger = createLogger('execution-manager');

export interface ExecutionSession {
  id: string;
  projectId: number;
  draftId: number;
  terminalSessionId: string;
  userId: number;
  userName: string;
  cardId: string;
  cardType: CardType;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed';
  output: string[];
  startedAt: Date;
}

// 活跃的执行会话（按 terminal session 索引）
const activeExecutions = new Map<string, ExecutionSession>();

/**
 * 创建执行会话
 */
export async function startExecutionSession(input: {
  projectId: number;
  draftId: number;
  terminalSessionId: string;
  userId: number;
  userName: string;
  cardType: CardType;
  command: string;
  parentCardId?: string;
}): Promise<ExecutionSession> {
  const { projectId, draftId, terminalSessionId, userId, userName, cardType, command, parentCardId } = input;

  // 检查是否已有执行
  const existing = activeExecutions.get(terminalSessionId);
  if (existing && existing.status === 'running') {
    throw new Error('当前 Session 正在执行其他任务');
  }

  // 创建卡片
  const card = await createCard({
    projectId,
    draftId,
    cardType,
    userId,
    userName,
    parentCardId,
  });

  // 初始化 transcript
  await appendTranscript(projectId, draftId, card.id, {
    role: 'user',
    content: command,
  });

  const session: ExecutionSession = {
    id: uuidv4(),
    projectId,
    draftId,
    terminalSessionId,
    userId,
    userName,
    cardId: card.id,
    cardType,
    status: 'pending',
    output: [],
    startedAt: new Date(),
  };

  activeExecutions.set(terminalSessionId, session);
  logger.info(`Execution session started: ${session.id}`, { cardId: card.id });

  return session;
}

/**
 * 获取执行会话（按 terminal session）
 */
export function getExecutionByTerminal(sessionId: string): ExecutionSession | undefined {
  return activeExecutions.get(sessionId);
}

/**
 * 获取执行会话（按 card ID）
 */
export function getExecutionByCard(cardId: string): ExecutionSession | undefined {
  for (const session of activeExecutions.values()) {
    if (session.cardId === cardId) return session;
  }
  return undefined;
}

/**
 * 更新执行状态
 */
export async function updateExecutionStatus(
  terminalSessionId: string,
  status: CardStatus,
  output?: string
): Promise<void> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session) return;

  session.status = status;

  // 更新卡片状态
  await updateCard(session.projectId, session.draftId, session.cardId, { cardStatus: status });

  if (output) {
    session.output.push(output);
    await appendTranscript(session.projectId, session.draftId, session.cardId, {
      role: 'assistant',
      content: output,
    });
  }
}

/**
 * 追加输出
 */
export async function appendExecutionOutput(
  terminalSessionId: string,
  chunk: string
): Promise<void> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session || session.status !== 'running') return;

  session.output.push(chunk);
}

/**
 * 完成执行（同时释放驾驶权）
 */
export async function completeExecution(
  terminalSessionId: string,
  success: boolean,
  summary?: string
): Promise<CardData | null> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session) return null;

  // Guard against double-completion: mark immediately to prevent race
  if (session.status === 'completed' || session.status === 'failed') return null;
  const status = success ? 'completed' : 'failed';
  session.status = status;

  // Remove from map before async work to prevent concurrent access
  activeExecutions.delete(terminalSessionId);

  // 合并所有输出
  const fullOutput = session.output.join('\n');

  // 更新卡片
  const card = await updateCard(session.projectId, session.draftId, session.cardId, {
    cardStatus: status,
    result: fullOutput,
    summary: summary ?? fullOutput.slice(0, 200),
    title: generateCardTitle(session.cardType, summary),
  });

  logger.info(`Execution completed: ${session.id}`, { success, cardId: session.cardId });

  return card;
}

/**
 * 暂停执行
 */
export async function pauseExecution(
  terminalSessionId: string
): Promise<void> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session) return;

  session.status = 'paused';
  await updateCard(session.projectId, session.draftId, session.cardId, { cardStatus: 'paused' });

  logger.info(`Execution paused: ${session.id}`);
}

/**
 * 继续执行（从暂停状态）
 */
export async function resumeExecution(
  terminalSessionId: string,
  newCommand: string
): Promise<void> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session || session.status !== 'paused') return;

  session.status = 'running';
  await updateCard(session.projectId, session.draftId, session.cardId, { cardStatus: 'running' });
  await appendTranscript(session.projectId, session.draftId, session.cardId, {
    role: 'user',
    content: newCommand,
  });

  logger.info(`Execution resumed: ${session.id}`);
}

/**
 * 生成卡片标题
 */
function generateCardTitle(cardType: CardType, summary?: string): string {
  const typeLabels: Record<CardType, string> = {
    brainstorming: 'Brainstorming',
    writing_plans: '实现计划',
    development: '开发执行',
    free_chat: '自由对话',
    test: '测试结果',
    archive: '归档',
  };

  const base = typeLabels[cardType] || cardType;
  return summary ? `${base} - ${summary.slice(0, 30)}` : base;
}

/**
 * 清理过期会话
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date();
  for (const [sessionId, session] of activeExecutions) {
    const elapsed = now.getTime() - session.startedAt.getTime();
    if (elapsed > 60 * 60 * 1000) {
      try {
        await updateCard(session.projectId, session.draftId, session.cardId, { cardStatus: 'failed' });
      } catch (error) {
        logger.error(`Failed to mark expired card as failed: ${session.cardId}`, { error });
      }
      activeExecutions.delete(sessionId);
      logger.warn(`Cleaned up expired execution: ${sessionId}`);
    }
  }
}