import { WebSocketBase } from './base';

export interface TerminalMessage {
  type: string;
  sessionId?: string;
  cols?: number;
  rows?: number;
  data?: string;
  message?: string;
}

type OutputHandler = (data: string) => void;
type ExitHandler = () => void;
type ErrorHandler = (message: string) => void;
type StartedHandler = (sessionId: string) => void;

export class TerminalWebSocket extends WebSocketBase {
  private sessionId: string | null = null;
  private projectId: string;
  private userId: string;

  private onOutputHandler: OutputHandler | null = null;
  private onExitHandler: ExitHandler | null = null;
  private onErrorHandler: ErrorHandler | null = null;
  private onStartedHandler: StartedHandler | null = null;

  constructor(baseUrl: string, projectId: string, userId: string) {
    const url = `${baseUrl}?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;
    super(url);
    this.projectId = projectId;
    this.userId = userId;

    this.on('message', this.handleTerminalMessage.bind(this));
  }

  private handleTerminalMessage(message: TerminalMessage): void {
    switch (message.type) {
      case 'started':
        if (message.sessionId) {
          this.sessionId = message.sessionId;
          this.onStartedHandler?.(message.sessionId);
        }
        break;

      case 'output':
        if (message.data) {
          try {
            const decoded = this.decodeBase64(message.data);
            this.onOutputHandler?.(decoded);
          } catch {
            this.onOutputHandler?.(message.data);
          }
        }
        break;

      case 'exit':
        this.sessionId = null;
        this.onExitHandler?.();
        break;

      case 'error':
        this.onErrorHandler?.(message.message || 'Unknown error');
        break;

      case 'pong':
        break;

      default:
        console.warn('Unknown terminal message type:', message.type);
    }
  }

  start(cols: number, rows: number): void {
    this.send({
      type: 'start',
      cols,
      rows,
    });
  }

  sendInput(data: string): void {
    if (!this.sessionId) {
      console.warn('No active session, cannot send input');
      return;
    }

    const encoded = this.encodeBase64(data);
    this.send({
      type: 'input',
      sessionId: this.sessionId,
      data: encoded,
    });
  }

  resize(cols: number, rows: number): void {
    if (!this.sessionId) return;

    this.send({
      type: 'resize',
      sessionId: this.sessionId,
      cols,
      rows,
    });
  }

  ping(): void {
    this.send({ type: 'ping' });
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setOnOutput(handler: OutputHandler): void {
    this.onOutputHandler = handler;
  }

  setOnExit(handler: ExitHandler): void {
    this.onExitHandler = handler;
  }

  setOnError(handler: ErrorHandler): void {
    this.onErrorHandler = handler;
  }

  setOnStarted(handler: StartedHandler): void {
    this.onStartedHandler = handler;
  }

  private decodeBase64(base64: string): string {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  private encodeBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}