type EventHandler = (data: unknown) => void;

export interface WebSocketBaseOptions {
  url: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
}

export class WebSocketBase {
  protected ws: WebSocket | null = null;
  protected url: string;
  protected handlers: Map<string, Set<EventHandler>> = new Map();
  protected reconnectAttempts = 0;
  protected maxReconnectAttempts: number;
  protected reconnectBaseDelay: number;
  protected reconnectMaxDelay: number;
  protected reconnectTimeout: NodeJS.Timeout | null = null;
  protected isManualDisconnect = false;

  constructor(options: WebSocketBaseOptions | string) {
    if (typeof options === 'string') {
      this.url = options;
      this.maxReconnectAttempts = 5;
      this.reconnectBaseDelay = 1000;
      this.reconnectMaxDelay = 30000;
    } else {
      this.url = options.url;
      this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
      this.reconnectBaseDelay = options.reconnectBaseDelay ?? 1000;
      this.reconnectMaxDelay = options.reconnectMaxDelay ?? 30000;
    }

    this.connect();
  }

  protected connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
        if (data.type) {
          this.emit(data.type, data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.emit('disconnected', {});
      if (!this.isManualDisconnect) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error });
    };
  }

  protected attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('error', { message: 'Max reconnect attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
      this.reconnectMaxDelay
    );

    console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  protected emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  send(data: object): void {
    if (this.ws?.readyState === 1) { // WebSocket.OPEN
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === 1; // WebSocket.OPEN
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}