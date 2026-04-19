# 组织管理第一阶段：数据模型与权限中间件

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立组织管理的数据库模型和权限检查基础设施，支持超级管理员机制和组织成员权限验证。

**Architecture:** 新增 organizations、organization_members、organization_invitations 三张表，实现基于角色的权限中间件，支持超级管理员通过环境变量配置。

**Tech Stack:** TypeScript, Express.js, better-sqlite3, JWT

---

## Files Overview

| File | Purpose |
|------|---------|
| `packages/server/src/db/schema.ts` | 新增三张表的 schema 定义 |
| `packages/server/src/middleware/auth.ts` | 新增超级管理员检查和组织权限中间件 |
| `packages/server/src/types.ts` | 新增组织相关的类型定义 |
| `packages/server/src/utils/super-admin.ts` | 超级管理员检查工具函数 |
| `packages/server/src/db/migration.ts` | 数据迁移脚本（创建新表，不修改现有数据） |

---

## Task 1: 添加组织相关类型定义

**Files:**
- Modify: `packages/server/src/types.ts`

- [ ] **Step 1: 添加 Organization 类型定义**

```typescript
// 在 ProjectMember 接口之后添加

export interface Organization {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: 'owner' | 'developer' | 'member';
  invited_by: number;
  joined_at: string;
}

export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  email: string;
  role: 'owner' | 'developer' | 'member';
  invited_by: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export type OrgRole = 'owner' | 'developer' | 'member';
```

- [ ] **Step 2: 验证类型定义正确**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交类型定义**

```bash
git -C /root/my/code-link add packages/server/src/types.ts
git -C /root/my/code-link commit -m "feat(server): add organization types

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 创建超级管理员工具函数

**Files:**
- Create: `packages/server/src/utils/super-admin.ts`

- [ ] **Step 1: 创建超级管理员检查函数**

```typescript
// packages/server/src/utils/super-admin.ts

/**
 * 检查用户是否为超级管理员
 * 通过环境变量 SUPER_ADMIN_EMAILS 配置，多个邮箱用逗号分隔
 */
export function isSuperAdmin(userEmail: string): boolean {
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return superAdminEmails.includes(userEmail);
}

/**
 * 获取超级管理员邮箱列表
 */
export function getSuperAdminEmails(): string[] {
  return process.env.SUPER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
}
```

- [ ] **Step 2: 验证类型正确**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交超级管理员工具函数**

```bash
git -C /root/my/code-link add packages/server/src/utils/super-admin.ts
git -C /root/my/code-link commit -m "feat(server): add super admin utility functions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: 更新数据库 Schema

**Files:**
- Modify: `packages/server/src/db/schema.ts`

- [ ] **Step 1: 添加 organizations 表定义**

在 `initSchema` 函数的 `CREATE TABLE IF NOT EXISTS users` 之后添加：

```typescript
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

- [ ] **Step 2: 添加 organization_members 表定义**

```typescript
    CREATE TABLE IF NOT EXISTS organization_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
```

- [ ] **Step 3: 添加 organization_invitations 表定义**

```typescript
    CREATE TABLE IF NOT EXISTS organization_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, email)
    );

    CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
```

- [ ] **Step 4: 验证 schema 语法**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 5: 提交 schema 更新**

```bash
git -C /root/my/code-link add packages/server/src/db/schema.ts
git -C /root/my/code-link commit -m "feat(server): add organizations schema tables

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: 创建数据库迁移工具

**Files:**
- Create: `packages/server/src/db/migration.ts`

- [ ] **Step 1: 创建迁移工具模块**

```typescript
// packages/server/src/db/migration.ts
import type Database from 'better-sqlite3';
import { createLogger } from '../logger/index.js';

const logger = createLogger('migration');

/**
 * 检查表是否存在
 */
function tableExists(db: Database.Database, tableName: string): boolean {
  const result = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);
  return !!result;
}

/**
 * 运行组织管理迁移
 * 创建新表（如果不存在）
 */
export function runOrganizationMigration(db: Database.Database): void {
  logger.info('Running organization migration...');

  // 检查 organizations 表是否已存在
  if (tableExists(db, 'organizations')) {
    logger.info('Organizations tables already exist, skipping migration');
    return;
  }

  // 创建 organizations 表
  db.exec(`
    CREATE TABLE organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  logger.info('Created organizations table');

  // 创建 organization_members 表
  db.exec(`
    CREATE TABLE organization_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, user_id)
    );

    CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
    CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
  `);
  logger.info('Created organization_members table');

  // 创建 organization_invitations 表
  db.exec(`
    CREATE TABLE organization_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, email)
    );

    CREATE INDEX idx_org_invitations_email ON organization_invitations(email);
    CREATE INDEX idx_org_invitations_status ON organization_invitations(status);
  `);
  logger.info('Created organization_invitations table');

  logger.info('Organization migration completed');
}
```

- [ ] **Step 2: 验证迁移工具类型正确**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交迁移工具**

```bash
git -C /root/my/code-link add packages/server/src/db/migration.ts
git -C /root/my/code-link commit -m "feat(server): add organization migration utility

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: 添加组织权限中间件

**Files:**
- Modify: `packages/server/src/middleware/auth.ts`

- [ ] **Step 1: 添加权限中间件导入和类型扩展**

