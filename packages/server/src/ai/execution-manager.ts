// packages/server/src/ai/execution-manager.ts
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../core/logger/index.js';
import { normalizeError } from '../core/errors/index.js';
import {
  createCard,
  updateCard,
  appendTranscript,
} from './transcript.js';
import type { CardData, CardType, CardStatus } from '../modules/draft/file-types.js';

const logger = createLogger('execution-manager');

const SESSION_MAX_AGE_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_OUTPUT_CHUNKS = 500;

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

const activeExecutions = new Map<string, ExecutionSession>();
const executionByCardId = new Map<string, string>();

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

  const existing = activeExecutions.get(terminalSessionId);
  if (existing && existing.status === 'running') {
    throw new Error('当前 Session 正在执行其他任务');
  }

  const card = await createCard({
    projectId,
    draftId,
    cardType,
    userId,
    userName,
    parentCardId,
  });

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
  executionByCardId.set(card.id, terminalSessionId);
  logger.info(`Execution session started: ${session.id}`, { cardId: card.id });

  return session;
}

export function getExecutionByTerminal(sessionId: string): ExecutionSession | undefined {
  return activeExecutions.get(sessionId);
}

export function getExecutionByCard(cardId: string): ExecutionSession | undefined {
  const terminalSessionId = executionByCardId.get(cardId);
  if (!terminalSessionId) return undefined;
  return activeExecutions.get(terminalSessionId);
}

export async function updateExecutionStatus(
  terminalSessionId: string,
  status: CardStatus,
  output?: string
): Promise<void> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session) return;

  session.status = status;

  await Promise.all([
    updateCard(session.projectId, session.draftId, session.cardId, { cardStatus: status }),
    output
      ? appendTranscript(session.projectId, session.draftId, session.cardId, { role: 'assistant', content: output })
      : Promise.resolve(),
  ]);
}

export async function appendExecutionOutput(
  terminalSessionId: string,
  chunk: string
): Promise<void> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session || session.status !== 'running') return;

  if (session.output.length < MAX_OUTPUT_CHUNKS) {
    session.output.push(chunk);
  }
}

export async function completeExecution(
  terminalSessionId: string,
  success: boolean,
  summary?: string
): Promise<CardData | null> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session) return null;

  if (session.status === 'completed' || session.status === 'failed') return null;

  const status = success ? 'completed' : 'failed';
  session.status = status;
  activeExecutions.delete(terminalSessionId);
  executionByCardId.delete(session.cardId);

  const fullOutput = session.output.join('\n');

  const card = await updateCard(session.projectId, session.draftId, session.cardId, {
    cardStatus: status,
    result: fullOutput,
    summary: summary ?? fullOutput.slice(0, 200),
    title: generateCardTitle(session.cardType, summary),
  });

  logger.info(`Execution completed: ${session.id}`, { success, cardId: session.cardId });

  return card;
}

export async function pauseExecution(
  terminalSessionId: string
): Promise<void> {
  const session = activeExecutions.get(terminalSessionId);
  if (!session) return;

  session.status = 'paused';
  await updateCard(session.projectId, session.draftId, session.cardId, { cardStatus: 'paused' });

  logger.info(`Execution paused: ${session.id}`);
}

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

export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date();
  const expired: Array<[string, ExecutionSession]> = [];

  for (const [sessionId, session] of activeExecutions) {
    if (now.getTime() - session.startedAt.getTime() > SESSION_MAX_AGE_MS) {
      expired.push([sessionId, session]);
    }
  }

  await Promise.allSettled(
    expired.map(async ([sessionId, session]) => {
      try {
        await updateCard(session.projectId, session.draftId, session.cardId, { cardStatus: 'failed' });
      } catch (error) {
        logger.error(`Failed to mark expired card as failed: ${session.cardId}`, normalizeError(error));
      }
      activeExecutions.delete(sessionId);
      executionByCardId.delete(session.cardId);
      logger.warn(`Cleaned up expired execution: ${sessionId}`);
    })
  );
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startExecutionCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(
    () => { cleanupExpiredSessions().catch(e => logger.error('Cleanup error', normalizeError(e))); },
    CLEANUP_INTERVAL_MS
  );
}

export function stopExecutionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  activeExecutions.clear();
  executionByCardId.clear();
}