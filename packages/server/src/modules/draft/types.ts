import type { SelectDraft, SelectDraftMember, SelectDraftMessage, SelectMessageConfirmation } from '../../db/schema/index.js';

export interface DraftMemberWithUser extends SelectDraftMember {
  userName: string;
}

export interface DraftMessageWithUser extends SelectDraftMessage {
  userName: string | null;
}

export interface DraftDetail {
  draft: SelectDraft;
  members: DraftMemberWithUser[];
}

export interface MessageConfirmationWithUser extends SelectMessageConfirmation {
  userName: string;
}

export interface DraftContext {
  draft: SelectDraft & { projectName: string; projectTemplate: string; containerId: string | null };
  recentMessages: Array<{ userId: number; userName: string; content: string | null; messageType: string; createdAt: string }>;
  members: Array<{ userId: number; userName: string; role: string }>;
}
