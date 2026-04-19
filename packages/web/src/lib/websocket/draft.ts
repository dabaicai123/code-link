import { WebSocketBase } from './base';

export interface DraftWSMessage {
  type: string;
  draftId: number;
  timestamp: string;
  [key: string]: unknown;
}

export interface OnlineUser {
  userId: number;
  userName: string;
}

export class DraftWebSocket extends WebSocketBase {
  private draftId: number | null = null;
  private userId: number;
  private userName: string;

  constructor(baseUrl: string, userId: number, userName: string) {
    super(baseUrl);
    this.userId = userId;
    this.userName = userName;
  }

  subscribe(draftId: number): void {
    this.draftId = draftId;
    this.send({
      type: 'draft_subscribe',
      draftId,
      userId: this.userId,
      userName: this.userName,
    });
  }

  unsubscribe(): void {
    if (this.draftId) {
      this.send({
        type: 'draft_unsubscribe',
        draftId: this.draftId,
      });
      this.draftId = null;
    }
  }

  sendMessage(type: string, data: Record<string, unknown>): void {
    this.send({ type, ...data });
  }

  getDraftId(): number | null {
    return this.draftId;
  }
}