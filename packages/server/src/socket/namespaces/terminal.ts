// packages/server/src/socket/namespaces/terminal.ts
import type { Namespace, Socket } from 'socket.io';
import { createLogger } from '../../logger/index.js';
import { TerminalEvents } from '../types.js';
import { getTerminalManager } from '../../terminal/terminal-manager.js';
import { getContainerStatus } from '../../docker/container-manager.js';
import { decrypt, isEncryptionKeySet } from '../../crypto/aes.js';
import { ProjectRepository, ClaudeConfigRepository, OrganizationRepository } from '../../repositories/index.js';

const logger = createLogger('socket-terminal');

const projectRepo = new ProjectRepository();
const claudeConfigRepo = new ClaudeConfigRepository();
const orgRepo = new OrganizationRepository();

export function setupTerminalNamespace(namespace: Namespace): void {
  namespace.on('connection', async (socket) => {
    const { userId } = socket.data;
    logger.info(`Terminal socket connected: userId=${userId}`);

    let currentSessionId: string | null = null;
    const terminalManager = getTerminalManager();

    // 启动终端
    socket.on('start', async (data: unknown) => {
      const parsed = TerminalEvents.start.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid start data' });
        return;
      }

      const { projectId, cols, rows } = parsed.data;

      // 权限检查
      const project = await projectRepo.findById(projectId);
      if (!project) {
        socket.emit('error', { message: '项目不存在或无权访问' });
        return;
      }

      const membership = await orgRepo.findUserMembership(project.organizationId, userId);
      if (!membership) {
        socket.emit('error', { message: '项目不存在或无权访问' });
        return;
      }

      if (!project.containerId) {
        socket.emit('error', { message: '项目没有关联的容器，请先启动容器' });
        return;
      }

      // 检查容器状态
      try {
        const status = await getContainerStatus(project.containerId);
        if (status !== 'running') {
          socket.emit('error', { message: '容器未运行，请先启动容器' });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '获取容器状态失败';
        socket.emit('error', { message });
        return;
      }

      // 获取用户配置
      const configRow = await claudeConfigRepo.findByUserId(userId);
      if (!configRow) {
        socket.emit('error', { message: '请先在「设置 → Claude Code 配置」中完成配置后再使用终端' });
        return;
      }

      let userEnv: Record<string, string> = {};
      try {
        if (!isEncryptionKeySet()) {
          socket.emit('error', { message: '服务器加密密钥未配置，请联系管理员' });
          return;
        }

        const config = JSON.parse(decrypt(configRow.config));
        if (config.env && typeof config.env === 'object') {
          userEnv = config.env;
        }

        if (!userEnv.ANTHROPIC_AUTH_TOKEN) {
          socket.emit('error', { message: 'ANTHROPIC_AUTH_TOKEN 未配置，请完善配置后再使用终端' });
          return;
        }
      } catch (error) {
        logger.error('Failed to decrypt user config', error);
        socket.emit('error', { message: '用户配置解密失败，请重新配置' });
        return;
      }

      // 创建终端会话
      try {
        // 使用 Socket.IO 的二进制传输
        const sessionId = await terminalManager.createSession(
          project.containerId,
          createSocketIOWriter(socket),
          cols || 80,
          rows || 24,
          userEnv
        );
        currentSessionId = sessionId;
        socket.emit('started', { sessionId });
      } catch (error) {
        const message = error instanceof Error ? error.message : '创建终端会话失败';
        socket.emit('error', { message });
      }
    });

    // 输入
    socket.on('input', (data: unknown) => {
      const parsed = TerminalEvents.input.safeParse(data);
      if (!parsed.success || !currentSessionId) return;

      const { sessionId, data: inputData } = parsed.data;
      if (sessionId !== currentSessionId) return;

      terminalManager.handleInput(sessionId, inputData);
    });

    // 调整大小
    socket.on('resize', async (data: unknown) => {
      const parsed = TerminalEvents.resize.safeParse(data);
      if (!parsed.success || !currentSessionId) return;

      const { sessionId, cols, rows } = parsed.data;
      if (sessionId !== currentSessionId) return;

      try {
        await terminalManager.resize(sessionId, cols, rows);
      } catch (error) {
        logger.error('Failed to resize terminal', error);
      }
    });

    // Ping
    socket.on('ping', () => {
      socket.emit('pong', {});
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`Terminal socket disconnected: userId=${userId}`);
      if (currentSessionId) {
        terminalManager.closeSession(currentSessionId);
        currentSessionId = null;
      }
    });
  });
}

// 创建 Socket.IO 写入器适配器
function createSocketIOWriter(socket: Socket): { readyState: number; send: (data: string) => void; on: (event: string, handler: () => void) => void; OPEN: number } {
  return {
    readyState: 1, // OPEN
    OPEN: 1,
    send: (data: string) => {
      const msg = JSON.parse(data);
      socket.emit(msg.type, msg);
    },
    on: (event: string, handler: () => void) => {
      socket.on(event, handler);
    },
  };
}