// packages/web/src/types/card.ts

export type CardType =
  | 'brainstorming'
  | 'writing_plans'
  | 'development'
  | 'free_chat'
  | 'test'
  | 'archive';

export type CardStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'paused'
  | 'failed';

export interface Card {
  id: string;
  shortId: string;              // UUID 前 8 位，用于引用和显示
  draftId: number;
  projectId: number;
  cardType: CardType;
  cardStatus: CardStatus;
  title: string;
  summary: string;
  result: string;
  parentCardId: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  transcriptPath: string;
}

export interface CardReference {
  cardId: string;
  cardTitle: string;
}

// 颜色配置
export const CARD_TYPE_COLORS: Record<CardType, string> = {
  brainstorming: '#1890ff',
  writing_plans: '#722ed1',
  development: '#52c41a',
  free_chat: '#13c2c2',
  test: '#fa8c16',
  archive: '#8c8c8c',
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  brainstorming: '头脑风暴',
  writing_plans: '实现计划',
  development: '开发执行',
  free_chat: '自由对话',
  test: '测试',
  archive: '归档',
};

export const STATUS_COLORS: Record<CardStatus, string> = {
  pending: '#1890ff',
  running: '#52c41a',
  completed: '#52c41a',
  paused: '#faad14',
  failed: '#ff4d4f',
};

export const STATUS_LABELS: Record<CardStatus, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  paused: '已中断',
  failed: '失败',
};

export interface CodingLock {
  holderId: number;
  holderName: string;
  cardId: string | null;
  status: 'active' | 'paused';
  acquiredAt: string;
}

export interface DiscussionFile {
  draftId: number;
  projectId: number;
  draftTitle: string;
  status: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  messages: Array<{
    id: number;
    userName: string;
    content: string;
    messageType: string;
    createdAt: string;
  }>;
  cards: Array<{
    id: string;
    shortId: string;
    cardType: CardType;
    cardStatus: CardStatus;
    title: string;
    parentCardId: string | null;
    createdAt: string;
  }>;
  mainCardId: string | null;
  codingLock: CodingLock | null;
  updatedAt: string;
}