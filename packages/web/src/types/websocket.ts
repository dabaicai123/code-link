export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'user_joined'
  | 'user_left'
  | 'chat'
  | 'file_change'
  | 'build_status';

export interface BaseWSMessage {
  type: string;
  timestamp: string;
}

export interface ChatWSMessage extends BaseWSMessage {
  type: 'chat';
  projectId: number;
  userId: number;
  userName: string;
  content: string;
}

export interface UserEventWSMessage extends BaseWSMessage {
  type: 'user_joined' | 'user_left';
  projectId: number;
  userId: number;
  userName: string;
}