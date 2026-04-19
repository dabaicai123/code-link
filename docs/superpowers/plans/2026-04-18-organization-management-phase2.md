# 组织管理第二阶段：API 路由实现

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现组织管理、成员管理、邀请管理的完整 API 路由，并将项目关联到组织。

**Architecture:** 创建独立的 organizations 路由模块，使用第一阶段实现的权限中间件，更新 projects 表结构添加 organization_id 字段。

**Tech Stack:** TypeScript, Express.js, better-sqlite3

---

## Files Overview

| File | Purpose |
|------|---------|
| `packages/server/src/routes/organizations.ts` | 组织管理 API 路由（新建） |
| `packages/server/src/db/migration.ts` | 添加 projects 表 organization_id 迁移 |
| `packages/server/src/types.ts` | 添加带组织信息的项目类型 |
| `packages/server/src/routes/projects.ts` | 更新项目 API 支持组织 |
| `packages/server/src/index.ts` | 注册组织路由 |

---

## Task 1: 添加 projects 表 organization_id 字段迁移

**Files:**
- Modify: `packages/server/src/db/migration.ts`
- Modify: `packages/server/src/types.ts`

- [ ] **Step 1: 在 migration.ts 中添加迁移函数**

在 `runOrganizationMigration` 函数之后添加：

```typescript
/**
 * 运行项目组织关联迁移
 * 为 projects 表添加 organization_id 字段
 */
export function runProjectOrganizationMigration(db: Database.Database): void {
  logger.info('Running project organization migration...');

  // 检查 organization_id 列是否已存在
  const columns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const hasOrgId = columns.some(col => col.name === 'organization_id');

  if (hasOrgId) {
    logger.info('projects.organization_id already exists, skipping migration');
    return;
  }

  // 添加 organization_id 列
  db.exec('ALTER TABLE projects ADD COLUMN organization_id INTEGER REFERENCES organizations(id)');
  logger.info('Added organization_id column to projects table');

  logger.info('Project organization migration completed');
}
```

- [ ] **Step 2: 更新 migration.ts 导出**

确保新函数被正确导出（已在上一步代码中导出）

- [ ] **Step 3: 更新 types.ts 中 Project 接口**

修改 `packages/server/src/types.ts` 中的 Project 接口：

```typescript
export interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  organization_id: number;
  container_id: string | null;
  status: 'created' | 'running' | 'stopped';
  created_by: number;
  created_at: string;
}
```

- [ ] **Step 4: 在 index.ts 中运行新迁移**

在 `runOrganizationMigration(db);` 之后添加：

```typescript
  // 运行项目组织关联迁移
  runProjectOrganizationMigration(db);
```

- [ ] **Step 5: 验证编译**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 6: 提交迁移更新**

```bash
git -C /root/my/code-link add packages/server/src/db/migration.ts packages/server/src/types.ts packages/server/src/index.ts
git -C /root/my/code-link commit -m "feat(server): add organization_id to projects table

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 创建组织管理路由（基础 CRUD）

**Files:**
- Create: `packages/server/src/routes/organizations.ts`

- [ ] **Step 1: 创建组织路由文件骨架**

创建 `packages/server/src/routes/organizations.ts`：

```typescript
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware, createOrgMemberMiddleware, createCanCreateOrgMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import type { Organization, OrganizationMember, OrgRole } from '../types.js';
import { isSuperAdmin } from '../utils/super-admin.js';

const logger = createLogger('organizations');

export function createOrganizationsRouter(db: Database.Database): Router {
  const router = Router();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // 路由将在后续步骤中添加

  return router;
}
```

- [ ] **Step 2: 实现创建组织 API**

在路由骨架中添加：

```typescript
  // POST /api/organizations - 创建组织
  router.post('/', createCanCreateOrgMiddleware(db), (req, res) => {
    const userId = (req as any).userId;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: '组织名称不能为空' });
      return;
    }

    if (name.length > 100) {
      res.status(400).json({ error: '组织名称不能超过 100 个字符' });
      return;
    }

    try {
      const createOrgTx = db.transaction(() => {
        const result = db
          .prepare('INSERT INTO organizations (name, created_by) VALUES (?, ?)')
          .run(name.trim(), userId);

        const orgId = result.lastInsertRowid as number;

        // 创建者自动成为 owner
        db.prepare(
          'INSERT INTO organization_members (organization_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
        ).run(orgId, userId, 'owner', userId);

        return orgId;
      });

      const orgId = createOrgTx();

      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(orgId) as Organization;

      res.status(201).json(org);
    } catch (error) {
      logger.error('创建组织失败', error);
      res.status(500).json({ error: '创建组织失败' });
    }
  });
