// packages/server/src/ai/transcript.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../core/logger/index.js';
import type {
  CardData,
  DiscussionFile,
  DraftListItem,
  CardType,
  CodingLock,
} from '../modules/draft/file-types.js';

const logger = createLogger('transcript');

const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || path.join(process.cwd(), 'transcripts');


function getProjectDir(projectId: number): string {
  return path.join(TRANSCRIPTS_DIR, String(projectId));
}

function getDraftDir(projectId: number, draftId: number): string {
  return path.join(TRANSCRIPTS_DIR, String(projectId), String(draftId));
}

function getDiscussionPath(projectId: number, draftId: number): string {
  return path.join(getDraftDir(projectId, draftId), 'discussion.json');
}

function getCardPath(projectId: number, draftId: number, cardId: string): string {
  return path.join(getDraftDir(projectId, draftId), `${cardId}.json`);
}

function getTranscriptPath(projectId: number, draftId: number, cardId: string): string {
  return path.join(getDraftDir(projectId, draftId), `${cardId}-transcript.json`);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}


/**
 * 列出项目的所有 Draft（从文件读取）
 */
export async function listDrafts(projectId: number): Promise<DraftListItem[]> {
  const projectDir = getProjectDir(projectId);

  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const draftDirs = entries.filter(e => e.isDirectory());

    const drafts: DraftListItem[] = [];

    for (const dir of draftDirs) {
      const draftId = parseInt(dir.name, 10);
      if (isNaN(draftId)) continue;

      const discussion = await loadDiscussion(projectId, draftId);
      if (discussion) {
        drafts.push({
          draftId,
          projectId,
          draftTitle: discussion.draftTitle,
          status: discussion.status,
          createdBy: discussion.createdBy,
          createdByName: discussion.createdByName,
          cardCount: discussion.cards.length,
          hasActiveCodingLock: discussion.codingLock?.status === 'active',
          updatedAt: discussion.updatedAt,
        });
      }
    }

    // 按更新时间倒序
    return drafts.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}


/**
 * 创建 Discussion 文件（新建 Draft 时调用）
 */
export async function createDiscussion(input: {
  projectId: number;
  draftId: number;
  userId: number;
  userName: string;
  title?: string;
}): Promise<DiscussionFile> {
  const draftDir = getDraftDir(input.projectId, input.draftId);
  await ensureDir(draftDir);

  const now = new Date().toISOString();

  const discussion: DiscussionFile = {
    draftId: input.draftId,
    projectId: input.projectId,
    draftTitle: input.title || `Draft ${input.draftId}`,
    status: 'discussing',
    createdBy: input.userId,
    createdByName: input.userName,
    createdAt: now,
    messages: [],
    cards: [],
    mainCardId: null,
    codingLock: null,
    updatedAt: now,
  };

  const filePath = getDiscussionPath(input.projectId, input.draftId);
  await fs.writeFile(filePath, JSON.stringify(discussion, null, 2));

  logger.info(`Discussion created: ${filePath}`);
  return discussion;
}

/**
 * 加载 Discussion 文件
 */
