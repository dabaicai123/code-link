// src/routes/terminal.ts
import type WebSocket from 'ws';
import type Database from 'better-sqlite3';
import { getTerminalManager } from '../terminal/terminal-manager.js';
import { getContainerStatus } from '../docker/container-manager.js';
import { createLogger } from '../logger/index.js';
import type { Project } from '../types.js';

const logger = createLogger('terminal');

// 终端消息类型
interface TerminalStartMessage {
  type: 'start';
  cols: number;
  rows: number;
}

interface TerminalInputMessage {
  type: 'input';
  sessionId: string;
  data: string;
}

interface TerminalResizeMessage {
  type: 'resize';
  sessionId: string;
  cols: number;
  rows: number;
}

interface TerminalPingMessage {
  type: 'ping';
}

type TerminalClientMessage = TerminalStartMessage | TerminalInputMessage | TerminalResizeMessage | TerminalPingMessage;

// 响应消息类型
interface TerminalStartedMessage {
  type: 'started';
  sessionId: string;
}

interface TerminalOutputMessage {
  type: 'output';
  data: string;
}

interface TerminalExitMessage {
  type: 'exit';
}

interface TerminalErrorMessage {
  type: 'error';
  message: string;
}

interface TerminalPongMessage {
  type: 'pong';
}

type TerminalServerMessage = TerminalStartedMessage | TerminalOutputMessage | TerminalExitMessage | TerminalErrorMessage | TerminalPongMessage;

/**
 * 处理终端 WebSocket 连接
 * @param ws WebSocket 连接
 * @param projectId 项目 ID
 * @param userId 用户 ID
 * @param db 数据库实例
 */
export function handleTerminalConnection(
  ws: WebSocket,
  projectId: number,
  userId: number,
  db: Database.Database
): void {
  const terminalManager = getTerminalManager();

  // 当前活跃的会话 ID
  let currentSessionId: string | null = null;

  // 发送消息的辅助函数
  function sendMessage(msg: TerminalServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // 权限检查：检查用户是否是项目成员
  function checkProjectAccess(): { hasAccess: boolean; project?: Project } {
    // 检查项目是否存在
    const project = db
      .prepare('SELECT id, name, template_type, container_id, status, created_by, created_at FROM projects WHERE id = ?')
      .get(projectId) as Project | undefined;

    if (!project) {
      return { hasAccess: false };
    }

    // 检查用户是否是项目成员
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      return { hasAccess: false };
    }

    return { hasAccess: true, project };
  }

  // 处理 start 消息
  async function handleStart(msg: TerminalStartMessage): Promise<void> {
    const access = checkProjectAccess();
    if (!access.hasAccess || !access.project) {
      sendMessage({ type: 'error', message: '项目不存在或无权访问' });
      return;
    }

    const project = access.project;

    // 检查项目是否有容器
    if (!project.container_id) {
      sendMessage({ type: 'error', message: '项目没有关联的容器，请先启动容器' });
      return;
    }

    // 检查容器状态
    try {
      const status = await getContainerStatus(project.container_id);
      if (status !== 'running') {
        sendMessage({ type: 'error', message: '容器未运行，请先启动容器' });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取容器状态失败';
      sendMessage({ type: 'error', message });
      return;
    }

    // 创建终端会话
    try {
      const sessionId = await terminalManager.createSession(
        project.container_id,
        ws,
        msg.cols || 80,
        msg.rows || 24
      );
      currentSessionId = sessionId;
      sendMessage({ type: 'started', sessionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建终端会话失败';
      sendMessage({ type: 'error', message });
    }
  }

  // 处理 input 消息
  function handleInput(msg: TerminalInputMessage): void {
    if (!currentSessionId) {
      sendMessage({ type: 'error', message: '终端会话未启动' });
      return;
    }

    if (msg.sessionId !== currentSessionId) {
      sendMessage({ type: 'error', message: '会话 ID 不匹配' });
      return;
    }

    terminalManager.handleInput(msg.sessionId, msg.data);
  }

  // 处理 resize 消息
  async function handleResize(msg: TerminalResizeMessage): Promise<void> {
    if (!currentSessionId) {
      sendMessage({ type: 'error', message: '终端会话未启动' });
      return;
    }

    if (msg.sessionId !== currentSessionId) {
      sendMessage({ type: 'error', message: '会话 ID 不匹配' });
      return;
    }

    try {
      await terminalManager.resize(msg.sessionId, msg.cols, msg.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : '调整终端大小失败';
      sendMessage({ type: 'error', message });
    }
  }

  // 处理 ping 消息
  function handlePing(): void {
    sendMessage({ type: 'pong' });
  }

  // 监听消息
  ws.on('message', (data: Buffer) => {
    let parsed: TerminalClientMessage;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      sendMessage({ type: 'error', message: '无效的消息格式' });
      return;
    }

    switch (parsed.type) {
      case 'start':
        handleStart(parsed as TerminalStartMessage);
        break;
      case 'input':
        handleInput(parsed as TerminalInputMessage);
        break;
      case 'resize':
        handleResize(parsed as TerminalResizeMessage);
        break;
      case 'ping':
        handlePing();
        break;
      default:
        sendMessage({ type: 'error', message: '未知的消息类型' });
    }
  });

  // 监听关闭事件
  ws.on('close', () => {
    if (currentSessionId) {
      terminalManager.closeSession(currentSessionId);
      currentSessionId = null;
    }
  });

  // 监听错误事件
  ws.on('error', (error: Error) => {
    logger.error('Terminal WebSocket error', error);
    if (currentSessionId) {
      terminalManager.closeSession(currentSessionId);
      currentSessionId = null;
    }
  });
}