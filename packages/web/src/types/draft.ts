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
  project_id: number;
  title: string;
  status: DraftStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DraftMember {
  id: number;
  draft_id: number;
  user_id: number;
  role: DraftMemberRole;
  joined_at: string;
  user_name?: string;
  user_email?: string;
}

export interface DraftMessage {
  id: number;
  draft_id: number;
  parent_id: number | null;
  user_id: number;
  user_name?: string;
  content: string;
  message_type: MessageType;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageConfirmation {
  id: number;
  message_id: number;
  user_id: number;
  type: ConfirmationType;
  comment: string | null;
  created_at: string;
  user_name?: string;
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
  confirmed: '#22c55e',
  archived: 'var(--text-secondary)',
};