```

- [ ] **Step 3: 实现获取用户所属组织列表 API**

```typescript
  // GET /api/organizations - 获取用户所属的组织列表
  router.get('/', (req, res) => {
    const userId = (req as any).userId;

    try {
      const organizations = db
        .prepare(
          `SELECT o.id, o.name, o.created_by, o.created_at, om.role
           FROM organizations o
           JOIN organization_members om ON o.id = om.organization_id
           WHERE om.user_id = ?
           ORDER BY o.created_at DESC`
        )
        .all(userId) as Array<Organization & { role: OrgRole }>;

      res.json(organizations);
    } catch (error) {
      logger.error('获取组织列表失败', error);
      res.status(500).json({ error: '获取组织列表失败' });
    }
  });
```

- [ ] **Step 4: 实现获取组织详情 API**

```typescript
  // GET /api/organizations/:id - 获取组织详情
  router.get('/:id', createOrgMemberMiddleware(db, 'member'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);

    try {
      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(orgId) as Organization | undefined;

      if (!org) {
        res.status(404).json({ error: '组织不存在' });
        return;
      }

      // 获取组织成员列表
      const members = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.avatar, om.role, om.joined_at
           FROM organization_members om
           JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = ?
           ORDER BY om.joined_at ASC`
        )
        .all(orgId) as Array<{
          id: number;
          name: string;
          email: string;
          avatar: string | null;
          role: OrgRole;
          joined_at: string;
        }>;

      res.json({ ...org, members });
    } catch (error) {
      logger.error('获取组织详情失败', error);
      res.status(500).json({ error: '获取组织详情失败' });
    }
  });
```

- [ ] **Step 5: 实现修改组织名称 API**

```typescript
  // PUT /api/organizations/:id - 修改组织名称
  router.put('/:id', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: '组织名称不能为空' });
      return;
    }

    if (name.length > 100) {
      res.status(400).json({ error: '组织名称不能超过 100 个字符' });
      return;
    }

    try {
      const result = db
        .prepare('UPDATE organizations SET name = ? WHERE id = ?')
        .run(name.trim(), orgId);

      if (result.changes === 0) {
        res.status(404).json({ error: '组织不存在' });
        return;
      }

      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(orgId) as Organization;

      res.json(org);
    } catch (error) {
      logger.error('修改组织名称失败', error);
      res.status(500).json({ error: '修改组织名称失败' });
    }
  });
```

- [ ] **Step 6: 实现删除组织 API**

```typescript
  // DELETE /api/organizations/:id - 删除组织
  router.delete('/:id', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);

    try {
      // 检查组织下是否还有项目
      const projectCount = db
        .prepare('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?')
        .get(orgId) as { count: number };

      if (projectCount.count > 0) {
        res.status(400).json({ error: '组织下还有项目，请先删除或迁移项目' });
        return;
      }

      const result = db.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);

      if (result.changes === 0) {
        res.status(404).json({ error: '组织不存在' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('删除组织失败', error);
      res.status(500).json({ error: '删除组织失败' });
    }
  });
```

- [ ] **Step 7: 验证编译**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 8: 提交组织基础路由**

```bash
git -C /root/my/code-link add packages/server/src/routes/organizations.ts
git -C /root/my/code-link commit -m "feat(server): add organization CRUD routes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: 实现组织成员管理 API

**Files:**
- Modify: `packages/server/src/routes/organizations.ts`

- [ ] **Step 1: 实现修改成员角色 API**

在 `createOrganizationsRouter` 函数中，`DELETE /api/organizations/:id` 之后添加：

```typescript
  // PUT /api/organizations/:id/members/:userId - 修改成员角色
  router.put('/:id/members/:userId', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    const { role } = req.body;

    const validRoles: OrgRole[] = ['owner', 'developer', 'member'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: '无效的角色，必须是 owner、developer 或 member' });
      return;
    }

    try {
      // 检查目标成员是否存在
      const membership = db
        .prepare('SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?')
        .get(orgId, targetUserId) as { role: OrgRole } | undefined;

      if (!membership) {
        res.status(404).json({ error: '该用户不是组织成员' });
        return;
      }

      // 检查是否是最后一个 owner
      if (membership.role === 'owner' && role !== 'owner') {
        const ownerCount = db
          .prepare("SELECT COUNT(*) as count FROM organization_members WHERE organization_id = ? AND role = 'owner'")
          .get(orgId) as { count: number };

        if (ownerCount.count <= 1) {
          res.status(400).json({ error: '不能修改最后一个 owner 的角色' });
          return;
        }
      }

      db.prepare('UPDATE organization_members SET role = ? WHERE organization_id = ? AND user_id = ?').run(role, orgId, targetUserId);

      const updatedMember = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.avatar, om.role, om.joined_at
           FROM organization_members om
           JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = ? AND om.user_id = ?`
        )
        .get(orgId, targetUserId) as {
          id: number;
          name: string;
          email: string;
          avatar: string | null;
          role: OrgRole;
          joined_at: string;
        };

      res.json(updatedMember);
    } catch (error) {
      logger.error('修改成员角色失败', error);
      res.status(500).json({ error: '修改成员角色失败' });
    }
  });
```

- [ ] **Step 2: 实现移除成员 API**

```typescript
  // DELETE /api/organizations/:id/members/:userId - 移除成员
  router.delete('/:id/members/:userId', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    const currentUserId = (req as any).userId;

    try {
      // 检查目标成员是否存在
      const membership = db
        .prepare('SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?')
        .get(orgId, targetUserId) as { role: OrgRole } | undefined;

      if (!membership) {
        res.status(404).json({ error: '该用户不是组织成员' });
        return;
      }

      // 不能移除自己
      if (targetUserId === currentUserId) {
        res.status(400).json({ error: '不能移除自己' });
        return;
      }

      // 检查是否是最后一个 owner
      if (membership.role === 'owner') {
        const ownerCount = db
          .prepare("SELECT COUNT(*) as count FROM organization_members WHERE organization_id = ? AND role = 'owner'")
          .get(orgId) as { count: number };

        if (ownerCount.count <= 1) {
          res.status(400).json({ error: '不能移除最后一个 owner' });
          return;
        }
      }

      const result = db.prepare('DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?').run(orgId, targetUserId);

      if (result.changes === 0) {
        res.status(404).json({ error: '成员不存在' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('移除成员失败', error);
      res.status(500).json({ error: '移除成员失败' });
    }
  });
```

- [ ] **Step 3: 验证编译**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 4: 提交成员管理路由**

```bash
git -C /root/my/code-link add packages/server/src/routes/organizations.ts
git -C /root/my/code-link commit -m "feat(server): add organization member management routes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: 实现组织邀请管理 API

**Files:**
- Modify: `packages/server/src/routes/organizations.ts`

- [ ] **Step 1: 实现邀请成员 API**

在 `DELETE /:id/members/:userId` 路由之后添加：

```typescript
  // POST /api/organizations/:id/invitations - 邀请成员
  router.post('/:id/invitations', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);
    const userId = (req as any).userId;
    const { email, role } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: '邮箱地址不能为空' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: '邮箱地址格式不正确' });
      return;
    }

    const validRoles: OrgRole[] = ['owner', 'developer', 'member'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: '无效的角色，必须是 owner、developer 或 member' });
      return;
    }

    try {
      // 检查用户是否已是组织成员
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
      if (existingUser) {
        const existingMember = db
          .prepare('SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?')
          .get(orgId, existingUser.id);
        if (existingMember) {
          res.status(400).json({ error: '该用户已是组织成员' });
          return;
        }
      }

      // 检查是否已有待处理邀请
      const existingInvitation = db
        .prepare("SELECT id FROM organization_invitations WHERE organization_id = ? AND email = ? AND status = 'pending'")
        .get(orgId, email);
      if (existingInvitation) {
        res.status(400).json({ error: '该邮箱已有待处理的邀请' });
        return;
      }

      const result = db
        .prepare(
          'INSERT INTO organization_invitations (organization_id, email, role, invited_by) VALUES (?, ?, ?, ?)'
        )
        .run(orgId, email.toLowerCase(), role, userId);

      const invitation = db
        .prepare('SELECT * FROM organization_invitations WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(invitation);
    } catch (error) {
      logger.error('邀请成员失败', error);
      res.status(500).json({ error: '邀请成员失败' });
    }
  });
