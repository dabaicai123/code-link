/**
 * TerminalWebSocket - 用于终端会话的 WebSocket 客户端
 *
 * 处理终端输入/输出的 base64 编码，管理会话状态
 */

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

export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private url: string = '';
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isManualDisconnect = false;

  // 事件处理器
  private onOutputHandler: OutputHandler | null = null;
  private onExitHandler: ExitHandler | null = null;
  private onErrorHandler: ErrorHandler | null = null;
  private onStartedHandler: StartedHandler | null = null;
  private onConnectedHandler: (() => void) | null = null;
  private onDisconnectedHandler: (() => void) | null = null;

  /**
   * 连接到终端 WebSocket 服务器
   */
  connect(url: string, projectId: string, userId: string): void {
    this.url = `${url}?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;
    this.isManualDisconnect = false;
    this.createConnection();
  }

  private createConnection(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Terminal WebSocket connected');
      this.reconnectAttempts = 0;
      this.onConnectedHandler?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: TerminalMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse terminal message:', error);
      }
    };

    this.ws.onclose = () => {
      this.onDisconnectedHandler?.();
      if (!this.isManualDisconnect) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
      this.onErrorHandler?.('WebSocket connection error');
    };
  }

  private handleMessage(message: TerminalMessage): void {
    switch (message.type) {
      case 'started':
        if (message.sessionId) {
          this.sessionId = message.sessionId;
          this.onStartedHandler?.(message.sessionId);
        }
        break;

      case 'output':
        if (message.data) {
          // 解码 base64 输出（正确处理 UTF-8）
          try {
            const decoded = this.decodeBase64(message.data);
            this.onOutputHandler?.(decoded);
          } catch {
            // 如果解码失败，直接传递原始数据
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
        // 心跳响应，忽略
        break;

      default:
        console.warn('Unknown terminal message type:', message.type);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || this.isManualDisconnect) {
      console.error('Max terminal reconnect attempts reached');
      this.onErrorHandler?.('Connection lost. Please refresh to reconnect.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Reconnecting terminal... (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      if (!this.isManualDisconnect) {
        this.createConnection();
      }
    }, delay);
  }

  /**
   * 启动终端会话
   */
  start(cols: number, rows: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    this.send({
      type: 'start',
      cols,
      rows,
    });
  }

  /**
   * 发送终端输入（自动进行 base64 编码）
   */
  sendInput(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected, cannot send input');
      return;
    }

    if (!this.sessionId) {
      console.warn('No active session, cannot send input');
      return;
    }

    // 将输入编码为 base64（正确处理 UTF-8）
    const encoded = this.encodeBase64(data);
    this.send({
      type: 'input',
      sessionId: this.sessionId,
      data: encoded,
    });
  }

  /**
   * 调整终端大小
   */
  resize(cols: number, rows: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.sessionId) {
      return;
    }

    this.send({
      type: 'resize',
      sessionId: this.sessionId,
      cols,
      rows,
    });
  }

  /**
   * 发送心跳
   */
  ping(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.send({ type: 'ping' });
  }

  /**
   * 设置输出处理器
   */
  setOnOutput(handler: OutputHandler): void {
    this.onOutputHandler = handler;
  }

  /**
   * 设置退出处理器
   */
  setOnExit(handler: ExitHandler): void {
    this.onExitHandler = handler;
  }

  /**
   * 设置错误处理器
   */
  setOnError(handler: ErrorHandler): void {
    this.onErrorHandler = handler;
  }

  /**
   * 设置会话启动处理器
   */
  setOnStarted(handler: StartedHandler): void {
    this.onStartedHandler = handler;
  }

  /**
   * 设置连接成功处理器
   */
  setOnConnected(handler: () => void): void {
    this.onConnectedHandler = handler;
  }

  /**
   * 设置断开连接处理器
   */
  setOnDisconnected(handler: () => void): void {
    this.onDisconnectedHandler = handler;
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * 解码 base64 字符串为 UTF-8 字符串
   * 使用 TextDecoder 正确处理多字节字符
   */
  private decodeBase64(base64: string): string {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  }

  /**
   * 编码字符串为 base64（正确处理 UTF-8）
   */
  private encodeBase64(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.sessionId = null;
    this.ws?.close();
    this.ws = null;
  }
}