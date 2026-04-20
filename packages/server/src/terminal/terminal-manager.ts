// src/terminal/terminal-manager.ts
// 通用 WebSocket 接口
export interface WebSocketLike {
  readyState: number;
  send: (data: string) => void;
  on: (event: string, handler: () => void) => void;
  OPEN: number;
}
import {
  streamExecOutput,
  resizeExecTTY,
  writeToExecStream,
  closeExecStdin,
  execWithUserEnv,
  type ExecSession,
} from './docker-exec.js';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('terminal-mgr');

export interface TerminalSession {
  id: string;
  containerId: string;
  ws: WebSocketLike;
  execSession: ExecSession;
  cols: number;
  rows: number;
  createdAt: Date;
}

export interface TerminalMessage {
  type: 'output' | 'exit' | 'error';
  data?: string;
  message?: string;
}

class TerminalManagerImpl {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionCounter: number = 0;

  /**
   * 创建终端会话
   * @param containerId 容器 ID
   * @param ws WebSocket 连接
   * @param cols 终端列数
   * @param rows 终端行数
   * @param userEnv 用户环境变量
   * @returns 会话 ID
   */
  async createSession(
    containerId: string,
    ws: WebSocketLike,
    cols: number = 80,
    rows: number = 24,
    userEnv?: Record<string, string>
  ): Promise<string> {
    const sessionId = `term-${++this.sessionCounter}-${Date.now()}`;

    try {
      // 启动交互式 shell，优先启动 claude，退出后回退到 bash/sh
      // 使用带用户环境变量的 exec
      const execSession = userEnv
        ? await execWithUserEnv(containerId, ['/bin/sh', '-c', 'claude || exec bash || exec sh'], true, userEnv)
        : await streamExecOutput(containerId, ['/bin/sh', '-c', 'claude || exec bash || exec sh'], true, { env: ['TERM=xterm-256color'] });

      const session: TerminalSession = {
        id: sessionId,
        containerId,
        ws,
        execSession,
        cols,
        rows,
        createdAt: new Date(),
      };

      // 监听容器输出
      execSession.stream.on('data', (data: Buffer) => {
        this.sendToWebSocket(ws, {
          type: 'output',
          data: data.toString('base64'),
        });
      });

      // 监听 stream 错误
      execSession.stream.on('error', (error: Error) => {
        logger.error(`Terminal session ${sessionId} stream error`, error);
        this.sendToWebSocket(ws, {
          type: 'error',
          message: error.message,
        });
      });

      // 监听 stream 结束
      execSession.stream.on('end', () => {
        this.sendToWebSocket(ws, { type: 'exit' });
        this.sessions.delete(sessionId);
      });

      this.sessions.set(sessionId, session);
      return sessionId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create terminal session';
      this.sendToWebSocket(ws, {
        type: 'error',
        message,
      });
      throw error;
    }
  }

  /**
   * 处理终端输入
   * @param sessionId 会话 ID
   * @param data base64 编码的输入数据
   */
  handleInput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found for input`);
      return;
    }

    try {
      // 解码 base64 输入
      const decoded = Buffer.from(data, 'base64').toString();
      writeToExecStream(session.execSession.stream as unknown as NodeJS.WritableStream, decoded);
    } catch (error) {
      logger.error(`Failed to write input to session ${sessionId}`, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 调整终端大小
   * @param sessionId 会话 ID
   * @param cols 列数
   * @param rows 行数
   */
  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found for resize`);
      return;
    }

    try {
      await resizeExecTTY(session.execSession.exec, cols, rows);
      session.cols = cols;
      session.rows = rows;
    } catch (error) {
      logger.error(`Failed to resize session ${sessionId}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 关闭会话
   * @param sessionId 会话 ID
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // 移除所有事件监听器，防止内存泄漏
      session.execSession.stream.removeAllListeners();

      // 关闭 stdin
      closeExecStdin(session.execSession.stream as unknown as NodeJS.WritableStream);

      // 关闭 WebSocket 连接
      if (session.ws.readyState === session.ws.OPEN) {
        session.ws.send(JSON.stringify({ type: 'exit' }));
      }

      // 从 sessions map 中删除
      this.sessions.delete(sessionId);
    } catch (error) {
      logger.error(`Error closing session ${sessionId}`, error instanceof Error ? error : new Error(String(error)));
      // 即使出错也要删除会话
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 关闭所有会话
   */
  closeAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }
  }

  /**
   * 获取会话信息
   * @param sessionId 会话 ID
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取会话数量
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 获取指定容器的所有会话
   * @param containerId 容器 ID
   */
  getSessionsByContainer(containerId: string): TerminalSession[] {
    const result: TerminalSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.containerId === containerId) {
        result.push(session);
      }
    }
    return result;
  }

  /**
   * 发送消息到终端 stdin
   * @param sessionId 会话 ID
   * @param encodedMessage Base64 编码的消息
   */
  sendToTerminal(sessionId: string, encodedMessage: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found for sending message`);
      return;
    }

    try {
      // 解码 Base64 消息
      const decoded = Buffer.from(encodedMessage, 'base64').toString('utf-8');

      // 写入终端 stdin
      writeToExecStream(
        session.execSession.stream as unknown as NodeJS.WritableStream,
        decoded
      );

      logger.info(`Message sent to terminal session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to send message to session ${sessionId}`, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 发送消息到 WebSocket
   */
  private sendToWebSocket(ws: WebSocketLike, msg: TerminalMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

// 全局单例
let terminalManagerInstance: TerminalManagerImpl | null = null;

export function getTerminalManager(): TerminalManagerImpl {
  if (!terminalManagerInstance) {
    terminalManagerInstance = new TerminalManagerImpl();
  }
  return terminalManagerInstance;
}

// 重置实例（用于测试）
export function resetTerminalManagerInstance(): void {
  if (terminalManagerInstance) {
    terminalManagerInstance.closeAll();
  }
  terminalManagerInstance = null;
}

// 导出类型
export type TerminalManager = TerminalManagerImpl;
