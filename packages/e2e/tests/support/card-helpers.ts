import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || path.join(process.cwd(), 'data', 'transcripts');

export interface CreateCardParams {
  projectId: number;
  draftId: number;
  cardType: string;
  cardStatus: string;
  title: string;
  summary: string;
  result?: string;
  userId: number;
  userName: string;
}

export async function createCardViaFS(params: CreateCardParams): Promise<{ id: string; shortId: string }> {
  const id = randomUUID();
  const shortId = id.slice(0, 8);
  const now = new Date().toISOString();
  const draftDir = path.join(TRANSCRIPTS_DIR, String(params.projectId), String(params.draftId));

  await fs.mkdir(draftDir, { recursive: true });

  const cardData = {
    id,
    shortId,
    draftId: params.draftId,
    projectId: params.projectId,
    cardType: params.cardType,
    cardStatus: params.cardStatus,
    parentCardId: null,
    title: params.title,
    summary: params.summary,
    result: params.result || '',
    transcriptPath: path.join(draftDir, `${id}-transcript.json`),
    createdBy: params.userId,
    createdByName: params.userName,
    createdAt: now,
    updatedAt: now,
  };

  // Write card file
  await fs.writeFile(
    path.join(draftDir, `${id}.json`),
    JSON.stringify(cardData, null, 2)
  );

  // Write empty transcript file
  await fs.writeFile(
    path.join(draftDir, `${id}-transcript.json`),
    JSON.stringify([], null, 2)
  );

  // Update discussion.json (append card to cards array)
  const discussionPath = path.join(draftDir, 'discussion.json');
  let discussion: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(discussionPath, 'utf-8');
    discussion = JSON.parse(content);
  } catch {
    discussion = {
      draftId: params.draftId,
      projectId: params.projectId,
      draftTitle: '',
      status: 'discussing',
      createdBy: params.userId,
      createdByName: params.userName,
      createdAt: now,
      messages: [],
      cards: [],
      mainCardId: null,
      codingLock: null,
      updatedAt: now,
    };
  }

  const cards = (discussion.cards || []) as Array<Record<string, unknown>>;
  cards.push({
    id,
    shortId,
    cardType: params.cardType,
    cardStatus: params.cardStatus,
    title: params.title,
    parentCardId: null,
    createdAt: now,
  });
  discussion.cards = cards;
  discussion.updatedAt = now;

  await fs.writeFile(discussionPath, JSON.stringify(discussion, null, 2));

  return { id, shortId };
}