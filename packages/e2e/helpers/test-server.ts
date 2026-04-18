// packages/e2e/helpers/test-server.ts
import { createServer, Server } from 'http';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { AddressInfo } from 'net';
import {
  users,
  organizations,
  organizationMembers,
  organizationInvitations,
  projects,
  drafts,
  draftMembers,
  draftMessages,
} from '@code-link/server/dist/db/schema/index.js';

export const TEST_JWT_SECRET = 'test-secret-key-for-e2e';

type DrizzleDb = ReturnType<typeof drizzle>;

/**
 * 测试服务器实例
 */
export interface TestServer {
  server: Server;
  port: number;
  baseUrl: string;
  db: Database.Database;
  orm: DrizzleDb;
}

/**
 * 创建测试 Express 应用（使用 Drizzle ORM）
 */
export function createTestApp(sqlite: Database.Database): express.Express {
  const app = express();
  const db = drizzle(sqlite);

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    try {
      const existing = await db.select().from(users).where(eq(users.email, email)).get();
      if (existing) {
        res.status(409).json({ error: '该邮箱已被注册' });
        return;
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const result = await db.insert(users).values({ name, email, passwordHash }).returning().get();

      const token = jwt.sign({ userId: result.id }, TEST_JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({ data: { token, user: result } });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: '注册失败' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: '缺少邮箱或密码' });
      return;
    }

    try {
      const user = await db.select().from(users).where(eq(users.email, email)).get();
      if (!user) {
        res.status(401).json({ error: '认证失败' });
        return;
      }

      const valid = bcrypt.compareSync(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: '认证失败' });
        return;
      }

      const token = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, { expiresIn: '7d' });

      res.json({
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: '登录失败' });
    }
  });

  app.get('/api/auth/me', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }
      res.json({ data: user });
    } catch (error) {
      res.status(500).json({ error: '获取用户信息失败' });
    }
  });

  // Projects routes
  app.get('/api/projects', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const searchQuery = req.query.search as string | undefined;

    try {
      let whereConditions = [eq(organizationMembers.userId, userId)];

      // 如果有搜索参数，添加搜索条件
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = `%${searchQuery.trim()}%`;
        whereConditions.push(sql`${projects.name} LIKE ${searchTerm}`);
      }

      const result = await db
        .select({
          id: projects.id,
          name: projects.name,
          templateType: projects.templateType,
          organizationId: projects.organizationId,
          containerId: projects.containerId,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          memberRole: organizationMembers.role,
        })
        .from(projects)
        .innerJoin(organizationMembers, eq(projects.organizationId, organizationMembers.organizationId))
        .where(and(...whereConditions))
        .orderBy(desc(projects.createdAt));

      res.json({ data: result });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ error: '获取项目列表失败' });
    }
  });

  // 项目详情
  app.get('/api/projects/:id', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id as string, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const project = await db
        .select({
          id: projects.id,
          name: projects.name,
          templateType: projects.templateType,
          organizationId: projects.organizationId,
          containerId: projects.containerId,
          status: projects.status,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查权限
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限访问此项目' });
        return;
      }

      // 获取项目成员信息
      const members = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(eq(organizationMembers.organizationId, project.organizationId));

      res.json({ data: { ...project, members } });
    } catch (error) {
      console.error('Get project detail error:', error);
      res.status(500).json({ error: '获取项目详情失败' });
    }
  });

  // 项目更新
  app.put('/api/projects/:id', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id as string, 10);
    const { name, status } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!name && !status) {
      res.status(400).json({ error: '缺少更新内容' });
      return;
    }

    try {
      const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查权限
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限更新此项目' });
        return;
      }

      // 构建更新数据
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (status) updateData.status = status;

      const updated = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, projectId))
        .returning()
        .get();

      res.json({ data: updated });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ error: '更新项目失败' });
    }
  });

  app.post('/api/projects', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const { name, templateType, organizationId } = req.body;

    if (!name) {
      res.status(400).json({ error: '缺少项目名称' });
      return;
    }

    if (!organizationId) {
      res.status(400).json({ error: '缺少组织 ID' });
      return;
    }

    try {
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限在此组织创建项目' });
        return;
      }

      const project = await db
        .insert(projects)
        .values({
          name,
          templateType: templateType || 'node',
          organizationId,
          createdBy: userId,
          status: 'created',
        })
        .returning()
        .get();

      res.status(201).json({ data: project });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: '创建项目失败' });
    }
  });

  app.delete('/api/projects/:id', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id as string, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限删除此项目' });
        return;
      }

      await db.delete(projects).where(eq(projects.id, projectId));
      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: '删除项目失败' });
    }
  });

  // Organizations routes
  app.get('/api/organizations', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    try {
      const result = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          createdBy: organizations.createdBy,
          createdAt: organizations.createdAt,
          memberRole: organizationMembers.role,
        })
        .from(organizations)
        .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
        .where(eq(organizationMembers.userId, userId))
        .orderBy(desc(organizations.createdAt));

      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: '获取组织列表失败' });
    }
  });

  app.post('/api/organizations', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: '缺少组织名称' });
      return;
    }

    try {
      const result = await db
        .insert(organizations)
        .values({ name, createdBy: userId })
        .returning()
        .get();

      await db.insert(organizationMembers).values({
        organizationId: result.id,
        userId,
        role: 'owner',
        invitedBy: userId,
      });

      res.status(201).json({ data: result });
    } catch (error) {
      console.error('Create organization error:', error);
      res.status(500).json({ error: '创建组织失败' });
    }
  });

  // Organization detail
  app.get('/api/organizations/:id', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(req.params.id as string, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      const org = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          createdBy: organizations.createdBy,
          createdAt: organizations.createdAt,
          memberRole: organizationMembers.role,
        })
        .from(organizations)
        .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
        .where(and(
          eq(organizations.id, orgId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!org) {
        res.status(404).json({ error: '组织不存在或无权限访问' });
        return;
      }

      res.json({ data: org });
    } catch (error) {
      console.error('Get organization error:', error);
      res.status(500).json({ error: '获取组织详情失败' });
    }
  });

  // Organization members list
  app.get('/api/organizations/:id/members', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(req.params.id as string, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      // Check if user is a member of the organization
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限访问此组织' });
        return;
      }

      const members = await db
        .select({
          id: organizationMembers.id,
          organizationId: organizationMembers.organizationId,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
          invitedBy: organizationMembers.invitedBy,
          joinedAt: organizationMembers.joinedAt,
          name: users.name,
          email: users.email,
          avatar: users.avatar,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(eq(organizationMembers.organizationId, orgId));

      res.json({ data: members });
    } catch (error) {
      console.error('Get organization members error:', error);
      res.status(500).json({ error: '获取成员列表失败' });
    }
  });

  // Invite member
  app.post('/api/organizations/:id/invitations', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(req.params.id as string, 10);
    const { email, role } = req.body;

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    if (!email) {
      res.status(400).json({ error: '缺少邮箱地址' });
      return;
    }

    try {
      // Check if user is a member of the organization
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限邀请成员' });
        return;
      }

      // Check if there's already a pending invitation
      const existingInvitation = await db
        .select()
        .from(organizationInvitations)
        .where(and(
          eq(organizationInvitations.organizationId, orgId),
          eq(organizationInvitations.email, email.toLowerCase()),
          eq(organizationInvitations.status, 'pending')
        ))
        .get();

      if (existingInvitation) {
        res.status(409).json({ error: '该邮箱已有待处理的邀请' });
        return;
      }

      const invitation = await db
        .insert(organizationInvitations)
        .values({
          organizationId: orgId,
          email: email.toLowerCase(),
          role: role || 'member',
          invitedBy: userId,
          status: 'pending',
        })
        .returning()
        .get();

      res.status(201).json({ data: invitation });
    } catch (error) {
      console.error('Create invitation error:', error);
      res.status(500).json({ error: '发送邀请失败' });
    }
  });

  // Organization invitations list
  app.get('/api/organizations/:id/invitations', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(req.params.id as string, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      // Check if user is a member of the organization
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership) {
        res.status(403).json({ error: '无权限访问此组织' });
        return;
      }

      const invitations = await db
        .select({
          id: organizationInvitations.id,
          organizationId: organizationInvitations.organizationId,
          email: organizationInvitations.email,
          role: organizationInvitations.role,
          invitedBy: organizationInvitations.invitedBy,
          status: organizationInvitations.status,
          createdAt: organizationInvitations.createdAt,
          invitedByName: users.name,
        })
        .from(organizationInvitations)
        .leftJoin(users, eq(organizationInvitations.invitedBy, users.id))
        .where(eq(organizationInvitations.organizationId, orgId));

      res.json({ data: invitations });
    } catch (error) {
      console.error('Get organization invitations error:', error);
      res.status(500).json({ error: '获取邀请列表失败' });
    }
  });

  // Update member role
  app.put('/api/organizations/:orgId/members/:userId', authMiddleware(db), async (req, res) => {
    const currentUserId = (req as any).userId;
    const orgId = parseInt(req.params.orgId as string, 10);
    const targetUserId = parseInt(req.params.userId as string, 10);
    const { role } = req.body;

    if (isNaN(orgId) || isNaN(targetUserId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    if (!role || !['owner', 'developer', 'member'].includes(role)) {
      res.status(400).json({ error: '无效的角色' });
      return;
    }

    try {
      // Check if current user is an owner
      const currentMembership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, currentUserId)
        ))
        .get();

      if (!currentMembership || currentMembership.role !== 'owner') {
        res.status(403).json({ error: '只有组织所有者可以更新成员角色' });
        return;
      }

      // Update the target member's role
      const result = await db
        .update(organizationMembers)
        .set({ role })
        .where(and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId)
        ))
        .returning()
        .get();

      if (!result) {
        res.status(404).json({ error: '成员不存在' });
        return;
      }

      res.json({ data: result });
    } catch (error) {
      console.error('Update member role error:', error);
      res.status(500).json({ error: '更新成员角色失败' });
    }
  });

  // Delete organization
  app.delete('/api/organizations/:id', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const orgId = parseInt(req.params.id as string, 10);

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    try {
      // Check if user is an owner
      const membership = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId)
        ))
        .get();

      if (!membership || membership.role !== 'owner') {
        res.status(403).json({ error: '只有组织所有者可以删除组织' });
        return;
      }

      // Delete organization (cascade will handle members, invitations, projects)
      await db.delete(organizations).where(eq(organizations.id, orgId));

      res.json({ data: { success: true } });
    } catch (error) {
      console.error('Delete organization error:', error);
      res.status(500).json({ error: '删除组织失败' });
    }
  });

  // Drafts routes
  app.get('/api/drafts', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectIdQuery = req.query.projectId;
    const projectId = projectIdQuery ? parseInt(projectIdQuery as string, 10) : undefined;

    try {
      const conditions = [eq(draftMembers.userId, userId)];
      if (projectId && !isNaN(projectId)) {
        conditions.push(eq(drafts.projectId, projectId));
      }

      const result = await db
        .select({
          id: drafts.id,
          projectId: drafts.projectId,
          title: drafts.title,
          status: drafts.status,
          createdBy: drafts.createdBy,
          createdAt: drafts.createdAt,
          updatedAt: drafts.updatedAt,
          memberRole: draftMembers.role,
        })
        .from(drafts)
        .innerJoin(draftMembers, eq(drafts.id, draftMembers.draftId))
        .where(and(...conditions))
        .orderBy(desc(drafts.updatedAt));

      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: '获取草稿列表失败' });
    }
  });

  app.post('/api/drafts', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const { projectId, title } = req.body;

    if (!projectId || !title) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    try {
      const result = await db
        .insert(drafts)
        .values({
          projectId,
          title,
          status: 'discussing',
          createdBy: userId,
        })
        .returning()
        .get();

      await db.insert(draftMembers).values({
        draftId: result.id,
        userId,
        role: 'owner',
      });

      res.status(201).json({ data: result });
    } catch (error) {
      console.error('Create draft error:', error);
      res.status(500).json({ error: '创建草稿失败' });
    }
  });

  // Draft messages
  app.get('/api/drafts/:draftId/messages', authMiddleware(db), async (req, res) => {
    const draftId = parseInt(req.params.draftId as string, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的草稿 ID' });
      return;
    }

    try {
      const result = await db
        .select({
          id: draftMessages.id,
          draftId: draftMessages.draftId,
          parentId: draftMessages.parentId,
          userId: draftMessages.userId,
          content: draftMessages.content,
          messageType: draftMessages.messageType,
          metadata: draftMessages.metadata,
          createdAt: draftMessages.createdAt,
          updatedAt: draftMessages.updatedAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(draftMessages)
        .leftJoin(users, eq(draftMessages.userId, users.id))
        .where(eq(draftMessages.draftId, draftId))
        .orderBy(asc(draftMessages.createdAt));

      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: '获取消息列表失败' });
    }
  });

  app.post('/api/drafts/:draftId/messages', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId as string, 10);
    const { content, messageType, parentId } = req.body;

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的草稿 ID' });
      return;
    }

    if (!content) {
      res.status(400).json({ error: '缺少消息内容' });
      return;
    }

    try {
      const result = await db
        .insert(draftMessages)
        .values({
          draftId,
          userId,
          content,
          messageType: messageType || 'text',
          parentId: parentId ?? null,
        })
        .returning()
        .get();

      res.status(201).json({ data: result });
    } catch (error) {
      console.error('Create message error:', error);
      res.status(500).json({ error: '发送消息失败' });
    }
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

