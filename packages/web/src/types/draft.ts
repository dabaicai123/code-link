// packages/web/src/types/draft.ts

export type DraftStatus =
  | 'discussing'
  | 'brainstorming'
  | 'reviewing'
  | 'developing'
  | 'confirmed'
  | 'archived';

export type DraftMemberRole = 'owner' | 'participant';

export type MessageType =
  | 'text'
  | 'image'
  | 'code'
  | 'document_card'
  | 'ai_command'
  | 'ai_response'
  | 'system';

export type AICommandType =
  | 'generate'
  | 'analyze'
  | 'suggest'
  | 'explain'
  | 'review'
  | 'refactor'
  | 'test';

export type ConfirmationType = 'agree' | 'disagree' | 'suggest';

export interface AICommandMetadata {
  aiCommandType?: AICommandType;
  model?: string;
}

export interface Draft {
  id: number;
  projectId: number;
  title: string;
  status: DraftStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftMember {
  id: number;
  draftId: number;
  userId: number;
  role: DraftMemberRole;
  joinedAt: string;
  userName?: string;
  userEmail?: string;
}

export interface DraftMessage {
  id: number;
  draftId: number;
  parentId: number | null;
  userId: number;
  userName?: string;
  content: string;
  messageType: MessageType;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageConfirmation {
  id: number;
  messageId: number;
  userId: number;
  type: ConfirmationType;
  comment: string | null;
  createdAt: string;
  userName?: string;
}

export interface CreateDraftInput {
  projectId: number;
  title: string;
  memberIds?: number[];
}

export interface SendMessageInput {
  content: string;
  messageType?: MessageType;
  parentId?: number;
  metadata?: Record<string, unknown>;
}

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  discussing: '讨论中',
  brainstorming: '头脑风暴',
  reviewing: '评审中',
  developing: '开发中',
  confirmed: '已确认',
  archived: '已归档',
};

export const DRAFT_STATUS_COLORS: Record<DraftStatus, string> = {
  discussing: 'var(--status-info)',
  brainstorming: 'var(--accent-color)',
  reviewing: 'var(--status-warning)',
  developing: 'var(--status-success)',
  confirmed: 'var(--color-success)',
  archived: 'var(--text-secondary)',
};