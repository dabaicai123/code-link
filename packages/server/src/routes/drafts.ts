// packages/server/src/routes/drafts.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { getWebSocketServer } from '../websocket/server.js';
import {
  createDraftMessageEvent,
  createDraftStatusChangedEvent,
  createDraftMessageConfirmedEvent,
  createDraftAIResponseEvent,
} from '../websocket/types.js';
import { createLogger } from '../logger/index.js';
import type {
  Draft,
  DraftMember,
  DraftStatus,
  ConfirmationType,
  CreateDraftInput,
} from '../types/draft.js';
import {
  isAICommand,
  parseAICommand,
  executeAICommand,
} from '../ai/commands.js';
import { isAIEnabled } from '../ai/client.js';

const logger = createLogger('drafts');

const VALID_CONFIRMATION_TYPES: ConfirmationType[] = ['agree', 'disagree', 'suggest'];

const VALID_DRAFT_STATUSES: DraftStatus[] = ['discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived'];

function isValidDraftStatus(status: string): status is DraftStatus {
  return VALID_DRAFT_STATUSES.includes(status as DraftStatus);
}

function isValidConfirmationType(type: string): type is ConfirmationType {
  return VALID_CONFIRMATION_TYPES.includes(type as ConfirmationType);
}

export function createDraftsRouter(db: Database.Database): Router {
  const router = Router();

  // POST /api/drafts - 创建 Draft
  router.post('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const { projectId, title, memberIds } = req.body as CreateDraftInput;

    if (!projectId || !title) {
      res.status(400).json({ error: '缺少必填字段：projectId, title' });
      return;
    }

    if (typeof title !== 'string' || title.length > 200) {
      res.status(400).json({ error: 'Draft 标题必须是 1-200 字符的字符串' });
      return;
    }

    try {
      // 检查用户是否是项目成员
      const projectMembership = db
        .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(projectId, userId);

      if (!projectMembership) {
        res.status(403).json({ error: '您不是该项目的成员' });
        return;
      }

      const createDraftTx = db.transaction(() => {
        const result = db
          .prepare('INSERT INTO drafts (project_id, title, created_by) VALUES (?, ?, ?)')
          .run(projectId, title, userId);

        const draftId = result.lastInsertRowid as number;

        // 创建者是 owner
        db.prepare('INSERT INTO draft_members (draft_id, user_id, role) VALUES (?, ?, ?)').run(
          draftId,
          userId,
          'owner'
        );

        // 添加其他成员
        if (memberIds && memberIds.length > 0) {
          for (const memberId of memberIds) {
            if (memberId !== userId) {
              // 验证成员是否为项目成员
              const isProjectMember = db
                .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
                .get(projectId, memberId);
              if (isProjectMember) {
                db.prepare('INSERT INTO draft_members (draft_id, user_id, role) VALUES (?, ?, ?)').run(
                  draftId,
                  memberId,
                  'participant'
                );
              }
            }
          }
        }

        return draftId;
      });

      const draftId = createDraftTx();

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft;

      res.status(201).json({ draft });
    } catch (error) {
      logger.error('创建 Draft 失败', error);
      res.status(500).json({ error: '创建 Draft 失败' });
    }
  });

  // GET /api/drafts - 获取用户参与的所有 Draft
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    const drafts = db
      .prepare(
        `SELECT d.* FROM drafts d
         JOIN draft_members dm ON d.id = dm.draft_id
         WHERE dm.user_id = ?
         ORDER BY d.updated_at DESC`
      )
      .all(userId) as Draft[];

    res.json(drafts);
  });

  // GET /api/drafts/:draftId - 获取 Draft 详情
  router.get('/:draftId', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    const membership = db
      .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
      .get(draftId, userId) as DraftMember | undefined;

    if (!membership) {
      res.status(403).json({ error: '您不是该 Draft 的成员' });
      return;
    }

    const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft;
    const members = db
      .prepare(
        `SELECT dm.*, u.name as user_name FROM draft_members dm
         JOIN users u ON dm.user_id = u.id
         WHERE dm.draft_id = ?`
      )
      .all(draftId) as Array<DraftMember & { user_name: string }>;

    res.json({ draft, members });
  });

  // POST /api/drafts/:draftId/messages - 发送消息
  router.post('/:draftId/messages', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { content, messageType, parentId, metadata } = req.body;

    if (isNaN(draftId) || !content) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      // Check if content is an AI command
      const isAI = isAICommand(content);
      const actualMessageType = isAI ? 'ai_command' : (messageType || 'text');

      const result = db
        .prepare(
          'INSERT INTO draft_messages (draft_id, parent_id, user_id, content, message_type, metadata) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(draftId, parentId || null, userId, content, actualMessageType, metadata ? JSON.stringify(metadata) : null);

      const messageId = result.lastInsertRowid as number;

      db.prepare('UPDATE drafts SET updated_at = datetime(\'now\') WHERE id = ?').run(draftId);

      const message = db
        .prepare(
          `SELECT m.*, u.name as user_name FROM draft_messages m
           JOIN users u ON m.user_id = u.id
           WHERE m.id = ?`
        )
        .get(messageId) as {
        id: number;
        draft_id: number;
        parent_id: number | null;
        user_id: number;
        user_name: string;
        content: string;
        message_type: string;
        created_at: string;
      };

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageEvent(draftId, message);
        wsServer.broadcastDraftMessage(draftId, wsMessage, userId);
      }

      // If it's an AI command, execute it and save the response
      if (isAI && isAIEnabled()) {
        const command = parseAICommand(content);
        if (command) {
          // Execute AI command asynchronously
          executeAICommand(db, draftId, command, userId)
            .then((aiResult) => {
              // Save AI response as a system message
              const aiResponseContent = aiResult.success
                ? aiResult.response
                : `AI 命令执行失败: ${aiResult.error}`;

              const aiMessageResult = db
                .prepare(
                  'INSERT INTO draft_messages (draft_id, parent_id, user_id, content, message_type, metadata) VALUES (?, ?, ?, ?, ?, ?)'
                )
                .run(
                  draftId,
                  messageId, // parent_id is the user's message
                  0, // system user ID (0 for AI)
                  aiResponseContent || '',
                  aiResult.success ? 'ai_response' : 'ai_error',
                  JSON.stringify({ commandType: command.type })
                );

              const aiMessageId = aiMessageResult.lastInsertRowid as number;

              // Update draft's updated_at
              db.prepare('UPDATE drafts SET updated_at = datetime(\'now\') WHERE id = ?').run(draftId);

              // Get the AI message with user info
              const aiMessage = db
                .prepare(
                  `SELECT m.*, u.name as user_name FROM draft_messages m
                   LEFT JOIN users u ON m.user_id = u.id
                   WHERE m.id = ?`
                )
                .get(aiMessageId) as {
                id: number;
                draft_id: number;
                parent_id: number | null;
                user_id: number;
                user_name: string | null;
                content: string;
                message_type: string;
                created_at: string;
              };

              // Broadcast AI response
              if (wsServer) {
                const aiWsMessage = createDraftAIResponseEvent(draftId, {
                  id: aiMessage.id,
                  draft_id: aiMessage.draft_id,
                  parent_id: aiMessage.parent_id,
                  user_id: aiMessage.user_id,
                  user_name: aiMessage.user_name || 'AI Assistant',
                  content: aiMessage.content,
                  message_type: aiMessage.message_type,
                  metadata: null,
                  created_at: aiMessage.created_at,
                }, command.type);
                wsServer.broadcastDraftMessage(draftId, aiWsMessage);
              }

              logger.info('AI command executed', {
                draftId,
                messageId,
                aiMessageId,
                success: aiResult.success,
                commandType: command.type,
              });
            })
            .catch((error) => {
              logger.error('Failed to execute AI command', { draftId, messageId, error });
            });
        }
      }

      res.status(201).json({ message });
    } catch (error) {
      logger.error('发送消息失败', error);
      res.status(500).json({ error: '发送消息失败' });
    }
  });

  // GET /api/drafts/:draftId/messages - 获取消息列表
  router.get('/:draftId/messages', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const before = req.query.before as string | undefined;

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      let query = `
        SELECT m.*, u.name as user_name FROM draft_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.draft_id = ?
      `;
      const params: (number | string | null)[] = [draftId];

      if (parentId !== undefined) {
        if (parentId === null || parentId === 0 || req.query.parentId === 'null') {
          query += ' AND m.parent_id IS NULL';
        } else {
          query += ' AND m.parent_id = ?';
          params.push(parentId);
        }
      }

      if (before) {
        query += ' AND m.created_at < ?';
        params.push(before);
      }

      query += ' ORDER BY m.created_at ASC LIMIT ?';
      params.push(limit);

      const messages = db.prepare(query).all(...params);

      res.json(messages);
    } catch (error) {
      logger.error('获取消息列表失败', error);
      res.status(500).json({ error: '获取消息列表失败' });
    }
  });

  // PUT /api/drafts/:draftId/status - 更新 Draft 状态
  router.put('/:draftId/status', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { status } = req.body as { status: DraftStatus };

    if (isNaN(draftId) || !status) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    if (!isValidDraftStatus(status)) {
      res.status(400).json({ error: '无效的状态值' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as DraftMember | undefined;

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      db.prepare('UPDATE drafts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, draftId);

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft;

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftStatusChangedEvent(draftId, status);
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ draft });
    } catch (error) {
      logger.error('更新 Draft 状态失败', error);
      res.status(500).json({ error: '更新 Draft 状态失败' });
    }
  });

  // POST /api/drafts/:draftId/messages/:messageId/confirm - 确认消息
  router.post('/:draftId/messages/:messageId/confirm', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const { type, comment } = req.body;

    if (isNaN(draftId) || isNaN(messageId) || !type) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    if (!isValidConfirmationType(type)) {
      res.status(400).json({ error: 'type 必须是 agree, disagree 或 suggest' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      const message = db.prepare('SELECT * FROM draft_messages WHERE id = ? AND draft_id = ?').get(messageId, draftId);

      if (!message) {
        res.status(404).json({ error: '消息不存在' });
        return;
      }

      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string };

      db.prepare(
        `INSERT INTO message_confirmations (message_id, user_id, type, comment)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(message_id, user_id) DO UPDATE SET
           type = excluded.type,
           comment = excluded.comment,
           created_at = datetime('now')`
      ).run(messageId, userId, type, comment || null);

      const wsServer = getWebSocketServer();
      if (wsServer) {
        const wsMessage = createDraftMessageConfirmedEvent(draftId, messageId, userId, user.name, type);
        wsServer.broadcastDraftMessage(draftId, wsMessage);
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('确认消息失败', error);
      res.status(500).json({ error: '确认消息失败' });
    }
  });

  // GET /api/drafts/:draftId/messages/:messageId/confirmations - 获取消息确认列表
  router.get('/:draftId/messages/:messageId/confirmations', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(draftId) || isNaN(messageId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: '您不是该 Draft 的成员' });
        return;
      }

      const confirmations = db
        .prepare(
          `SELECT mc.*, u.name as user_name FROM message_confirmations mc
           JOIN users u ON mc.user_id = u.id
           WHERE mc.message_id = ?
           ORDER BY mc.created_at ASC`
        )
        .all(messageId);

      res.json({ confirmations });
    } catch (error) {
      logger.error('获取确认列表失败', error);
      res.status(500).json({ error: '获取确认列表失败' });
    }
  });

  // POST /api/drafts/:draftId/members - 添加成员
  router.post('/:draftId/members', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { newUserId } = req.body;

    if (isNaN(draftId) || !newUserId) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT role FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as { role: string } | undefined;

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有 Draft owner 可以添加成员' });
        return;
      }

      // 验证新成员是否为项目成员
      const draft = db.prepare('SELECT project_id FROM drafts WHERE id = ?').get(draftId) as { project_id: number } | undefined;
      if (!draft) {
        res.status(404).json({ error: 'Draft 不存在' });
        return;
      }

      const isProjectMember = db
        .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(draft.project_id, newUserId);
      if (!isProjectMember) {
        res.status(400).json({ error: '用户不是项目成员' });
        return;
      }

      db.prepare('INSERT INTO draft_members (draft_id, user_id, role) VALUES (?, ?, ?)').run(draftId, newUserId, 'participant');

      res.json({ success: true });
    } catch (error) {
      logger.error('添加成员失败', error);
      res.status(500).json({ error: '添加成员失败' });
    }
  });

  // DELETE /api/drafts/:draftId/members/:memberId - 移除成员
  router.delete('/:draftId/members/:memberId', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const memberId = parseInt(req.params.memberId, 10);

    if (isNaN(draftId) || isNaN(memberId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT role FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as { role: string } | undefined;

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有 Draft owner 可以移除成员' });
        return;
      }

      // 检查被移除的成员是否为 owner
      const targetMembership = db
        .prepare('SELECT role FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, memberId) as { role: string } | undefined;

      if (!targetMembership) {
        res.status(404).json({ error: '成员不存在' });
        return;
      }

      if (targetMembership.role === 'owner') {
        res.status(400).json({ error: '无法移除 Draft owner' });
        return;
      }

      db.prepare('DELETE FROM draft_members WHERE draft_id = ? AND user_id = ?').run(draftId, memberId);

      res.json({ success: true });
    } catch (error) {
      logger.error('移除成员失败', error);
      res.status(500).json({ error: '移除成员失败' });
    }
  });

  // DELETE /api/drafts/:draftId - 删除 Draft
  router.delete('/:draftId', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的 Draft ID' });
      return;
    }

    try {
      const membership = db
        .prepare('SELECT role FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as { role: string } | undefined;

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有 Draft owner 可以删除 Draft' });
        return;
      }

      db.prepare('DELETE FROM drafts WHERE id = ?').run(draftId);

      res.status(204).send();
    } catch (error) {
      logger.error('删除 Draft 失败', error);
      res.status(500).json({ error: '删除 Draft 失败' });
    }
  });

  return router;
}