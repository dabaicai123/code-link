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
  execClaudeCommand,
  type ExecSession,
} from './docker-exec.js';
import { normalizeError, getErrorMessage } from '../../../core/errors/index.js';
import { createLogger } from '../../../core/logger/index.js';

const logger = createLogger('terminal-mgr');

export interface TerminalSession {
  id: string;
  containerId: string;
  ws: WebSocketLike;
  execSession: ExecSession;
  cols: number;
  rows: number;
  createdAt: Date;
  userEnv: Record<string, string>;
  hasSessionHistory: boolean;
}

export interface TerminalMessage {
  type: 'output' | 'exit' | 'error' | 'claudeStream' | 'toolStart' | 'toolEnd' | 'claudeDone' | 'claudeError' | 'cost';
  data?: string;
  message?: string;
  sessionId?: string;
  text?: string;
  toolUseId?: string;
  name?: string;
  input?: string;
  kind?: string;
  result?: string;
  cost?: { inputTokens: number; outputTokens: number; totalCost: number };
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
        userEnv: userEnv ?? {},
        hasSessionHistory: false,
      };

      // 监听容器输出
      execSession.stream.on('data', (data: Buffer) => {
        // Send raw terminal output (backward compat)
        this.sendToWebSocket(ws, {
          type: 'output',
          data: data.toString('base64'),
        });
        // Parse Claude CLI JSONL output for structured events
        const text = data.toString('utf-8');
        this.parseClaudeOutput(ws, sessionId, text);
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
      const message = getErrorMessage(error) || 'Failed to create terminal session';
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
      logger.error(`Failed to write input to session ${sessionId}`, normalizeError(error));
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
      logger.error(`Failed to resize session ${sessionId}`, normalizeError(error));
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
      logger.error(`Error closing session ${sessionId}`, normalizeError(error));
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
      logger.error(`Failed to send message to session ${sessionId}`, normalizeError(error));
    }
  }

  /**
   * Run a Claude CLI command as a separate process and emit structured events.
   * Uses --print --verbose --output-format stream-json for JSONL output.
   * First message starts a new session; subsequent messages use --continue
   * to maintain conversation context within the same session.
   */
  async runClaudeCommand(sessionId: string, prompt: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found for claude command`);
      this.sendToWebSocket(session.ws, {
        type: 'claudeError',
        sessionId,
        message: 'Terminal session not found',
      });
      return;
    }

    try {
      const result = await execClaudeCommand(
        session.containerId,
        prompt,
        session.userEnv,
        session.hasSessionHistory
      );

      // Mark that this session now has conversation history for future --continue
      session.hasSessionHistory = true;

      if (result.exitCode !== 0 && !result.stdout) {
        this.sendToWebSocket(session.ws, {
          type: 'claudeError',
          sessionId,
          message: result.stderr || `Claude command failed (exit code ${result.exitCode})`,
        });
        return;
      }

      // Parse JSONL output from stdout
      const lines = result.stdout.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          switch (event.type) {
            case 'system':
              // Init event — no action needed for chat
              break;
            case 'assistant':
              if (event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'text') {
                    this.sendToWebSocket(session.ws, {
                      type: 'claudeStream',
                      sessionId,
                      text: block.text,
                    });
                  } else if (block.type === 'tool_use') {
                    this.sendToWebSocket(session.ws, {
                      type: 'toolStart',
                      sessionId,
                      toolUseId: block.id,
                      name: block.name,
                      input: JSON.stringify(block.input),
                    });
                  }
                }
              }
              break;
            case 'tool_result':
              this.sendToWebSocket(session.ws, {
                type: 'toolEnd',
                sessionId,
                toolUseId: event.tool_use_id,
                result: event.content,
              });
              break;
            case 'result':
              this.sendToWebSocket(session.ws, {
                type: 'claudeDone',
                sessionId,
                cost: event.total_cost_usd ? {
                  inputTokens: event.usage?.input_tokens ?? 0,
                  outputTokens: event.usage?.output_tokens ?? 0,
                  totalCost: event.total_cost_usd,
                } : undefined,
              });
              break;
            case 'error':
              this.sendToWebSocket(session.ws, {
                type: 'claudeError',
                sessionId,
                message: event.message || 'Unknown error',
              });
              break;
          }
        } catch {
          // Not JSON — skip
        }
      }
    } catch (error) {
      logger.error(`Failed to run claude command for session ${sessionId}`, normalizeError(error));
      this.sendToWebSocket(session.ws, {
        type: 'claudeError',
        sessionId,
        message: normalizeError(error).message || 'Failed to execute Claude command',
      });
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

  /**
   * Parse Claude CLI JSONL output for structured events
   */
  private parseClaudeOutput(ws: WebSocketLike, sessionId: string, text: string): void {
    const lines = text.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        switch (event.type) {
          case 'assistant':
            if (event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text') {
                  this.sendToWebSocket(ws, {
                    type: 'claudeStream',
                    sessionId,
                    text: block.text,
                  });
                } else if (block.type === 'tool_use') {
                  this.sendToWebSocket(ws, {
                    type: 'toolStart',
                    sessionId,
                    toolUseId: block.id,
                    name: block.name,
                    input: JSON.stringify(block.input),
                  });
                }
              }
            }
            break;
          case 'tool_result':
            this.sendToWebSocket(ws, {
              type: 'toolEnd',
              sessionId,
              toolUseId: event.tool_use_id,
              result: event.content,
            });
            break;
          case 'result':
            this.sendToWebSocket(ws, {
              type: 'claudeDone',
              sessionId,
              cost: event.cost_usd ? {
                inputTokens: event.input_tokens ?? 0,
                outputTokens: event.output_tokens ?? 0,
                totalCost: event.cost_usd,
              } : undefined,
            });
            break;
          case 'error':
            this.sendToWebSocket(ws, {
              type: 'claudeError',
              sessionId,
              message: event.message || 'Unknown error',
            });
            break;
        }
      } catch {
        // Not JSON - skip, it's raw terminal output
      }
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
