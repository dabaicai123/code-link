// packages/server/src/ai/transcript.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../core/logger/index.js';
import { normalizeError } from '../core/errors/index.js';
import type {
  CardData,
  DiscussionFile,
  DraftListItem,
  CardType,
  CodingLock,
} from '../modules/draft/file-types.js';

const logger = createLogger('transcript');

const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || path.join(process.cwd(), 'transcripts');
const CONTAINER_TRANSCRIPTS_DIR = '/workspace/transcripts';


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

function toContainerPath(projectId: number, draftId: number, filename: string): string {
  return `${CONTAINER_TRANSCRIPTS_DIR}/${projectId}/${draftId}/${filename}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}
export async function listDrafts(projectId: number): Promise<DraftListItem[]> {
  const projectDir = getProjectDir(projectId);

  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const draftIds = entries.filter(e => e.isDirectory())
      .map(e => parseInt(e.name, 10))
      .filter(id => !isNaN(id));

    const discussions = await Promise.all(
      draftIds.map(id => loadDiscussion(projectId, id))
    );

    const drafts: DraftListItem[] = [];
    for (let i = 0; i < draftIds.length; i++) {
      const discussion = discussions[i];
      if (discussion) {
        drafts.push({
          draftId: draftIds[i],
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

    return drafts.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    logger.error('Failed to list drafts', normalizeError(error));
    return [];
  }
}


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
  await writeJsonFile(filePath, discussion);

  logger.info(`Discussion created: ${filePath}`);
  return discussion;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function loadDiscussion(
  projectId: number,
  draftId: number
): Promise<DiscussionFile | null> {
  return readJsonFile<DiscussionFile>(getDiscussionPath(projectId, draftId));
}

export async function updateDiscussion(
  projectId: number,
  draftId: number,
  updates: Partial<DiscussionFile>,
  preloaded?: DiscussionFile
): Promise<DiscussionFile | null> {
  const discussion = preloaded ?? await loadDiscussion(projectId, draftId);
  if (!discussion) return null;

  const updated: DiscussionFile = {
    ...discussion,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(getDiscussionPath(projectId, draftId), updated);
  return updated;
}

export async function deleteDraft(projectId: number, draftId: number): Promise<void> {
  const draftDir = getDraftDir(projectId, draftId);
  await fs.rm(draftDir, { recursive: true, force: true });
  logger.info(`Draft deleted: ${draftDir}`);
}


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

  await writeJsonFile(transcriptPath, []);

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
  await writeJsonFile(filePath, card);

  await addCardIndex(input.projectId, input.draftId, card);

  logger.info(`Card created: ${filePath}`);
  return card;
}

export async function loadCard(
  projectId: number,
  draftId: number,
  cardId: string
): Promise<CardData | null> {
  return readJsonFile<CardData>(getCardPath(projectId, draftId, cardId));
}

export async function updateCard(
  projectId: number,
  draftId: number,
  cardId: string,
  updates: Partial<CardData>,
  preloaded?: CardData
): Promise<CardData | null> {
  const card = preloaded ?? await loadCard(projectId, draftId, cardId);
  if (!card) return null;

  const updated: CardData = {
    ...card,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(getCardPath(projectId, draftId, cardId), updated);
  return updated;
}

export async function listCards(
  projectId: number,
  draftId: number
): Promise<CardData[]> {
  const draftDir = getDraftDir(projectId, draftId);

  try {
    const files = await fs.readdir(draftDir);
    const cardFiles = files.filter(f =>
      f.endsWith('.json') &&
      f !== 'discussion.json' &&
      !f.endsWith('-transcript.json')
    );

    const contents = await Promise.all(
      cardFiles.map(f => readJsonFile<CardData>(path.join(draftDir, f)))
    );

    return contents
      .filter((c): c is CardData => c !== null)
      .sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  } catch (error) {
    logger.error('Failed to list cards', normalizeError(error));
    return [];
  }
}

export async function appendTranscript(
  projectId: number,
  draftId: number,
  cardId: string,
  entry: { role: 'user' | 'assistant'; content: string }
): Promise<void> {
  const transcriptPath = getTranscriptPath(projectId, draftId, cardId);

  const transcript = await readJsonFile<Array<{ role: string; content: string; timestamp: string }>>(transcriptPath) ?? [];

  transcript.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  await writeJsonFile(transcriptPath, transcript);
}


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

  await updateDiscussion(input.projectId, input.draftId, { codingLock: lock }, discussion);

  return { success: true, lock };
}

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

  await updateDiscussion(input.projectId, input.draftId, { codingLock: null }, discussion);
}

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
  await updateDiscussion(input.projectId, input.draftId, { codingLock: discussion.codingLock }, discussion);
}

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
  await updateDiscussion(input.projectId, input.draftId, { codingLock: discussion.codingLock }, discussion);
}


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

  await updateDiscussion(input.projectId, input.draftId, { messages: discussion.messages }, discussion);
}

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

  await updateDiscussion(projectId, draftId, { cards: discussion.cards }, discussion);
}


export async function resolveCardReferences(
  projectId: number,
  draftId: number,
  rawIds: string[]
): Promise<Array<{ cardId: string; cardTitle: string }>> {
  const discussion = await loadDiscussion(projectId, draftId);
  if (!discussion) return [];

  const fullIds = rawIds.map(rawId => {
    if (rawId.length <= 8) {
      const indexEntry = discussion.cards.find(c => c.shortId === rawId);
      return indexEntry?.id ?? rawId;
    }
    return rawId;
  });

  const cards = await Promise.all(
    fullIds.map(id => loadCard(projectId, draftId, id))
  );

  return cards
    .map((card, i) => card ? { cardId: fullIds[i], cardTitle: card.title || `卡片 ${card.shortId}` } : null)
    .filter((r): r is { cardId: string; cardTitle: string } => r !== null);
}


export { getDiscussionPath, getCardPath, getTranscriptPath, toContainerPath };