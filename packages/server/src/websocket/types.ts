// src/websocket/types.ts
export type MessageType =
  | 'file_change'
  | 'chat'
  | 'build_status'
  | 'user_joined'
  | 'user_left'
  | 'error';

export type FileAction = 'created' | 'modified' | 'deleted';

export interface BaseMessage {
  type: MessageType;
  projectId: number;
  timestamp: string;
}

export interface FileChangeEvent extends BaseMessage {
  type: 'file_change';
  path: string;
  action: FileAction;
  content?: string;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  userId: number;
  userName: string;
  content: string;
}

export interface BuildNotification extends BaseMessage {
  type: 'build_status';
  status: 'pending' | 'running' | 'success' | 'failed';
  previewPort?: number;
  error?: string;
}

export interface UserEvent extends BaseMessage {
  type: 'user_joined' | 'user_left';
  userId: number;
  userName: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

export type Message =
  | FileChangeEvent
  | ChatMessage
  | BuildNotification
  | UserEvent
  | ErrorMessage;

export function parseMessage(raw: string): Message | null {
  try {
    const msg = JSON.parse(raw);
    if (!msg.type || !msg.projectId) return null;
    return msg as Message;
  } catch {
    return null;
  }
}

export function createFileChangeEvent(
  projectId: number,
  path: string,
  action: FileAction,
  content?: string
): FileChangeEvent {
  return {
    type: 'file_change',
    projectId,
    path,
    action,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createChatMessage(
  projectId: number,
  userId: number,
  userName: string,
  content: string
): ChatMessage {
  return {
    type: 'chat',
    projectId,
    userId,
    userName,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createBuildNotification(
  projectId: number,
  status: BuildNotification['status'],
  previewPort?: number,
  error?: string
): BuildNotification {
  return {
    type: 'build_status',
    projectId,
    status,
    previewPort,
    error,
    timestamp: new Date().toISOString(),
  };
}

export function isFileChangeEvent(msg: Message): msg is FileChangeEvent {
  return msg.type === 'file_change';
}

export function isChatMessage(msg: Message): msg is ChatMessage {
  return msg.type === 'chat';
}

export function isBuildNotification(msg: Message): msg is BuildNotification {
  return msg.type === 'build_status';
}

// ==================== Draft 相关消息类型 ====================

export type DraftMessageType =
  | 'draft_message'
  | 'draft_member_joined'
  | 'draft_member_left'
  | 'draft_status_changed'
  | 'draft_message_confirmed'
  | 'draft_ai_response';

export interface DraftBaseMessage {
  type: DraftMessageType;
  draftId: number;
  timestamp: string;
}

export interface DraftMessageEvent extends DraftBaseMessage {
  type: 'draft_message';
  message: {
    id: number;
    draft_id: number;
    parent_id: number | null;
    user_id: number;
    user_name: string;
    content: string;
    message_type: string;
    created_at: string;
  };
}

export interface DraftMemberJoinedEvent extends DraftBaseMessage {
  type: 'draft_member_joined';
  userId: number;
  userName: string;
  memberCount: number;
}

export interface DraftMemberLeftEvent extends DraftBaseMessage {
  type: 'draft_member_left';
  userId: number;
  userName: string;
  memberCount: number;
}

export interface DraftStatusChangedEvent extends DraftBaseMessage {
  type: 'draft_status_changed';
  status: string;
}

export interface DraftMessageConfirmedEvent extends DraftBaseMessage {
  type: 'draft_message_confirmed';
  messageId: number;
  userId: number;
  userName: string;
  confirmationType: string;
}

export interface DraftAIResponseEvent extends DraftBaseMessage {
  type: 'draft_ai_response';
  message: {
    id: number;
    draft_id: number;
    parent_id: number;
    user_id: number;
    user_name: string;
    content: string;
    message_type: string;
    metadata: string | null;
    created_at: string;
  };
  commandType: string;
}

export type DraftMessage =
  | DraftMessageEvent
  | DraftMemberJoinedEvent
  | DraftMemberLeftEvent
  | DraftStatusChangedEvent
  | DraftMessageConfirmedEvent
  | DraftAIResponseEvent;

export function createDraftMessageEvent(
  draftId: number,
  message: DraftMessageEvent['message']
): DraftMessageEvent {
  return {
    type: 'draft_message',
    draftId,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftMemberJoinedEvent(
  draftId: number,
  userId: number,
  userName: string,
  memberCount: number
): DraftMemberJoinedEvent {
  return {
    type: 'draft_member_joined',
    draftId,
    userId,
    userName,
    memberCount,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftMemberLeftEvent(
  draftId: number,
  userId: number,
  userName: string,
  memberCount: number
): DraftMemberLeftEvent {
  return {
    type: 'draft_member_left',
    draftId,
    userId,
    userName,
    memberCount,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftStatusChangedEvent(
  draftId: number,
  status: string
): DraftStatusChangedEvent {
  return {
    type: 'draft_status_changed',
    draftId,
    status,
    timestamp: new Date().toISOString(),
  };
}

export function createDraftMessageConfirmedEvent(
  draftId: number,
  messageId: number,
  userId: number,
  userName: string,
  confirmationType: string
): DraftMessageConfirmedEvent {
  return {
    type: 'draft_message_confirmed',
    draftId,
    messageId,
    userId,
    userName,
    confirmationType,
    timestamp: new Date().toISOString(),
  };
}