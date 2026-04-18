// packages/server/src/types/draft.ts

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
  | 'system';

export type ConfirmationType = 'agree' | 'disagree' | 'suggest';

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
}

export interface DraftMessage {
  id: number;
  draft_id: number;
  parent_id: number | null;
  user_id: number;
  content: string;
  message_type: MessageType;
  metadata: string | null; // JSON string
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
}

export interface CreateDraftInput {
  projectId: number;
  title: string;
  memberIds?: number[];
}

export interface UpdateDraftInput {
  title?: string;
  status?: DraftStatus;
}

export interface CreateMessageInput {
  content: string;
  messageType: MessageType;
  parentId?: number;
  metadata?: Record<string, unknown>;
}
