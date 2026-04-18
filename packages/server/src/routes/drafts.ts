import { Router } from 'express';
import { DraftService } from '../services/draft.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { getWebSocketServer } from '../websocket/server.js';
import {
  createDraftMessageEvent,
  createDraftStatusChangedEvent,
  createDraftMessageConfirmedEvent,
  createDraftAIResponseEvent,
} from '../websocket/types.js';
import { createLogger } from '../logger/index.js';
import {
  isAICommand,
  parseAICommand,
  executeAICommand,
} from '../ai/commands.js';
import { isAIEnabled } from '../ai/client.js';
import { getSqliteDb } from '../db/index.js';
import type Database from 'better-sqlite3';

const logger = createLogger('drafts');

export function createDraftsRouter(): Router {
  const router = Router();
  const draftService = new DraftService();

  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const draft = await draftService.create(userId, req.body);
      res.status(201).json({ draft });
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('缺少') || error.message.includes('标题')) {
        res.status(400).json({ error: error.message });
      } else {
        logger.error('创建 Draft 失败', error);
        res.status(500).json({ error: '创建 Draft 失败' });
      }
    }
  });

  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const drafts = await draftService.findByUserId(userId);
      res.json(drafts);
    } catch (error: any) {
      logger.error('获取 Draft 列表失败', error);
      res.status(500).json({ error: '获取 Draft 列表失败' });
    }
  });

  router.get('/:draftId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      const result = await draftService.findById(draftId, userId);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('获取 Draft 详情失败', error);
        res.status(500).json({ error: '获取 Draft 详情失败' });
      }
    }
  });

  router.post('/:draftId/messages', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const { content, messageType, parentId, metadata } = req.body;

    if (isNaN(draftId) || !content) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const isAI = isAICommand(content);
      const actualMessageType = isAI ? 'ai_command' : (messageType || 'text');

      const message = await draftService.createMessage(draftId, userId, {
        content,
        messageType: actualMessageType,
        parentId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      });

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageEvent(draftId, {
          id: message.id,
          draft_id: message.draftId,
          parent_id: message.parentId,
          user_id: message.userId,
          user_name: message.userName || 'Unknown',
          content: message.content || '',
          message_type: message.messageType,
          created_at: message.createdAt,
        });
        wsServer.broadcastDraftMessage(draftId, wsMessage, userId);
      }

      if (isAI && isAIEnabled()) {
        const command = parseAICommand(content);
        if (command) {
          const db = getSqliteDb();
          executeAICommand(db, draftId, command, userId)
            .then(async (aiResult) => {
              const aiResponseContent = aiResult.success
                ? aiResult.response
                : `AI 命令执行失败: ${aiResult.error}`;

              const aiMessage = await draftService.createMessage(draftId, 0, {
                content: aiResponseContent || '',
                messageType: aiResult.success ? 'ai_response' : 'ai_error',
                parentId: message.id,
                metadata: JSON.stringify({ commandType: command.type }),
              });

              if (wsServer) {
                const aiWsMessage = createDraftAIResponseEvent(draftId, {
                  id: aiMessage.id,
                  draft_id: aiMessage.draftId,
                  parent_id: aiMessage.parentId,
                  user_id: aiMessage.userId,
                  user_name: 'AI Assistant',
                  content: aiMessage.content || '',
                  message_type: aiMessage.messageType,
                  metadata: aiMessage.metadata || null,
                  created_at: aiMessage.createdAt,
                }, command.type);
                wsServer.broadcastDraftMessage(draftId, aiWsMessage);
              }
            })
            .catch((error) => {
              logger.error('Failed to execute AI command', { draftId, error });
            });
        }
      }

      res.status(201).json({ message });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('发送消息失败', error);
        res.status(500).json({ error: '发送消息失败' });
      }
    }
  });

  router.get('/:draftId/messages', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      const messages = await draftService.findMessages(draftId, userId, { limit });
      res.json(messages);
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('获取消息列表失败', error);
        res.status(500).json({ error: '获取消息列表失败' });
      }
    }
  });

  router.put('/:draftId/status', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const { status } = req.body;

    if (isNaN(draftId) || !status) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const draft = await draftService.updateStatus(draftId, userId, status);

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftStatusChangedEvent(draftId, status);
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ draft });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('更新 Draft 状态失败', error);
        res.status(500).json({ error: '更新 Draft 状态失败' });
      }
    }
  });

  router.post('/:draftId/messages/:messageId/confirm', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const messageId = parseInt(req.params.messageId as string, 10);
    const { type, comment } = req.body;

    if (isNaN(draftId) || isNaN(messageId) || !type) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const result = await draftService.confirmMessage(draftId, messageId, userId, {
        type,
        comment,
      });

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageConfirmedEvent(
          draftId,
          messageId,
          result.userId,
          result.userName,
          result.type
        );
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('确认消息失败', error);
        res.status(500).json({ error: '确认消息失败' });
      }
    }
  });

  router.get('/:draftId/messages/:messageId/confirmations', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const messageId = parseInt(req.params.messageId as string, 10);

    if (isNaN(draftId) || isNaN(messageId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const confirmations = await draftService.findConfirmations(draftId, messageId, userId);
      res.json({ confirmations });
    } catch (error: any) {
      if (error.message.includes('不是')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('获取确认列表失败', error);
        res.status(500).json({ error: '获取确认列表失败' });
      }
    }
  });

  router.post('/:draftId/members', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const { newUserId } = req.body;

    if (isNaN(draftId) || !newUserId) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      await draftService.addMember(draftId, userId, newUserId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('添加成员失败', error);
        res.status(500).json({ error: '添加成员失败' });
      }
    }
  });

  router.delete('/:draftId/members/:memberId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const memberId = parseInt(req.params.memberId as string, 10);

    if (isNaN(draftId) || isNaN(memberId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      await draftService.removeMember(draftId, userId, memberId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('移除成员失败', error);
        res.status(500).json({ error: '移除成员失败' });
      }
    }
  });

  router.delete('/:draftId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      await draftService.delete(draftId, userId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('owner')) {
        res.status(403).json({ error: error.message });
      } else {
        logger.error('删除 Draft 失败', error);
        res.status(500).json({ error: '删除 Draft 失败' });
      }
    }
  });

  return router;
}