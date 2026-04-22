// packages/server/src/socket/namespaces/terminal.ts
import "reflect-metadata";
import { container } from "tsyringe";
import type { Namespace, Socket } from 'socket.io';
import path from 'path';
import { createLogger } from '../../core/logger/index.js';
import { TerminalEvents } from '../types.js';
import { getTerminalManager } from '../../modules/container/lib/terminal-manager.js';
import { DockerService } from '../../modules/container/lib/docker.service.js';
import { decrypt, isEncryptionKeySet } from '../../crypto/aes.js';
import { ProjectRepository } from '../../modules/project/repository.js';
import { ClaudeConfigRepository } from '../../modules/claude-config/repository.js';
import { OrganizationRepository } from '../../modules/organization/repository.js';
import { sanitizeErrorMessage } from '../utils/error-sanitize.js';
import { startExecutionSession, getExecutionByTerminal, updateExecutionStatus, appendExecutionOutput, completeExecution, pauseExecution, resumeExecution } from '../../ai/execution-manager.js';
import { buildAIExecutionContext, generateClaudeCodePrompt } from '../../ai/context-builder.js';
import { parseSuperpowersCommand, parseFreeChatCommand } from '../../modules/draft/lib/commands.js';
import { acquireCodingLock, releaseCodingLock } from '../../ai/transcript.js';
import { CardType } from '../../modules/draft/file-types.js';

const logger = createLogger('socket-terminal');

// Lazy-resolved to avoid triggering DI resolution at module load time,
// which would create a DatabaseConnection before registerInstance completes
let _projectRepo: ProjectRepository | null = null;
let _claudeConfigRepo: ClaudeConfigRepository | null = null;
let _orgRepo: OrganizationRepository | null = null;
let _dockerService: DockerService | null = null;

function getProjectRepo() { return _projectRepo ??= container.resolve(ProjectRepository); }
function getClaudeConfigRepo() { return _claudeConfigRepo ??= container.resolve(ClaudeConfigRepository); }
function getOrgRepo() { return _orgRepo ??= container.resolve(OrganizationRepository); }
function getDockerService() { return _dockerService ??= container.resolve(DockerService); }

