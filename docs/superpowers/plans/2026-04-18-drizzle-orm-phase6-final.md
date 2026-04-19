# Drizzle ORM 数据库重构 - Phase 6: 最终清理和其他模块

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成剩余模块的重构，清理旧文件，更新入口文件，验证整个系统正常运行。

**Architecture:** 保持三层架构一致性，清理不再使用的旧文件，确保所有路由都使用 Drizzle ORM。

**Tech Stack:** Drizzle ORM, Express

---

## 前置条件

- Phase 1-5 已完成
- 所有主要模块已重构

---

### Task 1: 重构 Builds Routes

**Files:**
- Modify: `packages/server/src/routes/builds.ts`

Builds 路由目前主要使用 `project_members` 表进行权限检查，需要迁移到使用 ProjectService 或 OrganizationRepository。

- [ ] **Step 1: 重构 Builds Routes**

```typescript
// packages/server/src/routes/builds.ts
import { Router } from 'express';
import { ProjectService } from '../services/project.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { getBuildManager } from '../build/build-manager.js';
import { getPreviewContainerManager } from '../build/preview-container.js';

const logger = createLogger('builds');
const projectService = new ProjectService();

export function createBuildsRouter(): Router {
  const router = Router();

  // POST /api/builds - 创建构建
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const { projectId } = req.body;

    if (!projectId) {
      res.status(400).json({ error: '缺少 projectId' });
      return;
    }

    try {
      const isMember = await projectService.isProjectMember(projectId, userId);
      if (!isMember) {
        res.status(403).json({ error: '无权限访问此项目' });
        return;
      }

      const buildManager = getBuildManager(getNativeDb());
      const build = await buildManager.createBuild(projectId);

      buildManager.startBuild(projectId, build.id).catch((error) => {
        logger.error('Build failed', error);
      });

      res.status(201).json(build);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/builds/project/:projectId - 获取项目的构建列表
  router.get('/project/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const isMember = await projectService.isProjectMember(projectId, userId);
      if (!isMember) {
        res.status(403).json({ error: '无权限访问此项目' });
        return;
      }

      const buildManager = getBuildManager(getNativeDb());
      const builds = buildManager.getProjectBuilds(projectId);

      res.json(builds);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/builds/:id - 获取构建详情
  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const buildId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(buildId)) {
      res.status(400).json({ error: '无效的构建 ID' });
      return;
    }

    try {
      const buildManager = getBuildManager(getNativeDb());
      const build = buildManager.getBuild(buildId);

      if (!build) {
        res.status(404).json({ error: '构建不存在' });
        return;
      }

      const isMember = await projectService.isProjectMember(build.project_id, userId);
      if (!isMember) {
        res.status(403).json({ error: '无权限访问此构建' });
        return;
      }

      res.json(build);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/builds/preview/:projectId - 获取项目预览 URL
  router.get('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const isMember = await projectService.isProjectMember(projectId, userId);
      if (!isMember) {
        res.status(403).json({ error: '无权限访问此项目' });
        return;
      }

      const previewManager = getPreviewContainerManager();
      const containerInfo = previewManager.getContainerInfo(projectId.toString());

      if (!containerInfo) {
        res.status(404).json({ error: '预览容器未运行' });
        return;
      }

      res.json({
        url: previewManager.getPreviewUrl(containerInfo.port),
        port: containerInfo.port,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/builds/preview/:projectId - 停止预览容器
  router.delete('/preview/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    try {
      const isMember = await projectService.isProjectMember(projectId, userId);
      if (!isMember) {
        res.status(403).json({ error: '无权限访问此项目' });
        return;
      }

      const previewManager = getPreviewContainerManager();
      await previewManager.stopPreviewContainer(projectId.toString());

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

import { getNativeDb } from '../db/index.js';
```

---

### Task 2: 重构 Claude Config Routes

**Files:**
- Modify: `packages/server/src/routes/claude-config.ts`

