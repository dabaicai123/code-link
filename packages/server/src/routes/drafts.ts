// packages/server/src/routes/drafts.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import type {
  Draft,
  DraftMember,
  DraftStatus,
  CreateDraftInput
} from '../types/draft.js';

export function createDraftsRouter(db: Database.Database): Router {
  const router = Router();
  router.use(authMiddleware);

  // Create Draft
  router.post('/', (req, res) => {
    const userId = (req as any).userId;
    const { projectId, title, memberIds } = req.body as CreateDraftInput;

    if (!projectId || !title) {
      res.status(400).json({ error: 'projectId and title are required' });
      return;
    }

    // Check if user is project member
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this project' });
      return;
    }

    try {
      // Create Draft
      const result = db.prepare(`
        INSERT INTO drafts (project_id, title, created_by)
        VALUES (?, ?, ?)
      `).run(projectId, title, userId);

      const draftId = result.lastInsertRowid as number;

      // Add creator as owner
      db.prepare(`
        INSERT INTO draft_members (draft_id, user_id, role)
        VALUES (?, ?, 'owner')
      `).run(draftId, userId);

      // Add other members
      if (memberIds && memberIds.length > 0) {
        const addMember = db.prepare(`
          INSERT OR IGNORE INTO draft_members (draft_id, user_id, role)
          VALUES (?, ?, 'participant')
        `);

        for (const memberId of memberIds) {
          // Check if is project member
          const isProjectMember = db
            .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
            .get(projectId, memberId);

          if (isProjectMember) {
            addMember.run(draftId, memberId);
          }
        }
      }

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft;
      res.status(201).json({ draft });
    } catch (error) {
      console.error('Failed to create draft:', error);
      res.status(500).json({ error: 'Failed to create draft' });
    }
  });

  // Get all drafts for user
  router.get('/', (req, res) => {
    const userId = (req as any).userId;
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

    try {
      let query = `
        SELECT d.* FROM drafts d
        JOIN draft_members dm ON d.id = dm.draft_id
        WHERE dm.user_id = ?
      `;
      const params: (number | string)[] = [userId];

      if (projectId) {
        query += ' AND d.project_id = ?';
        params.push(projectId);
      }

      query += ' ORDER BY d.updated_at DESC';

      const drafts = db.prepare(query).all(...params) as Draft[];
      res.json({ drafts });
    } catch (error) {
      console.error('Failed to get drafts:', error);
      res.status(500).json({ error: 'Failed to get drafts' });
    }
  });

  // Get Draft details
  router.get('/:draftId', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: 'Invalid draftId' });
      return;
    }

    try {
      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft | undefined;

      if (!draft) {
        res.status(404).json({ error: 'Draft not found' });
        return;
      }

      // Check if user is draft member
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this draft' });
        return;
      }

      // Get members list
      const members = db.prepare(`
        SELECT dm.*, u.name as user_name, u.email as user_email
        FROM draft_members dm
        JOIN users u ON dm.user_id = u.id
        WHERE dm.draft_id = ?
      `).all(draftId);

      res.json({ draft, members });
    } catch (error) {
      console.error('Failed to get draft:', error);
      res.status(500).json({ error: 'Failed to get draft' });
    }
  });

  // Update Draft status
  router.put('/:draftId/status', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { status } = req.body as { status: DraftStatus };

    if (isNaN(draftId) || !status) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    try {
      // Check if user is draft member
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as DraftMember | undefined;

      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this draft' });
        return;
      }

      db.prepare(`
        UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ?
      `).run(status, draftId);

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft;
      res.json({ draft });
    } catch (error) {
      console.error('Failed to update draft status:', error);
      res.status(500).json({ error: 'Failed to update draft status' });
    }
  });

  // Add member
  router.post('/:draftId/members', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const { userId: newMemberId } = req.body;

    if (isNaN(draftId) || !newMemberId) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    try {
      // Check if current user is draft member
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId);

      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this draft' });
        return;
      }

      // Get draft's project ID
      const draft = db.prepare('SELECT project_id FROM drafts WHERE id = ?').get(draftId) as { project_id: number } | undefined;

      if (!draft) {
        res.status(404).json({ error: 'Draft not found' });
        return;
      }

      // Check if new member is project member
      const isProjectMember = db
        .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(draft.project_id, newMemberId);

      if (!isProjectMember) {
        res.status(400).json({ error: 'User is not a project member' });
        return;
      }

      // Add member
      db.prepare(`
        INSERT OR IGNORE INTO draft_members (draft_id, user_id, role)
        VALUES (?, ?, 'participant')
      `).run(draftId, newMemberId);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to add member:', error);
      res.status(500).json({ error: 'Failed to add member' });
    }
  });

  // Remove member
  router.delete('/:draftId/members/:userId', (req, res) => {
    const currentUserId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(draftId) || isNaN(targetUserId)) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    try {
      // Check if current user is draft owner
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, currentUserId) as DraftMember | undefined;

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: 'Only owner can remove members' });
        return;
      }

      // Cannot remove owner
      const targetMembership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, targetUserId) as DraftMember | undefined;

      if (targetMembership?.role === 'owner') {
        res.status(400).json({ error: 'Cannot remove owner' });
        return;
      }

      db.prepare('DELETE FROM draft_members WHERE draft_id = ? AND user_id = ?').run(draftId, targetUserId);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to remove member:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  });

  // Delete Draft
  router.delete('/:draftId', (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: 'Invalid draftId' });
      return;
    }

    try {
      // Check if user is draft owner
      const membership = db
        .prepare('SELECT * FROM draft_members WHERE draft_id = ? AND user_id = ?')
        .get(draftId, userId) as DraftMember | undefined;

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: 'Only owner can delete draft' });
        return;
      }

      db.prepare('DELETE FROM drafts WHERE id = ?').run(draftId);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete draft:', error);
      res.status(500).json({ error: 'Failed to delete draft' });
    }
  });

  return router;
}
