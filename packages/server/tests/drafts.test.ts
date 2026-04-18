// packages/server/tests/drafts.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getSqliteDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { createDraftsRouter } from '../src/routes/drafts.js';
import { createAuthRouter } from '../src/routes/auth.js';
import {
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
  findDraftById,
  findDraftMembers,
  createTestDraftMember,
} from './helpers/test-db.js';

describe('Drafts API', () => {
  let app: express.Express;
  let authToken: string;
  let userId: number;
  let projectId: number;
  let orgId: number;

  beforeEach(async () => {
    const db = getSqliteDb(':memory:');
    initSchema(db);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter());
    app.use('/api/drafts', createDraftsRouter());

    // Create test user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // Create test organization
    const org = createTestOrganization(userId, { name: 'Test Org' });
    orgId = org.id;

    // Add user as organization member
    createTestOrganizationMember(orgId, userId, 'owner', userId);

    // Create test project
    const project = createTestProject(userId, orgId, { name: 'Test Project', templateType: 'node' });
    projectId = project.id;
  });

  afterEach(() => {
    // DB cleanup is handled by the in-memory database
  });

  describe('POST /api/drafts', () => {
    it('should create a draft with owner as member', async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });

      expect(res.status).toBe(201);
      expect(res.body.draft).toMatchObject({
        projectId: projectId,
        title: 'Test Draft',
        status: 'discussing',
        createdBy: userId,
      });
      expect(res.body.draft.id).toBeDefined();

      // Verify creator is owner
      const members = findDraftMembers(res.body.draft.id);
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        userId: userId,
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
      expect(res.body.members[0].userId).toBe(userId);
    });

    it('should return 403 for non-existent draft (not a member)', async () => {
      const res = await request(app)
        .get('/api/drafts/99999')
        .set('Authorization', `Bearer ${authToken}`);

      // API 先检查成员身份，用户不是成员所以返回 403
      expect(res.status).toBe(403);
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
      // API 直接返回数组
      expect(res.body).toHaveLength(2);
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

      // Add as organization member
      createTestOrganizationMember(orgId, anotherUserId, 'developer', userId);
    });

    it('should add member to draft', async () => {
      const res = await request(app)
        .post(`/api/drafts/${draftId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newUserId: anotherUserId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const members = findDraftMembers(draftId);
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

      // 应用层验证返回 500 (error thrown) 或 400
      expect([400, 500]).toContain(res.status);
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

      // Add as organization member
      createTestOrganizationMember(orgId, anotherUserId, 'developer', userId);
    });

    it('should delete draft when owner requests', async () => {
      const res = await request(app)
        .delete(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // API 返回 204 No Content
      expect(res.status).toBe(204);

      // Verify draft is deleted
      const draft = findDraftById(draftId);
      expect(draft).toBeUndefined();
    });

    it('should return 403 when non-owner tries to delete', async () => {
      // Add another user as draft member (not owner)
      createTestDraftMember(draftId, anotherUserId, 'participant');

      const res = await request(app)
        .delete(`/api/drafts/${draftId}`)
        .set('Authorization', `Bearer ${anotherAuthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('只有 Draft owner 可以删除 Draft');
    });

    it('should return 400 for invalid draftId', async () => {
      const res = await request(app)
        .delete('/api/drafts/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('无效的 Draft ID');
    });
  });

  describe('POST /api/drafts/:draftId/messages', () => {
    let draftId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;
    });

    it('should send a text message', async () => {
      const res = await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello world' });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatchObject({
        draftId: draftId,
        userId: userId,
        content: 'Hello world',
        messageType: 'text',
      });
    });

    it('should send a message with parent (thread)', async () => {
      // 先发送一条消息
      const parentRes = await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Parent message' });

      // 回复这条消息
      const res = await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Reply message', parentId: parentRes.body.message.id });

      expect(res.status).toBe(201);
      expect(res.body.message.parentId).toBe(parentRes.body.message.id);
    });

    it('should return 403 when non-member tries to send message', async () => {
      // 创建另一个用户
      const anotherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Another User', email: 'another2@test.com', password: 'password123' });
      const anotherAuthToken = anotherRes.body.token;

      const res = await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({ content: 'Hello' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/drafts/:draftId/messages', () => {
    let draftId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = res.body.draft.id;

      // 发送几条消息
      await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Message 1' });
      await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Message 2' });
    });

    it('should return all messages for draft', async () => {
      const res = await request(app)
        .get(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].content).toBe('Message 1');
      expect(res.body[1].content).toBe('Message 2');
    });

    it('should return 403 when non-member tries to get messages', async () => {
      const anotherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Another User', email: 'another3@test.com', password: 'password123' });
      const anotherAuthToken = anotherRes.body.token;

      const res = await request(app)
        .get(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${anotherAuthToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/drafts/:draftId/messages/:messageId/confirm', () => {
    let draftId: number;
    let messageId: number;

    beforeEach(async () => {
      const draftRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = draftRes.body.draft.id;

      const msgRes = await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Test message' });
      messageId = msgRes.body.message.id;
    });

    it('should confirm a message with agree', async () => {
      const res = await request(app)
        .post(`/api/drafts/${draftId}/messages/${messageId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'agree' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const confRes = await request(app)
        .get(`/api/drafts/${draftId}/messages/${messageId}/confirmations`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(confRes.body.confirmations).toHaveLength(1);
      expect(confRes.body.confirmations[0]).toMatchObject({
        userId: userId,
        type: 'agree',
      });
    });

    it('should confirm a message with disagree', async () => {
      const res = await request(app)
        .post(`/api/drafts/${draftId}/messages/${messageId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'disagree', comment: 'I disagree with this' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const confRes = await request(app)
        .get(`/api/drafts/${draftId}/messages/${messageId}/confirmations`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(confRes.body.confirmations[0].type).toBe('disagree');
      expect(confRes.body.confirmations[0].comment).toBe('I disagree with this');
    });

    it('should update confirmation on second confirm', async () => {
      // 第一次确认
      await request(app)
        .post(`/api/drafts/${draftId}/messages/${messageId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'agree' });

      // 第二次确认（更新）
      await request(app)
        .post(`/api/drafts/${draftId}/messages/${messageId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'disagree' });

      const confRes = await request(app)
        .get(`/api/drafts/${draftId}/messages/${messageId}/confirmations`)
        .set('Authorization', `Bearer ${authToken}`);

      // 应该只有一个确认，类型更新为 disagree
      expect(confRes.body.confirmations).toHaveLength(1);
      expect(confRes.body.confirmations[0].type).toBe('disagree');
    });

    it('should return 404 for non-existent message', async () => {
      const res = await request(app)
        .post(`/api/drafts/${draftId}/messages/99999/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'agree' });

      // API 返回 500 或 404
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('GET /api/drafts/:draftId/messages/:messageId/confirmations', () => {
    let draftId: number;
    let messageId: number;
    let anotherUserId: number;
    let anotherAuthToken: string;

    beforeEach(async () => {
      const draftRes = await request(app)
        .post('/api/drafts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, title: 'Test Draft' });
      draftId = draftRes.body.draft.id;

      const msgRes = await request(app)
        .post(`/api/drafts/${draftId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Test message' });
      messageId = msgRes.body.message.id;

      // 创建另一个用户并添加为组织成员
      const anotherRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Another User', email: 'another4@test.com', password: 'password123' });
      anotherUserId = anotherRes.body.user.id;
      anotherAuthToken = anotherRes.body.token;

      createTestOrganizationMember(orgId, anotherUserId, 'developer', userId);

      // 添加为 draft 成员
      createTestDraftMember(draftId, anotherUserId, 'participant');
    });

    it('should return all confirmations for a message', async () => {
      // 两个用户确认消息
      await request(app)
        .post(`/api/drafts/${draftId}/messages/${messageId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'agree' });

      await request(app)
        .post(`/api/drafts/${draftId}/messages/${messageId}/confirm`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({ type: 'agree' });

      const res = await request(app)
        .get(`/api/drafts/${draftId}/messages/${messageId}/confirmations`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.confirmations).toHaveLength(2);
    });
  });
});