export async function loadDiscussion(
  projectId: number,
  draftId: number
): Promise<DiscussionFile | null> {
  const filePath = getDiscussionPath(projectId, draftId);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 更新 Discussion 文件
 */
export async function updateDiscussion(
  projectId: number,
  draftId: number,
  updates: Partial<DiscussionFile>
): Promise<DiscussionFile | null> {
  const discussion = await loadDiscussion(projectId, draftId);
  if (!discussion) return null;

  const updated: DiscussionFile = {
    ...discussion,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getDiscussionPath(projectId, draftId);
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

  return updated;
}

/**
 * 删除 Draft（删除整个目录）
 */
export async function deleteDraft(projectId: number, draftId: number): Promise<void> {
  const draftDir = getDraftDir(projectId, draftId);
  await fs.rm(draftDir, { recursive: true, force: true });
  logger.info(`Draft deleted: ${draftDir}`);
}


/**
 * 创建卡片（同时写入 discussion 索引）
 */
export async function createCard(input: {
  projectId: number;
  draftId: number;
  cardType: CardType;
  userId: number;
  userName: string;
  parentCardId?: string;
}): Promise<CardData> {
  const draftDir = getDraftDir(input.projectId, input.draftId);
  await ensureDir(draftDir);

  const id = uuidv4();
  const shortId = id.slice(0, 8);
  const now = new Date().toISOString();
  const transcriptPath = getTranscriptPath(input.projectId, input.draftId, id);

  // 创建空的 transcript 文件
  await fs.writeFile(transcriptPath, JSON.stringify([], null, 2));

  const card: CardData = {
    id,
    shortId,
    draftId: input.draftId,
    projectId: input.projectId,
    cardType: input.cardType,
    cardStatus: 'pending',
    parentCardId: input.parentCardId ?? null,
    title: '',
    summary: '',
    result: '',
    transcriptPath,
    createdBy: input.userId,
    createdByName: input.userName,
    createdAt: now,
    updatedAt: now,
  };

  const filePath = getCardPath(input.projectId, input.draftId, id);
  await fs.writeFile(filePath, JSON.stringify(card, null, 2));

  // 立即写入 discussion 索引，使前端在执行期间也能看到新卡片
  await addCardIndex(input.projectId, input.draftId, card);

  logger.info(`Card created: ${filePath}`);
  return card;
}

/**
 * 加载卡片
 */
export async function loadCard(
  projectId: number,
  draftId: number,
  cardId: string
): Promise<CardData | null> {
  const filePath = getCardPath(projectId, draftId, cardId);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 更新卡片
 */
export async function updateCard(
  projectId: number,
  draftId: number,
  cardId: string,
  updates: Partial<CardData>
): Promise<CardData | null> {
  const card = await loadCard(projectId, draftId, cardId);
  if (!card) return null;

  const updated: CardData = {
    ...card,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getCardPath(projectId, draftId, cardId);
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

  return updated;
}

/**
 * 列出卡片
 */
export async function listCards(
  projectId: number,
  draftId: number
): Promise<CardData[]> {
  const draftDir = getDraftDir(projectId, draftId);

  try {
    const files = await fs.readdir(draftDir);
    // 过滤：只保留卡片文件，排除 discussion.json 和 transcript 文件
    const cardFiles = files.filter(f =>
      f.endsWith('.json') &&
      f !== 'discussion.json' &&
      !f.endsWith('-transcript.json')
    );

    const cards: CardData[] = [];
    for (const file of cardFiles) {
      const content = await fs.readFile(path.join(draftDir, file), 'utf-8');
      cards.push(JSON.parse(content));
    }

    return cards.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * 添加 transcript 条目
 */
export async function appendTranscript(
  projectId: number,
  draftId: number,
  cardId: string,
  entry: { role: 'user' | 'assistant'; content: string }
): Promise<void> {
  const card = await loadCard(projectId, draftId, cardId);
  if (!card) return;

  const transcriptPath = card.transcriptPath || getTranscriptPath(projectId, draftId, cardId);

  // 读取现有 transcript
  let transcript: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }> = [];
  try {
    const content = await fs.readFile(transcriptPath, 'utf-8');
    transcript = JSON.parse(content);
  } catch {
    // 文件不存在，使用空数组
  }

  // 添加新条目
  transcript.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  // 写回文件
  await fs.writeFile(transcriptPath, JSON.stringify(transcript, null, 2));
}


/**
 * 获取驾驶权
 */
export async function acquireCodingLock(input: {
  projectId: number;
  draftId: number;
  userId: number;
  userName: string;
  cardId?: string;
}): Promise<{ success: boolean; lock?: CodingLock; error?: string }> {
  const discussion = await loadDiscussion(input.projectId, input.draftId);
  if (!discussion) {
    return { success: false, error: 'Draft 不存在' };
  }

  // 检查是否已有活跃锁
  if (discussion.codingLock?.status === 'active') {
    return {
      success: false,
      error: `驾驶权已被 ${discussion.codingLock.holderName} 占用`,
    };
  }

  const lock: CodingLock = {
    holderId: input.userId,
    holderName: input.userName,
    cardId: input.cardId ?? null,
    status: 'active',
    acquiredAt: new Date().toISOString(),
  };

  await updateDiscussion(input.projectId, input.draftId, { codingLock: lock });

  return { success: true, lock };
}

/**
 * 释放驾驶权
 */
export async function releaseCodingLock(input: {
  projectId: number;
  draftId: number;
  userId: number;
}): Promise<void> {
  const discussion = await loadDiscussion(input.projectId, input.draftId);
  if (!discussion?.codingLock) return;

  if (discussion.codingLock.holderId !== input.userId) {
    throw new Error('您没有驾驶权');
  }

  await updateDiscussion(input.projectId, input.draftId, { codingLock: null });
}

/**
 * 暂停驾驶权
 */
export async function pauseCodingLock(input: {
  projectId: number;
  draftId: number;
  userId: number;
}): Promise<void> {
  const discussion = await loadDiscussion(input.projectId, input.draftId);
  if (!discussion?.codingLock) return;

  if (discussion.codingLock.holderId !== input.userId) {
    throw new Error('您没有驾驶权');
  }

  discussion.codingLock.status = 'paused';
  await updateDiscussion(input.projectId, input.draftId, { codingLock: discussion.codingLock });
}

/**
 * 恢复驾驶权
 */
export async function resumeCodingLock(input: {
  projectId: number;
  draftId: number;
  userId: number;
}): Promise<void> {
  const discussion = await loadDiscussion(input.projectId, input.draftId);
  if (!discussion?.codingLock) return;

  if (discussion.codingLock.holderId !== input.userId) {
    throw new Error('您没有驾驶权');
  }

  discussion.codingLock.status = 'active';
  await updateDiscussion(input.projectId, input.draftId, { codingLock: discussion.codingLock });
}


/**
 * 添加消息到 discussion
 */
export async function addMessage(input: {
  projectId: number;
  draftId: number;
  userName: string;
  content: string;
  messageType: string;
}): Promise<void> {
  const discussion = await loadDiscussion(input.projectId, input.draftId);
  if (!discussion) return;

  discussion.messages.push({
    id: discussion.messages.length + 1,
    userName: input.userName,
    content: input.content,
    messageType: input.messageType,
    createdAt: new Date().toISOString(),
  });

  await updateDiscussion(input.projectId, input.draftId, { messages: discussion.messages });
}

/**
 * 添加卡片索引到 discussion
 */
export async function addCardIndex(
  projectId: number,
  draftId: number,
  card: CardData
): Promise<void> {
  const discussion = await loadDiscussion(projectId, draftId);
  if (!discussion) return;

  discussion.cards.push({
    id: card.id,
    shortId: card.shortId,
    cardType: card.cardType,
    cardStatus: card.cardStatus,
    title: card.title,
    parentCardId: card.parentCardId,
    createdAt: card.createdAt,
  });

  await updateDiscussion(projectId, draftId, { cards: discussion.cards });
}


/**
 * 解析卡片引用，支持 shortId（8位）和 fullId（UUID）
 * shortId 通过 discussion 索引映射到 fullId，再从卡片文件加载标题
 */
export async function resolveCardReferences(
  projectId: number,
  draftId: number,
  rawIds: string[]
): Promise<Array<{ cardId: string; cardTitle: string }>> {
  const discussion = await loadDiscussion(projectId, draftId);
  if (!discussion) return [];

  const refs: Array<{ cardId: string; cardTitle: string }> = [];

  for (const rawId of rawIds) {
    // 映射 shortId → fullId（通过 discussion 索引）
    let fullId = rawId;
    if (rawId.length <= 8) {
      const indexEntry = discussion.cards.find(c => c.shortId === rawId);
      if (indexEntry) {
        fullId = indexEntry.id;
      }
    }

    const card = await loadCard(projectId, draftId, fullId);
    if (card) {
      refs.push({
        cardId: fullId,
        cardTitle: card.title || `卡片 ${card.shortId}`,
      });
    }
  }

  return refs;
}


export { getDiscussionPath, getCardPath, getTranscriptPath };