- [ ] **Step 1: 重构 Claude Config Routes**

首先查看当前实现：

```typescript
// packages/server/src/routes/claude-config.ts - 重构版本
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { getDb } from '../db/index.js';
import { userClaudeConfigs } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

const logger = createLogger('claude-config');

export function createClaudeConfigRouter(): Router {
  const router = Router();

  router.use(authMiddleware);

  // GET /api/claude-config - 获取用户的 Claude 配置
  router.get('/', async (req, res) => {
    const userId = (req as any).userId;
    const db = getDb();

    try {
      const config = db.select()
        .from(userClaudeConfigs)
        .where(eq(userClaudeConfigs.userId, userId))
        .get();

      if (!config) {
        res.json({ config: null });
        return;
      }

      res.json({ config: config.config });
    } catch (error: any) {
      logger.error('获取 Claude 配置失败', error);
      res.status(500).json({ error: '获取 Claude 配置失败' });
    }
  });

  // PUT /api/claude-config - 更新用户的 Claude 配置
  router.put('/', async (req, res) => {
    const userId = (req as any).userId;
    const { config } = req.body;
    const db = getDb();

    if (!config || typeof config !== 'string') {
      res.status(400).json({ error: '缺少配置内容' });
      return;
    }

    try {
      // 使用 upsert
      const existing = db.select()
        .from(userClaudeConfigs)
        .where(eq(userClaudeConfigs.userId, userId))
        .get();

      if (existing) {
        db.update(userClaudeConfigs)
          .set({ config })
          .where(eq(userClaudeConfigs.userId, userId))
          .run();
      } else {
        db.insert(userClaudeConfigs)
          .values({ userId, config })
          .run();
      }

      res.json({ success: true });
    } catch (error: any) {
      logger.error('更新 Claude 配置失败', error);
      res.status(500).json({ error: '更新 Claude 配置失败' });
    }
  });

  return router;
}
```

---

### Task 3: 更新所有路由的 db 参数移除

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 最终更新入口文件**

确保所有路由不再传递 db 参数：

```typescript
// packages/server/src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { getSqliteDb, initSchema } from './db/index.js';
import {
  runOrganizationMigration,
  runProjectOrganizationMigration,
  runRepoClonedMigration,
} from './db/index.js';
import { createAuthRouter } from './routes/auth.js';
import { createProjectsRouter } from './routes/projects.js';
import { createContainersRouter } from './routes/containers.js';
import { createGitHubRouter } from './routes/github.js';
import { createGitLabRouter } from './routes/gitlab.js';
import { createReposRouter } from './routes/repos.js';
import { createBuildsRouter } from './routes/builds.js';
import { createClaudeConfigRouter } from './routes/claude-config.js';
import { createDraftsRouter } from './routes/drafts.js';
import { createOrganizationsRouter } from './routes/organizations.js';
import { createInvitationsRouter } from './routes/invitations.js';
import { createWebSocketServer } from './websocket/server.js';
import { requestLoggingMiddleware, createLogger } from './logger/index.js';
import { setEncryptionKey } from './crypto/aes.js';
import { initAIClient } from './ai/client.js';

const logger = createLogger('server');

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLoggingMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/projects', createProjectsRouter());
  app.use('/api/projects', createContainersRouter());
  app.use('/api/github', createGitHubRouter());
  app.use('/api/gitlab', createGitLabRouter());
  app.use('/api/projects/:projectId/repos', createReposRouter());
  app.use('/api/builds', createBuildsRouter());
  app.use('/api/claude-config', createClaudeConfigRouter());
  app.use('/api/organizations', createOrganizationsRouter());
  app.use('/api/invitations', createInvitationsRouter());
  app.use('/api/drafts', createDraftsRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

export function startServer(port: number = 3001): void {
  const app = createApp();
  const server = createServer(app);

  // 初始化 WebSocket 服务器
  createWebSocketServer(server, getSqliteDb());

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`WebSocket server ready on ws://localhost:${port}`);
  });
}