export function setupTerminalNamespace(namespace: Namespace): void {
  namespace.on('connection', async (socket) => {
    const { userId, userName } = socket.data;
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
      const project = await getProjectRepo().findById(projectId);
      if (!project) {
        socket.emit('error', { message: '项目不存在或无权访问' });
        return;
      }

      const membership = await getOrgRepo().findUserMembership(project.organizationId, userId);
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
        const status = await getDockerService().getContainerStatus(project.containerId);
        if (status !== 'running') {
          socket.emit('error', { message: '容器未运行，请先启动容器' });
          return;
        }
      } catch (error) {
        const message = sanitizeErrorMessage(error);
        socket.emit('error', { message });
        return;
      }

      // 获取用户配置
      const configRow = await getClaudeConfigRepo().findByUserId(userId);
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
        logger.error('Failed to decrypt user config', error instanceof Error ? error : new Error(String(error)));
        socket.emit('error', { message: '用户配置解密失败，请重新配置' });
        return;
      }

      // 创建终端会话
      try {
        // 使用 Socket.IO 的二进制传输
        const sessionId = await terminalManager.createSession(
          project.containerId,
          createSocketIOWriter(socket, () => currentSessionId),
          cols || 80,
          rows || 24,
          userEnv
        );
        currentSessionId = sessionId;
        socket.emit('started', { sessionId });

        // 监听 Terminal 进程退出事件
        socket.on('exit', async () => {
          const execution = getExecutionByTerminal(sessionId);
          if (execution) {
            const fullOutput = execution.output.join('\n');
            const success = isSuccessfulOutput(fullOutput);
            const summary = extractSummary(fullOutput);

            const card = await completeExecution(sessionId, success, summary);
            if (card) {
              socket.emit('aiExecutionComplete', {
                sessionId,
                projectId: execution.projectId,
                draftId: execution.draftId,
                cardId: card.id,
                success,
                summary,
              });
            }

            // 释放驾驶权
            await releaseCodingLock({
              projectId: execution.projectId,
              draftId: execution.draftId,
              userId,
            });
            namespace.emit('codingLockReleased', {
              projectId: execution.projectId,
              draftId: execution.draftId,
            });
          }
        });
      } catch (error) {
        const message = sanitizeErrorMessage(error);
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
        logger.error('Failed to resize terminal', error instanceof Error ? error : new Error(String(error)));
      }
    });

    // 发送 Claude 消息到终端
    socket.on('claude-message', (data: unknown) => {
      const parsed = TerminalEvents.claudeMessage.safeParse(data);
      if (!parsed.success || !currentSessionId) return;

      const { sessionId, data: encodedMessage, mode, agent } = parsed.data;
      if (sessionId !== currentSessionId) return;

      // Mode and agent are handled by CLI itself via message format
      terminalManager.sendToTerminal(sessionId, encodedMessage);
    });

    // Ping
    socket.on('ping', () => {
      socket.emit('pong', {});
    });

    // 执行 AI 指令
    socket.on('executeAI', async (data: unknown) => {
      const parsed = TerminalEvents.executeAI.safeParse(data);
      if (!parsed.success || !currentSessionId) {
        socket.emit('error', { message: 'Invalid executeAI data' });
        return;
      }

      const { projectId, draftId, command, args, contextCardId } = parsed.data;

      try {
        // 1. Acquire coding lock first
        const lockResult = await acquireCodingLock({
          projectId, draftId, userId, userName, cardId: contextCardId,
        });

        if (!lockResult.success) {
          socket.emit('aiExecutionError', {
            sessionId: currentSessionId,
            message: lockResult.error || '驾驶权获取失败',
          });
          return;
        }

        // Notify all clients that lock was acquired
        namespace.emit('codingLockAcquired', {
          projectId, draftId, holderId: userId, holderName: userName,
          cardId: contextCardId ?? null,
        });

        // 2. Parse command to determine cardType
        const parsedCmd = parseSuperpowersCommand(`${command} ${args}`);
        const freeChatCmd = parseFreeChatCommand(`${command} ${args}`);

        let cardType: CardType;
        let effectiveCommand: string;

        if (parsedCmd) {
          cardType = parsedCmd.skill as CardType;
          effectiveCommand = `${parsedCmd.skill} ${parsedCmd.args}`;
        } else if (freeChatCmd) {
          cardType = 'free_chat';
          effectiveCommand = freeChatCmd.prompt;
        } else {
          throw new Error('无效的助手指令');
        }

        // 3. Create execution session
        const session = await startExecutionSession({
          projectId, draftId,
          terminalSessionId: currentSessionId,
          userId, userName, cardType,
          command: effectiveCommand,
          parentCardId: contextCardId,
        });

        // Notify client execution started
        socket.emit('aiExecutionStarted', {
          sessionId: currentSessionId,
          projectId, draftId,
          cardId: session.cardId,
        });

        // Update status to running
        await updateExecutionStatus(currentSessionId, 'running');

        // Build context
        const context = await buildAIExecutionContext({
          projectId, draftId, command, args, contextCardId,
        });

        // Generate full prompt
        let fullPrompt: string;
        if (cardType === 'free_chat') {
          const containerDiscussionPath = `/workspace/transcripts/${projectId}/${draftId}/discussion.json`;
          const parts = [`@${containerDiscussionPath}`];
          if (contextCardId && context.transcriptPath) {
            const filename = path.basename(context.transcriptPath);
            const containerTranscriptPath = `/workspace/transcripts/${projectId}/${draftId}/${filename}`;
            parts.push(`@${containerTranscriptPath}`);
          }
          parts.push(effectiveCommand);
          fullPrompt = parts.join(' ');
        } else {
          fullPrompt = generateClaudeCodePrompt(context);
        }

        // Send to Terminal
        terminalManager.sendToTerminal(
          currentSessionId,
          Buffer.from(fullPrompt + '\n').toString('base64')
        );

      } catch (error) {
        const message = error instanceof Error ? error.message : '执行失败';
        socket.emit('aiExecutionError', {
          sessionId: currentSessionId,
          message,
        });
      }
    });

    // 暂停 AI 执行
    socket.on('pauseAIExecution', async () => {
      if (!currentSessionId) return;
      await pauseExecution(currentSessionId);
      const session = getExecutionByTerminal(currentSessionId);
      socket.emit('aiExecutionPaused', {
        sessionId: currentSessionId,
        cardId: session?.cardId,
      });
    });

    // 恢复 AI 执行
    socket.on('resumeAIExecution', async (data: unknown) => {
      const parsed = TerminalEvents.resumeAIExecution.safeParse(data);
      if (!parsed.success || !currentSessionId) return;

      await resumeExecution(currentSessionId, parsed.data.newCommand);
      const session = getExecutionByTerminal(currentSessionId);
      socket.emit('aiExecutionResumed', {
        sessionId: currentSessionId,
        cardId: session?.cardId,
      });

      terminalManager.sendToTerminal(
        currentSessionId,
        Buffer.from(parsed.data.newCommand + '\n').toString('base64')
      );
    });

    // 断开连接
    socket.on('disconnect', async () => {
      logger.info(`Terminal socket disconnected: userId=${userId}`);

      if (currentSessionId) {
        // 如果有活跃的 AI 执行，先完成它（标记为失败，因为连接断开）
        const execution = getExecutionByTerminal(currentSessionId);
        if (execution && (execution.status === 'running' || execution.status === 'pending' || execution.status === 'paused')) {
          const card = await completeExecution(currentSessionId, false, '连接断开');
          if (card) {
            socket.emit('aiExecutionComplete', {
              sessionId: currentSessionId,
              projectId: execution.projectId,
              draftId: execution.draftId,
              cardId: card.id,
              success: false,
              summary: '连接断开',
            });
            // 释放驾驶权
            try {
              await releaseCodingLock({
                projectId: execution.projectId,
                draftId: execution.draftId,
                userId,
              });
              namespace.emit('codingLockReleased', {
                projectId: execution.projectId,
                draftId: execution.draftId,
              });
            } catch {
              // Lock may have already been released by exit handler
            }
          }
        }

        terminalManager.closeSession(currentSessionId);
        currentSessionId = null;
      }
    });
  });
}