```

- [ ] **Step 2: 实现获取待处理邀请列表 API**

```typescript
  // GET /api/organizations/:id/invitations - 获取待处理邀请列表
  router.get('/:id/invitations', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);

    try {
      const invitations = db
        .prepare(
          `SELECT oi.*, u.name as invited_by_name
           FROM organization_invitations oi
           LEFT JOIN users u ON oi.invited_by = u.id
           WHERE oi.organization_id = ? AND oi.status = 'pending'
           ORDER BY oi.created_at DESC`
        )
        .all(orgId);

      res.json(invitations);
    } catch (error) {
      logger.error('获取邀请列表失败', error);
      res.status(500).json({ error: '获取邀请列表失败' });
    }
  });
```

- [ ] **Step 3: 实现取消邀请 API**

```typescript
  // DELETE /api/organizations/:id/invitations/:invId - 取消邀请
  router.delete('/:id/invitations/:invId', createOrgMemberMiddleware(db, 'owner'), (req, res) => {
    const orgId = parseInt(req.params.id, 10);
    const invId = parseInt(req.params.invId, 10);

    try {
      const result = db
        .prepare('DELETE FROM organization_invitations WHERE id = ? AND organization_id = ? AND status = ?')
        .run(invId, orgId, 'pending');

      if (result.changes === 0) {
        res.status(404).json({ error: '邀请不存在或已处理' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('取消邀请失败', error);
      res.status(500).json({ error: '取消邀请失败' });
    }
  });
```

- [ ] **Step 4: 实现获取用户收到的邀请列表 API**

```typescript
  // GET /api/invitations - 获取用户收到的邀请
  router.get('/invitations', (req, res) => {
    const userId = (req as any).userId;

    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const invitations = db
        .prepare(
          `SELECT oi.*, o.name as organization_name, u.name as invited_by_name
           FROM organization_invitations oi
           JOIN organizations o ON oi.organization_id = o.id
           LEFT JOIN users u ON oi.invited_by = u.id
           WHERE oi.email = ? AND oi.status = 'pending'
           ORDER BY oi.created_at DESC`
        )
        .all(user.email.toLowerCase());

      res.json(invitations);
    } catch (error) {
      logger.error('获取邀请列表失败', error);
      res.status(500).json({ error: '获取邀请列表失败' });
    }
  });
```

- [ ] **Step 5: 实现接受邀请 API**

```typescript
  // POST /api/invitations/:invId - 接受邀请
  router.post('/invitations/:invId', (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(req.params.invId, 10);

    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const invitation = db
        .prepare('SELECT * FROM organization_invitations WHERE id = ? AND email = ? AND status = ?')
        .get(invId, user.email.toLowerCase(), 'pending') as OrganizationInvitation | undefined;

      if (!invitation) {
        res.status(404).json({ error: '邀请不存在或已处理' });
        return;
      }

      const acceptTx = db.transaction(() => {
        // 更新邀请状态
        db.prepare("UPDATE organization_invitations SET status = 'accepted' WHERE id = ?").run(invId);

        // 添加为组织成员
        db.prepare(
          'INSERT INTO organization_members (organization_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
        ).run(invitation.organization_id, userId, invitation.role, invitation.invited_by);
      });

      acceptTx();

      const org = db
        .prepare('SELECT id, name, created_by, created_at FROM organizations WHERE id = ?')
        .get(invitation.organization_id) as Organization;

      const member = db
        .prepare(
          `SELECT om.*, u.name, u.email, u.avatar
           FROM organization_members om
           JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = ? AND om.user_id = ?`
        )
        .get(invitation.organization_id, userId);

      res.json({ organization: org, member });
    } catch (error) {
      logger.error('接受邀请失败', error);
      res.status(500).json({ error: '接受邀请失败' });
    }
  });
```

- [ ] **Step 6: 实现拒绝邀请 API**

```typescript
  // DELETE /api/invitations/:invId - 拒绝邀请
  router.delete('/invitations/:invId', (req, res) => {
    const userId = (req as any).userId;
    const invId = parseInt(req.params.invId, 10);

    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const result = db
        .prepare('UPDATE organization_invitations SET status = ? WHERE id = ? AND email = ? AND status = ?')
        .run('declined', invId, user.email.toLowerCase(), 'pending');

      if (result.changes === 0) {
        res.status(404).json({ error: '邀请不存在或已处理' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('拒绝邀请失败', error);
      res.status(500).json({ error: '拒绝邀请失败' });
    }
  });
```

- [ ] **Step 7: 验证编译**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 8: 提交邀请管理路由**

```bash
git -C /root/my/code-link add packages/server/src/routes/organizations.ts
git -C /root/my/code-link commit -m "feat(server): add organization invitation routes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: 更新项目路由支持组织

**Files:**
- Modify: `packages/server/src/routes/projects.ts`

- [ ] **Step 1: 导入组织中间件**

在文件顶部添加导入：

```typescript
import { createProjectMemberMiddleware } from '../middleware/auth.js';
```

- [ ] **Step 2: 更新创建项目 API**

修改 `POST /api/projects` 路由，添加 organization_id 参数和权限检查：

```typescript
  // POST /api/projects - 创建项目
  router.post('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const { name, template_type, organization_id } = req.body;

    if (!name || !template_type || !organization_id) {
      res.status(400).json({ error: '缺少必填字段：name, template_type, organization_id' });
      return;
    }

    if (typeof name !== 'string' || name.length > 100) {
      res.status(400).json({ error: '项目名称必须是 1-100 字符的字符串' });
      return;
    }

    if (!isValidTemplateType(template_type)) {
      res.status(400).json({ error: '无效的模板类型，必须是 node, node+java 或 node+python' });
      return;
    }

    try {
      // 检查用户是否有权限在该组织下创建项目（developer 或 owner）
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const isSuper = user && isSuperAdmin(user.email);

      if (!isSuper) {
        const membership = db
          .prepare(
            "SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? AND role IN ('owner', 'developer')"
          )
          .get(organization_id, userId);

        if (!membership) {
          res.status(403).json({ error: '您没有权限在该组织下创建项目' });
          return;
        }
      }

      const result = db
        .prepare('INSERT INTO projects (name, template_type, organization_id, created_by) VALUES (?, ?, ?, ?)')
        .run(name, template_type, organization_id, userId);

      const projectId = result.lastInsertRowid;

      const project = db
        .prepare('SELECT id, name, template_type, organization_id, container_id, status, created_by, created_at FROM projects WHERE id = ?')
        .get(projectId) as Project;

      res.status(201).json(project);
    } catch (error) {
      logger.error('创建项目失败', error);
      res.status(500).json({ error: '创建项目失败' });
    }
  });
```

- [ ] **Step 3: 导入 isSuperAdmin 函数**

在文件顶部添加：

```typescript
import { isSuperAdmin } from '../utils/super-admin.js';
```

- [ ] **Step 4: 更新获取项目列表 API**

修改 `GET /api/projects` 路由，通过组织成员关系获取项目：

```typescript
  // GET /api/projects - 获取用户参与的所有项目
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    const projects = db
      .prepare(
        `SELECT DISTINCT p.id, p.name, p.template_type, p.organization_id, p.container_id, p.status, p.created_by, p.created_at
         FROM projects p
         JOIN organization_members om ON p.organization_id = om.organization_id
         WHERE om.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(userId) as Project[];

    res.json(projects);
  });
```

- [ ] **Step 5: 更新获取项目详情 API**

修改 `GET /api/projects/:id` 路由，使用新的权限中间件：

```typescript
  // GET /api/projects/:id - 获取项目详情
  router.get('/:id', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      // 获取项目信息
      const project = db
        .prepare('SELECT id, name, template_type, organization_id, container_id, status, created_by, created_at FROM projects WHERE id = ?')
        .get(projectId) as Project | undefined;

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查用户是否是组织成员
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const isSuper = user && isSuperAdmin(user.email);

      if (!isSuper) {
        const membership = db
          .prepare('SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?')
          .get(project.organization_id, userId);

        if (!membership) {
          res.status(403).json({ error: '您没有权限访问该项目' });
          return;
        }
      }

      // 获取组织成员作为项目成员列表
      const members = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.avatar, om.role
           FROM organization_members om
           JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = ?`
        )
        .all(project.organization_id) as Array<{
        id: number;
        name: string;
        email: string;
        avatar: string | null;
        role: OrgRole;
      }>;

      // 获取项目关联的仓库列表
      const repos = db
        .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE project_id = ?')
        .all(projectId);

      res.json({ ...project, members, repos });
    } catch (error) {
      logger.error('获取项目详情失败', error);
      res.status(500).json({ error: '获取项目详情失败' });
    }
  });
```

- [ ] **Step 6: 更新删除项目 API**

修改 `DELETE /api/projects/:id` 路由，使用组织权限检查：

```typescript
  // DELETE /api/projects/:id - 删除项目（仅 owner 可删除）
  router.delete('/:id', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      // 获取项目信息
      const project = db
        .prepare('SELECT organization_id FROM projects WHERE id = ?')
        .get(projectId) as { organization_id: number } | undefined;

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查用户是否是组织的 owner
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const isSuper = user && isSuperAdmin(user.email);

      if (!isSuper) {
        const membership = db
          .prepare("SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? AND role = 'owner'")
          .get(project.organization_id, userId);

        if (!membership) {
          res.status(403).json({ error: '只有组织 owner 可以删除项目' });
          return;
        }
      }

      const result = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

      if (result.changes === 0) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('删除项目失败', error);
      res.status(500).json({ error: '删除项目失败' });
    }
  });
```

- [ ] **Step 7: 添加 OrgRole 类型导入**

在文件顶部添加：

```typescript
import type { OrgRole } from '../types.js';
```

- [ ] **Step 8: 验证编译**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 9: 提交项目路由更新**

```bash
git -C /root/my/code-link add packages/server/src/routes/projects.ts
git -C /root/my/code-link commit -m "feat(server): update projects routes to support organizations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: 注册组织路由到服务器

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 导入组织路由**

在导入部分添加：

```typescript
import { createOrganizationsRouter } from './routes/organizations.js';
```

- [ ] **Step 2: 注册组织路由**

在 `app.use('/api/drafts', createDraftsRouter(db));` 之前添加：

```typescript
  app.use('/api/organizations', createOrganizationsRouter(db));
```

- [ ] **Step 3: 验证编译**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 4: 提交路由注册**

```bash
git -C /root/my/code-link add packages/server/src/index.ts
git -C /root/my/code-link commit -m "feat(server): register organizations router

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: 更新 Drafts 路由适配组织权限

**Files:**
- Modify: `packages/server/src/routes/drafts.ts`

- [ ] **Step 1: 更新 Draft 创建时的项目成员检查**

找到 `POST /api/drafts` 路由中的项目成员检查代码，修改为通过组织检查：

原代码（约第 60-68 行）：
```typescript
      // 检查用户是否是项目成员
      const projectMembership = db
        .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(projectId, userId);

      if (!projectMembership) {
        res.status(403).json({ error: '您不是该项目的成员' });
        return;
      }
```

修改为：
```typescript
      // 获取项目所属组织
      const project = db
        .prepare('SELECT organization_id FROM projects WHERE id = ?')
        .get(projectId) as { organization_id: number } | undefined;

      if (!project) {
        res.status(404).json({ error: '项目不存在' });
        return;
      }

      // 检查用户是否是组织成员（developer 或 owner 才能创建 Draft）
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const isSuper = user && isSuperAdmin(user.email);

      if (!isSuper) {
        const membership = db
          .prepare(
            "SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? AND role IN ('owner', 'developer')"
          )
          .get(project.organization_id, userId);

        if (!membership) {
          res.status(403).json({ error: '您没有权限在该项目下创建 Draft' });
          return;
        }
      }
```

- [ ] **Step 2: 添加 isSuperAdmin 导入**

在文件顶部添加：

```typescript
import { isSuperAdmin } from '../utils/super-admin.js';
```

- [ ] **Step 3: 更新添加 Draft 成员时的项目成员检查**

找到 `POST /api/drafts/:draftId/members` 路由中的项目成员检查代码：

原代码（约第 529-535 行）：
```typescript
      const isProjectMember = db
        .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(draft.project_id, newUserId);
      if (!isProjectMember) {
        res.status(400).json({ error: '用户不是项目成员' });
        return;
      }
```

修改为：
```typescript
      const isOrgMember = db
        .prepare('SELECT 1 FROM organization_members WHERE organization_id = (SELECT organization_id FROM projects WHERE id = ?) AND user_id = ?')
        .get(draft.project_id, newUserId);
      if (!isOrgMember) {
        res.status(400).json({ error: '用户不是项目所属组织的成员' });
        return;
      }
```

- [ ] **Step 4: 验证编译**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 5: 提交 Drafts 路由更新**

```bash
git -C /root/my/code-link add packages/server/src/routes/drafts.ts
git -C /root/my/code-link commit -m "feat(server): update drafts routes to use organization permissions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Summary

第二阶段完成后的成果：
1. projects 表新增 `organization_id` 字段
2. 组织管理 API：创建、查询、修改、删除
3. 组织成员管理 API：修改角色、移除成员
4. 组织邀请管理 API：邀请、接受、拒绝、取消
5. 项目 API 更新：支持组织关联，使用组织权限
6. Draft API 更新：适配组织权限模型

下一阶段将实现前端界面。