/**
 * 认证中间件
 */
function authMiddleware(db: DrizzleDb) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: '未提供认证令牌' });
      return;
    }

    const token = header.slice(7);
    if (!token) {
      res.status(401).json({ error: '未提供认证令牌' });
      return;
    }

    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET);
      if (typeof payload !== 'object' || payload === null || typeof payload.userId !== 'number') {
        res.status(401).json({ error: '无效的认证令牌' });
        return;
      }
      (req as any).userId = payload.userId;
      next();
    } catch (err) {
      res.status(401).json({ error: '无效的认证令牌' });
    }
  };
}

/**
 * 启动测试服务器
 */
export async function startTestServer(sqlite: Database.Database): Promise<TestServer> {
  const app = createTestApp(sqlite);
  const server = createServer(app);
  const orm = drizzle(sqlite);

  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      resolve({
        server,
        port,
        baseUrl: `http://localhost:${port}`,
        db: sqlite,
        orm,
      });
    });

    server.on('error', reject);
  });
}

/**
 * 关闭测试服务器
 */
export async function stopTestServer(testServer: TestServer): Promise<void> {
  return new Promise((resolve, reject) => {
    testServer.server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 生成测试 JWT token
 */
export function generateTestToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });
}

/**
 * 生成已过期的测试 JWT token
 */
export function generateExpiredToken(userId: number): string {
  // 创建一个已经过期的 token（过期时间设为 1 秒前）
  return jwt.sign({ userId, exp: Math.floor(Date.now() / 1000) - 1 }, TEST_JWT_SECRET);
}