在文件顶部导入后添加：

```typescript
import type Database from 'better-sqlite3';
import { isSuperAdmin } from '../utils/super-admin.js';
import type { OrgRole } from '../types.js';

// 角色层级定义
const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      orgRole?: OrgRole;
      projectRole?: OrgRole;
    }
  }
}
```

- [ ] **Step 2: 添加组织权限检查中间件工厂函数**

在 `authMiddleware` 函数之后添加：

```typescript
/**
 * 创建组织权限检查中间件
 * @param db 数据库实例
 * @param minRole 最低需要的角色
 */
export function createOrgMemberMiddleware(db: Database.Database, minRole: OrgRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).userId;
    const orgId = parseInt(req.params.orgId || req.params.id || req.body.organization_id, 10);

    if (!userId) {
      res.status(401).json({ error: '未认证' });
      return;
    }

    if (isNaN(orgId)) {
      res.status(400).json({ error: '无效的组织 ID' });
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
    
    if (user && isSuperAdmin(user.email)) {
      (req as any).orgRole = 'owner';
      next();
      return;
    }

    // 检查组织成员角色
    const membership = db.prepare(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
    ).get(orgId, userId) as { role: OrgRole } | undefined;

    if (!membership) {
      res.status(403).json({ error: '您不是该组织的成员' });
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    (req as any).orgRole = membership.role;
    next();
  };
}
```

- [ ] **Step 3: 添加项目权限检查中间件工厂函数**

```typescript
/**
 * 创建项目权限检查中间件
 * 通过项目关联的组织检查用户权限
 * @param db 数据库实例
 * @param minRole 最低需要的角色
 */
export function createProjectMemberMiddleware(db: Database.Database, minRole: OrgRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.id || req.params.projectId, 10);

    if (!userId) {
      res.status(401).json({ error: '未认证' });
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
    
    if (user && isSuperAdmin(user.email)) {
      (req as any).projectRole = 'owner';
      next();
      return;
    }

    // 获取项目所属组织
    const project = db.prepare('SELECT organization_id FROM projects WHERE id = ?').get(projectId) as { organization_id: number } | undefined;

    if (!project) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查组织成员角色
    const membership = db.prepare(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
    ).get(project.organization_id, userId) as { role: OrgRole } | undefined;

    if (!membership) {
      res.status(403).json({ error: '您不是该项目的成员' });
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    (req as any).projectRole = membership.role;
    next();
  };
}
```

- [ ] **Step 4: 添加检查用户是否有权创建组织的中间件**

```typescript
/**
 * 检查用户是否有权创建组织
 * 超级管理员或现有组织的 owner 可以创建
 */
export function createCanCreateOrgMiddleware(db: Database.Database) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: '未认证' });
      return;
    }

    // 获取用户邮箱检查是否为超级管理员
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
    
    if (user && isSuperAdmin(user.email)) {
      next();
      return;
    }

    // 检查用户是否是任何组织的 owner
    const ownership = db.prepare(
      "SELECT 1 FROM organization_members WHERE user_id = ? AND role = 'owner' LIMIT 1"
    ).get(userId);

    if (!ownership) {
      res.status(403).json({ error: '只有组织 owner 或超级管理员可以创建组织' });
      return;
    }

    next();
  };
}
```

- [ ] **Step 5: 验证中间件类型正确**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 6: 提交权限中间件**

```bash
git -C /root/my/code-link add packages/server/src/middleware/auth.ts
git -C /root/my/code-link commit -m "feat(server): add organization and project permission middleware

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: 在服务器启动时运行迁移

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 导入迁移函数**

在导入部分添加：

```typescript
import { runOrganizationMigration } from './db/migration.js';
```

- [ ] **Step 2: 在启动入口运行迁移**

在 `initSchema(db);` 之后添加：

```typescript
  // 运行组织迁移
  runOrganizationMigration(db);
```

- [ ] **Step 3: 验证服务器可以启动**

运行: `pnpm --filter @code-link/server exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 4: 提交服务器启动更新**

```bash
git -C /root/my/code-link add packages/server/src/index.ts
git -C /root/my/code-link commit -m "feat(server): run organization migration on startup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: 更新 .env.example 添加超级管理员配置说明

**Files:**
- Modify: `packages/server/.env.example`

- [ ] **Step 1: 添加超级管理员配置项**

在文件末尾添加：

```
# 超级管理员邮箱列表（逗号分隔）
# 超级管理员拥有所有组织的最高权限，可以创建新组织
SUPER_ADMIN_EMAILS=admin@example.com,admin2@example.com
```

- [ ] **Step 2: 提交环境变量更新**

```bash
git -C /root/my/code-link add packages/server/.env.example
git -C /root/my/code-link commit -m "docs(server): add SUPER_ADMIN_EMAILS to env example

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Summary

第一阶段完成后的成果：
1. 数据库新增 `organizations`、`organization_members`、`organization_invitations` 三张表
2. 超级管理员检查工具函数 `isSuperAdmin()`
3. 组织权限中间件 `createOrgMemberMiddleware()`
4. 项目权限中间件 `createProjectMemberMiddleware()`
5. 组织创建权限中间件 `createCanCreateOrgMiddleware()`
6. 数据迁移工具 `runOrganizationMigration()`

下一阶段将实现组织管理 API 路由。
