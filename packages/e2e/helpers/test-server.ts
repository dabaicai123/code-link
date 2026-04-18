// packages/e2e/helpers/test-server.ts
import { createServer, Server } from 'http';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { AddressInfo } from 'net';

export const TEST_JWT_SECRET = 'test-secret-key-for-e2e';

/**
 * 测试服务器实例
 */
export interface TestServer {
  server: Server;
  port: number;
  baseUrl: string;
  db: Database.Database;
}

/**
 * 创建测试 Express 应用（简化版，包含核心 API）
 */
export function createTestApp(db: Database.Database): express.Express {
  const app = express();

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
      // 检查邮箱是否已存在
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        res.status(409).json({ error: '该邮箱已被注册' });
        return;
      }

      // 创建用户
      const passwordHash = bcrypt.hashSync(password, 10);
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash)
        VALUES (?, ?, ?)
      `).run(name, email, passwordHash);

      const userId = result.lastInsertRowid as number;
      const user = db.prepare('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?').get(userId);

      // 生成 JWT token
      const token = jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({ data: { token, user } });
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
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        res.status(401).json({ error: '认证失败' });
        return;
      }

      const valid = bcrypt.compareSync(password, (user as any).password_hash);
      if (!valid) {
        res.status(401).json({ error: '认证失败' });
        return;
      }

      const token = jwt.sign({ userId: (user as any).id }, TEST_JWT_SECRET, { expiresIn: '7d' });

      res.json({
        data: {
          token,
          user: {
            id: (user as any).id,
            name: (user as any).name,
            email: (user as any).email,
            avatar: (user as any).avatar,
            createdAt: (user as any).created_at,
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
      const user = db.prepare('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?').get(userId);
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
    try {
      const projects = db.prepare(`
        SELECT p.*, pm.role as member_role
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = ?
        ORDER BY p.created_at DESC
      `).all(userId);
      res.json({ data: projects });
    } catch (error) {
      res.status(500).json({ error: '获取项目列表失败' });
    }
  });

  app.post('/api/projects', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const { name, templateType, organizationId } = req.body;

    if (!name) {
      res.status(400).json({ error: '缺少项目名称' });
      return;
    }

    try {
      const result = db.prepare(`
        INSERT INTO projects (name, template_type, organization_id, created_by, status)
        VALUES (?, ?, ?, ?, 'created')
      `).run(name, templateType || 'node', organizationId ?? null, userId);

      const projectId = result.lastInsertRowid as number;

      db.prepare(`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (?, ?, 'owner')
      `).run(projectId, userId);

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      res.status(201).json({ data: project });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: '创建项目失败' });
    }
  });

  app.delete('/api/projects/:id', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      // 检查用户是否是项目成员
      const membership = db.prepare(`
        SELECT role FROM project_members WHERE project_id = ? AND user_id = ?
      `).get(projectId, userId);

      if (!membership) {
        res.status(403).json({ error: '无权限删除此项目' });
        return;
      }

      // 删除项目（cascade 会删除相关数据）
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: '删除项目失败' });
    }
  });

  // Organizations routes
  app.get('/api/organizations', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    try {
      const orgs = db.prepare(`
        SELECT o.*, om.role as member_role
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ?
        ORDER BY o.created_at DESC
      `).all(userId);
      res.json({ data: orgs });
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
      const result = db.prepare(`
        INSERT INTO organizations (name, created_by)
        VALUES (?, ?)
      `).run(name, userId);

      const orgId = result.lastInsertRowid as number;

      db.prepare(`
        INSERT INTO organization_members (organization_id, user_id, role, invited_by)
        VALUES (?, ?, 'owner', ?)
      `).run(orgId, userId, userId);

      const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
      res.status(201).json({ data: org });
    } catch (error) {
      console.error('Create organization error:', error);
      res.status(500).json({ error: '创建组织失败' });
    }
  });

  // Drafts routes
  app.get('/api/drafts', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const projectId = req.query.projectId;

    try {
      let drafts;
      if (projectId) {
        drafts = db.prepare(`
          SELECT d.*, dm.role as member_role
          FROM drafts d
          JOIN draft_members dm ON d.id = dm.draft_id
          WHERE dm.user_id = ? AND d.project_id = ?
          ORDER BY d.updated_at DESC
        `).all(userId, projectId);
      } else {
        drafts = db.prepare(`
          SELECT d.*, dm.role as member_role
          FROM drafts d
          JOIN draft_members dm ON d.id = dm.draft_id
          WHERE dm.user_id = ?
          ORDER BY d.updated_at DESC
        `).all(userId);
      }
      res.json({ data: drafts });
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
      const result = db.prepare(`
        INSERT INTO drafts (project_id, title, status, created_by)
        VALUES (?, ?, 'discussing', ?)
      `).run(projectId, title, userId);

      const draftId = result.lastInsertRowid as number;

      db.prepare(`
        INSERT INTO draft_members (draft_id, user_id, role)
        VALUES (?, ?, 'owner')
      `).run(draftId, userId);

      const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
      res.status(201).json({ data: draft });
    } catch (error) {
      console.error('Create draft error:', error);
      res.status(500).json({ error: '创建草稿失败' });
    }
  });

  // Draft messages
  app.get('/api/drafts/:draftId/messages', authMiddleware(db), async (req, res) => {
    const draftId = parseInt(req.params.draftId, 10);

    if (isNaN(draftId)) {
      res.status(400).json({ error: '无效的草稿 ID' });
      return;
    }

    try {
      const messages = db.prepare(`
        SELECT dm.*, u.name as user_name, u.email as user_email
        FROM draft_messages dm
        LEFT JOIN users u ON dm.user_id = u.id
        WHERE dm.draft_id = ?
        ORDER BY dm.created_at ASC
      `).all(draftId);
      res.json({ data: messages });
    } catch (error) {
      res.status(500).json({ error: '获取消息列表失败' });
    }
  });

  app.post('/api/drafts/:draftId/messages', authMiddleware(db), async (req, res) => {
    const userId = (req as any).userId;
    const draftId = parseInt(req.params.draftId, 10);
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
      const result = db.prepare(`
        INSERT INTO draft_messages (draft_id, user_id, content, message_type, parent_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(draftId, userId, content, messageType || 'text', parentId ?? null);

      const messageId = result.lastInsertRowid as number;
      const message = db.prepare('SELECT * FROM draft_messages WHERE id = ?').get(messageId);
      res.status(201).json({ data: message });
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
function authMiddleware(db: Database.Database) {
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
export async function startTestServer(db: Database.Database): Promise<TestServer> {
  const app = createTestApp(db);
  const server = createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      resolve({
        server,
        port,
        baseUrl: `http://localhost:${port}`,
        db,
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