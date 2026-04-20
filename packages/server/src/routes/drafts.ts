import "reflect-metadata";
import { container } from "tsyringe";
import { Router } from 'express';
import { DraftService } from '../services/draft.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSocketServer, broadcastDraftMessage, getDraftOnlineUsers } from '../socket/index.js';
import { createLogger } from '../logger/index.js';
import { success, Errors, handleRouteError } from '../utils/response.js';

const logger = createLogger('drafts');

export function createDraftsRouter(): Router {
  const router = Router();
  const draftService = container.resolve(DraftService);

  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const draft = await draftService.create(userId, req.body);
      res.status(201).json(success({ draft }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '创建 Draft 失败');
    }
  });

  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const drafts = await draftService.findByUserId(userId);
      res.json(success(drafts));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取 Draft 列表失败');
    }
  });

  router.get('/:draftId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);

    if (isNaN(draftId)) {
      res.status(400).json(Errors.paramInvalid('draftId', '无效的 Draft ID'));
      return;
    }

    try {
      const result = await draftService.findById(draftId, userId);
      res.json(success(result));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取 Draft 详情失败');
    }
  });

  router.post('/:draftId/messages', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const userName = (req as any).userName || 'Unknown';
    const draftId = parseInt(req.params.draftId as string, 10);
    const { content, messageType, parentId, metadata } = req.body;

    if (isNaN(draftId) || !content) {
      res.status(400).json(Errors.paramInvalid('draftId 或 content'));
      return;
    }

    try {
      const isAI = draftService.checkIsAICommand(content);
      const actualMessageType = isAI ? 'ai_command' : (messageType || 'text');

      const message = await draftService.createMessage(draftId, userId, {
        content,
        messageType: actualMessageType,
        parentId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      });

      const ioServer = getSocketServer();
      if (ioServer) {
        const draftNamespace = ioServer.of('/draft');
        broadcastDraftMessage(draftNamespace, draftId, {
          id: message.id,
          draft_id: message.draftId,
          parent_id: message.parentId,
          user_id: message.userId,
          user_name: message.userName || 'Unknown',
          content: message.content || '',
          message_type: message.messageType,
          created_at: message.createdAt,
        }, userId);
      }

      if (isAI) {
        draftService.handleAICommand(draftId, userId, content, message.id)
          .then((result) => {
            if (result.message && ioServer) {
              const draftNamespace = ioServer.of('/draft');
              broadcastDraftMessage(draftNamespace, draftId, {
                id: result.message.id,
                draft_id: result.message.draftId,
                parent_id: result.message.parentId,
                user_id: result.message.userId,
                user_name: 'AI Assistant',
                content: result.message.content || '',
                message_type: result.message.messageType,
                created_at: result.message.createdAt,
              });
            }
          })
          .catch((error) => {
            logger.error('Failed to execute AI command', { draftId, error });
          });
      }

      res.status(201).json(success({ message }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '发送消息失败');
    }
  });

  router.get('/:draftId/messages', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    if (isNaN(draftId)) {
      res.status(400).json(Errors.paramInvalid('draftId', '无效的 Draft ID'));
      return;
    }

    try {
      const messages = await draftService.findMessages(draftId, userId, { limit });
      res.json(success(messages));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取消息列表失败');
    }
  });

  router.put('/:draftId/status', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const { status } = req.body;

    if (isNaN(draftId) || !status) {
      res.status(400).json(Errors.paramInvalid('draftId 或 status'));
      return;
    }

    try {
      const draft = await draftService.updateStatus(draftId, userId, status);

      const ioServer = getSocketServer();
      if (ioServer) {
        const draftNamespace = ioServer.of('/draft');
        draftNamespace.to(`draft:${draftId}`).emit('draftStatusChanged', {
          draftId,
          status,
          timestamp: new Date().toISOString(),
        });
      }

      res.json(success({ draft }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '更新 Draft 状态失败');
    }
  });

  router.post('/:draftId/messages/:messageId/confirm', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const userName = (req as any).userName || 'Unknown';
    const draftId = parseInt(req.params.draftId as string, 10);
    const messageId = parseInt(req.params.messageId as string, 10);
    const { type, comment } = req.body;

    if (isNaN(draftId) || isNaN(messageId) || !type) {
      res.status(400).json(Errors.paramInvalid('draftId、messageId 或 type'));
      return;
    }

    try {
      const result = await draftService.confirmMessage(draftId, messageId, userId, {
        type,
        comment,
      });

      const ioServer = getSocketServer();
      if (ioServer) {
        const draftNamespace = ioServer.of('/draft');
        draftNamespace.to(`draft:${draftId}`).emit('draftMessageConfirmed', {
          draftId,
          messageId,
          userId: result.userId,
          userName: result.userName,
          confirmationType: result.type,
          timestamp: new Date().toISOString(),
        });
      }

      res.json(success({ success: true }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '确认消息失败');
    }
  });

  router.get('/:draftId/messages/:messageId/confirmations', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const messageId = parseInt(req.params.messageId as string, 10);

    if (isNaN(draftId) || isNaN(messageId)) {
      res.status(400).json(Errors.paramInvalid('draftId 或 messageId'));
      return;
    }

    try {
      const confirmations = await draftService.findConfirmations(draftId, messageId, userId);
      res.json(success(confirmations));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取确认列表失败');
    }
  });

  router.post('/:draftId/members', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const { newUserId } = req.body;

    if (isNaN(draftId) || !newUserId) {
      res.status(400).json(Errors.paramInvalid('draftId 或 newUserId'));
      return;
    }

    try {
      await draftService.addMember(draftId, userId, newUserId);
      res.json(success({ success: true }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '添加成员失败');
    }
  });

  router.delete('/:draftId/members/:memberId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const memberId = parseInt(req.params.memberId as string, 10);

    if (isNaN(draftId) || isNaN(memberId)) {
      res.status(400).json(Errors.paramInvalid('draftId 或 memberId'));
      return;
    }

    try {
      await draftService.removeMember(draftId, userId, memberId);
      res.json(success({ success: true }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '移除成员失败');
    }
  });

  router.delete('/:draftId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);

    if (isNaN(draftId)) {
      res.status(400).json(Errors.paramInvalid('draftId', '无效的 Draft ID'));
      return;
    }

    try {
      await draftService.delete(draftId, userId);
      res.status(204).send();
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '删除 Draft 失败');
    }
  });

  return router;
}