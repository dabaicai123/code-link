// packages/server/tests/drafts.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../src/db/connection.js';
import { initSchema } from '../src/db/schema.js';
import { createDraftsRouter } from '../src/routes/drafts.js';
import { createAuthRouter } from '../src/routes/auth.js';

describe('Drafts API', () => {
  let db: Database.Database;
  let app: express.Express;
  let authToken: string;
  let userId: number;
  let projectId: number;

  beforeEach(async () => {
    db = getDb(':memory:');
    initSchema(db);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(db));
    app.use('/api/drafts', createDraftsRouter(db));

    // Create test user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // Create test project (directly insert into database)
    const projectResult = db.prepare(
      'INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)'
    ).run('Test Project', 'node', userId);
    projectId = projectResult.lastInsertRowid as number;

    // Add user as project member
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(projectId, userId, 'owner');
  });

  afterEach(() => {
    closeDb(db);
  });

  describe('POST /api/drafts', () => {
    it('should create a draft with owner as member', async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });

      expect(res.status).toBe(201);
      expect(res.body.draft).toMatchObject({
        project_id: projectId,
        title: 'Test Draft',
        status: 'discussing',
        created_by: userId,
      });
      expect(res.body.draft.id).toBeDefined();

      // Verify creator is owner
      const members = db.prepare('SELECT * FROM draft_members WHERE draft_id = ?').all(res.body.draft.id);
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        user_id: userId,
        role: 'owner',
      });
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/drafts')
        .send({ projectId, title: 'Test Draft' });

      expect(res.status).toBe(401);
    });

    it('should return 400 without required fields', async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/drafts/:draftId', () => {
    let draftId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;
    });

    it('should return draft with members', async () => {
      const res = await request(app)
        .get(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.draft.id).toBe(draftId);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].user_id).toBe(userId);
    });

    it('should return 404 for non-existent draft', async () => {
      const res = await request(app)
        .get('/api/drafts/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/drafts', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Draft 1' });
      await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Draft 2' });
    });

    it('should return all drafts for user', async () => {
      const res = await request(app)
        .get('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drafts).toHaveLength(2);
    });
  });

  describe('POST /api/drafts/:draftId/members', () => {
    let draftId: number;
    let anotherUserId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;

      // Create another user
      const anotherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Another User', email: 'another@test.com', password: 'password123' });
      anotherUserId = anotherRes.body.user.id;

      // Add as project member
      db.prepare(
        'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
      ).run(projectId, anotherUserId, 'developer');
    });

    it('should add member to draft', async () => {
      const res = await request(app)
        .post(`/api/drafts/${draftId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: anotherUserId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const members = db.prepare('SELECT * FROM draft_members WHERE draft_id = ?').all(draftId);
      expect(members).toHaveLength(2);
    });
  });

  describe('PUT /api/drafts/:draftId/status', () => {
    let draftId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;
    });

    it('should update draft status', async () => {
      const res = await request(app)
        .put(`/api/drafts/${draftId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'brainstorming' });

      expect(res.status).toBe(200);
      expect(res.body.draft.status).toBe('brainstorming');
    });

    it('should return 400 for invalid status value', async () => {
      const res = await request(app)
        .put(`/api/drafts/${draftId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid status value');
    });
  });

  describe('DELETE /api/drafts/:draftId', () => {
    let draftId: number;
    let anotherUserId: number;
    let anotherAuthToken: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;

      // Create another user
      const anotherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Another User', email: 'another@test.com', password: 'password123' });
      anotherUserId = anotherRes.body.user.id;
      anotherAuthToken = anotherRes.body.token;

      // Add as project member
      db.prepare(
        'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
      ).run(projectId, anotherUserId, 'developer');
    });

    it('should delete draft when owner requests', async () => {
      const res = await request(app)
        .delete(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify draft is deleted
      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
      expect(draft).toBeUndefined();
    });

    it('should return 403 when non-owner tries to delete', async () => {
      // Add another user as draft member (not owner)
      db.prepare(
        'INSERT INTO draft_members (draft_id, user_id, role) VALUES (?, ?, ?)'
      ).run(draftId, anotherUserId, 'participant');

      const res = await request(app)
        .delete(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${anotherAuthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only owner can delete draft');
    });

    it('should return 400 for invalid draftId', async () => {
      const res = await request(app)
        .delete('/api/drafts/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid draftId');
    });
  });
});