// 启动入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const db = getSqliteDb();
  initSchema(db);

  runOrganizationMigration(db);
  runProjectOrganizationMigration(db);
  runRepoClonedMigration(db);

  const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }
  setEncryptionKey(encryptionKey);

  initAIClient();

  startServer(process.env.PORT ? parseInt(process.env.PORT) : 4000);
}
```

---

### Task 4: 更新 GitHub 和 GitLab Routes

**Files:**
- Modify: `packages/server/src/routes/github.ts`
- Modify: `packages/server/src/routes/gitlab.ts`
- Modify: `packages/server/src/routes/containers.ts`

这些路由可能仍然使用 db 参数，需要检查并更新。

- [ ] **Step 1: 检查 GitHub Routes**

```bash
grep -n "db" packages/server/src/routes/github.ts | head -20
```

根据实际内容决定是否需要重构。如果使用了原生 SQL，则迁移到 Drizzle。

- [ ] **Step 2: 检查 GitLab Routes**

```bash
grep -n "db" packages/server/src/routes/gitlab.ts | head -20
```

- [ ] **Step 3: 检查 Containers Routes**

```bash
grep -n "db" packages/server/src/routes/containers.ts | head -20
```

---

### Task 5: 清理旧文件

**Files:**
- Delete: `packages/server/src/db/schema.ts` (旧的 Schema 定义)
- Delete: `packages/server/src/db/connection.ts` (旧的连接模块，已被 drizzle.ts 替代)
- Keep: `packages/server/src/db/migration.ts` (保留迁移函数)

- [ ] **Step 1: 删除旧的 schema.ts**

```bash
rm packages/server/src/db/schema.ts
```

- [ ] **Step 2: 删除旧的 connection.ts**

```bash
rm packages/server/src/db/connection.ts
```

- [ ] **Step 3: 更新导入引用**

确保所有文件使用新的导入路径：

```typescript
// 旧导入
import { getDb } from './db/connection.js';

// 新导入
import { getDb, getSqliteDb } from './db/index.js';
```

---

### Task 6: 验证整个系统

**Files:**
- Modify: 无需修改文件

- [ ] **Step 1: TypeScript 编译检查**

```bash
cd packages/server && npm run build
```

Expected: 编译成功，无错误

- [ ] **Step 2: 运行测试**

```bash
cd packages/server && npm test
```

Expected: 所有测试通过

- [ ] **Step 3: 启动服务器并测试 API**

```bash
cd packages/server && npm run dev
```

测试关键 API：
- POST /api/auth/register
- POST /api/auth/login
- GET /api/organizations
- GET /api/projects
- GET /api/drafts

Expected: 所有 API 正常响应

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(server): complete Drizzle ORM migration

- Remove old schema.ts and connection.ts
- Update all routes to use new db module
- Final cleanup and verification

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成标准

1. 所有路由已重构，不再传递 db 参数
2. 旧的 schema.ts 和 connection.ts 已删除
3. TypeScript 编译成功
4. 测试通过
5. 服务器正常运行
6. API 功能正常
7. 最终提交已创建

## 总结

至此，Drizzle ORM 数据库重构已完成。主要变更：

1. **基础设施**: Drizzle ORM 安装、Schema 定义、数据库初始化
2. **三层架构**: Repository（数据访问）、Service（业务逻辑）、Routes（HTTP 处理）
3. **类型安全**: 所有数据库操作都有 TypeScript 类型推断
4. **可维护性**: SQL 查询集中在 Repository 层，业务逻辑在 Service 层
5. **PostgreSQL 兼容**: Schema 设计兼容 PostgreSQL，后续切换成本低

后续可以：
- 使用 drizzle-kit 生成迁移文件
- 添加更多测试覆盖
- 优化查询性能
- 迁移到 PostgreSQL