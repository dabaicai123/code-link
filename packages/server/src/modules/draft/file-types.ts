// packages/server/src/modules/draft/file-types.ts

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

export type CodingLockStatus = 'active' | 'paused';

// 卡片数据
export interface CardData {
  id: string;                    // UUID
  shortId: string;               // UUID 前 8 位，用于用户引用
  draftId: number;
  projectId: number;
  cardType: CardType;
  cardStatus: CardStatus;
  parentCardId: string | null;
  title: string;
  summary: string;
  result: string;
  transcriptPath: string;        // 指向 transcript 文件的路径
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// 驾驶权
export interface CodingLock {
  holderId: number;
  holderName: string;
  cardId: string | null;
  status: CodingLockStatus;
  acquiredAt: string;
}

// Discussion 文件（每个 draft 的元数据）
export interface DiscussionFile {
  draftId: number;
  projectId: number;
  draftTitle: string;
  status: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;

  // 讨论消息（简化版）
  messages: Array<{
    id: number;
    userName: string;
    content: string;
    messageType: string;
    createdAt: string;
  }>;

  // 卡片索引
  cards: Array<{
    id: string;
    shortId: string;           // UUID 前 8 位
    cardType: CardType;
    cardStatus: CardStatus;
    title: string;
    parentCardId: string | null;
    createdAt: string;
  }>;

  // 主线卡片
  mainCardId: string | null;

  // 驾驶权
  codingLock: CodingLock | null;

  updatedAt: string;
}

// Draft 列表项（从文件读取）
export interface DraftListItem {
  draftId: number;
  projectId: number;
  draftTitle: string;
  status: string;
  createdBy: number;
  createdByName: string;
  cardCount: number;
  hasActiveCodingLock: boolean;
  updatedAt: string;
}