// 创建 Socket.IO 写入器适配器
// 使用闭包引用 currentSessionId，因为 sessionId 在创建后才可用
function createSocketIOWriter(socket: Socket, getCurrentSessionId: () => string | null): { readyState: number; send: (data: string) => void; on: (event: string, handler: () => void) => void; OPEN: number } {
  return {
    readyState: 1, // OPEN
    OPEN: 1,
    send: (data: string) => {
      const msg = JSON.parse(data);
      socket.emit(msg.type, msg);

      // AI 执行期间拦截输出，记录到卡片
      const sessionId = getCurrentSessionId();
      if (sessionId && msg.type === 'output') {
        const execution = getExecutionByTerminal(sessionId);
        if (execution && execution.status === 'running') {
          appendExecutionOutput(sessionId, msg.data || '');
          socket.emit('aiExecutionOutput', {
            sessionId,
            chunk: msg.data || '',
          });
        }
      }
    },
    on: (event: string, handler: () => void) => {
      socket.on(event, handler);
    },
  };
}

/**
 * 从输出中提取摘要
 */
function extractSummary(output: string): string {
  const lines = output.trim().split('\n');
  // 取最后几行非空内容作为摘要
  const meaningfulLines = lines.filter(l => l.trim().length > 0).slice(-3);
  return meaningfulLines.join('\n').slice(0, 200);
}

/**
 * 判断输出是否表示成功执行
 * 匹配常见的错误行首标记，避免误判包含 "error" 单词的正常输出
 */
function isSuccessfulOutput(output: string): boolean {
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^error:/i.test(trimmed) || /^failed\b/i.test(trimmed) || /^\[error\]/i.test(trimmed)) {
      return false;
    }
  }
  return true;
}