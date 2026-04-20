# 架构迁移与旧代码清理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成后端架构迁移，将应用从旧路由切换到新的模块化架构，并删除所有废弃代码。

**Architecture:** 创建新的 app 入口文件集成所有 TSyringe 模块，创建 container 模块，扩展 project 模块，验证后删除旧代码。

**Tech Stack:** TypeScript, Express, TSyringe, Drizzle ORM, Zod

---

## File Structure

### 需要创建的文件
- `packages/server/src/modules/container/container.module.ts`
- `packages/server/src/modules/container/controller.ts`
- `packages/server/src/modules/container/service.ts`
- `packages/server/src/modules/container/repository.ts`
- `packages/server/src/modules/container/routes.ts`
- `packages/server/src/modules/container/schemas.ts`
- `packages/server/src/modules/container/types.ts`

### 需要修改的文件
- `packages/server/src/modules/project/routes.ts` - 添加仓库 API
- `packages/server/src/modules/project/controller.ts` - 添加仓库方法
- `packages/server/src/modules/project/service.ts` - 已有仓库方法
- `packages/server/src/index.ts` - 完全重写使用新模块

### 需要删除的文件
- `packages/server/src/routes/` 目录下所有文件
- `packages/server/src/services/` 目录下所有文件
- `packages/server/src/repositories/` 目录下所有文件

---

## Phase 1: 创建 Container 模块

### Task 1: 创建 Container 模块类型定义

**Files:**
- Create: `packages/server/src/modules/container/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
// packages/server/src/modules/container/types.ts
export interface ContainerStatus {
  containerId: string;
  status: string;
}

export interface ContainerStartResult {
  containerId: string;
  status: string;
}

export interface ContainerStopResult {
  containerId: string;
  status: string;
}
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/container/types.ts
git -C /root/my/code-link commit -m "feat(container): add container module types"
```

---

### Task 2: 创建 Container 模块 Schema

**Files:**
- Create: `packages/server/src/modules/container/schemas.ts`

- [ ] **Step 1: 创建 schemas.ts**

```typescript
// packages/server/src/modules/container/schemas.ts
import { z } from 'zod';

export const containerIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
});

export type ContainerIdParams = z.infer<typeof containerIdParamsSchema>;
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/container/schemas.ts
git -C /root/my/code-link commit -m "feat(container): add container module schemas"
```

---

### Task 3: 创建 Container Repository

**Files:**
- Create: `packages/server/src/modules/container/repository.ts`

- [ ] **Step 1: 创建 repository.ts**

Container Repository 复用 ProjectRepository 的方法（updateContainerId, updateStatus），不需要独立的 Repository。

```typescript
// packages/server/src/modules/container/repository.ts
// Container 模块复用 ProjectRepository，此文件仅作为模块导出占位
// 实际数据访问通过 ProjectRepository 完成
export { ProjectRepository } from '../project/repository.js';
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/container/repository.ts
git -C /root/my/code-link commit -m "feat(container): add container repository (reuses ProjectRepository)"
```

---

### Task 4: 创建 Container Service

**Files:**
- Create: `packages/server/src/modules/container/service.ts`

- [ ] **Step 1: 创建 service.ts**

```typescript
// packages/server/src/modules/container/service.ts
import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { ProjectRepository } from '../project/repository.js';
import { ClaudeConfigRepository } from '../claude-config/repository.js';
import { OrganizationRepository } from '../organization/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { ParamError, NotFoundError } from '../../core/errors/index.js';
import {
  createProjectContainer,
  startContainer,
  stopContainer,
  removeContainer,
  getContainerStatus,
} from '../../docker/container-manager.js';
import {
  createProjectVolume,
  removeProjectVolume,
} from '../../docker/volume-manager.js';
import type { ContainerStatus, ContainerStartResult, ContainerStopResult } from './types.js';

@singleton()
export class ContainerService {
  constructor(
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(ClaudeConfigRepository) private readonly claudeConfigRepo: ClaudeConfigRepository,
    @inject(OrganizationRepository) private readonly orgRepo: OrganizationRepository,
    @inject(PermissionService) private readonly permService: PermissionService
  ) {}

  async start(userId: number, projectId: number): Promise<ContainerStartResult> {
    // 检查项目访问权限
    const project = await this.permService.checkProjectAccess(userId, projectId);

    // 检查用户是否配置了 Claude Code
    const config = await this.claudeConfigRepo.findByUserId(userId);
    if (!config) {
      throw new ParamError('请先配置 Claude Code');
    }

    let containerId = project.containerId;

    // 如果容器不存在，创建容器
    if (!containerId) {
      // 创建持久化卷
      await createProjectVolume(projectId);

      // 创建容器
      containerId = await createProjectContainer(
        projectId,
        project.templateType as 'node' | 'node+java' | 'node+python',
        `/workspace/project-${projectId}`
      );

      // 更新项目的 container_id
      await this.projectRepo.updateContainerId(projectId, containerId);
    }

    // 启动容器
    await startContainer(containerId);

    // 获取容器状态
    const status = await getContainerStatus(containerId);

    // 更新项目状态
    await this.projectRepo.updateStatus(projectId, 'running');

    return { containerId, status };
  }

  async stop(userId: number, projectId: number): Promise<ContainerStopResult> {
    // 检查项目访问权限
    const project = await this.permService.checkProjectAccess(userId, projectId);

    if (!project.containerId) {
      throw new ParamError('项目没有关联的容器');
    }

    // 先检查容器状态，如果已经停止则跳过
    const currentStatus = await getContainerStatus(project.containerId);
    if (currentStatus === 'running') {
      await stopContainer(project.containerId);
    }

    // 获取容器状态
    const status = await getContainerStatus(project.containerId);

    // 更新项目状态
    await this.projectRepo.updateStatus(projectId, 'stopped');

    return { containerId: project.containerId, status };
  }

  async getStatus(userId: number, projectId: number): Promise<ContainerStatus> {
    // 检查项目访问权限
    const project = await this.permService.checkProjectAccess(userId, projectId);

    if (!project.containerId) {
      throw new NotFoundError('容器');
    }

    const status = await getContainerStatus(project.containerId);
    return { containerId: project.containerId, status };
  }

  async remove(userId: number, projectId: number): Promise<void> {
    // 检查项目访问权限，并验证是否是 owner
    const project = await this.permService.checkProjectAccess(userId, projectId);
    await this.permService.checkOrgOwner(userId, project.organizationId);

    // 删除容器
    if (project.containerId) {
      await removeContainer(project.containerId);
    }

    // 删除卷
    await removeProjectVolume(projectId);

    // 更新项目状态
    await this.projectRepo.updateContainerId(projectId, null);
    await this.projectRepo.updateStatus(projectId, 'created');
  }
}
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/container/service.ts
git -C /root/my/code-link commit -m "feat(container): add ContainerService"
```

---

### Task 5: 创建 Container Controller

**Files:**
- Create: `packages/server/src/modules/container/controller.ts`

- [ ] **Step 1: 创建 controller.ts**

```typescript
// packages/server/src/modules/container/controller.ts
import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { ContainerService } from './service.js';
import { success } from '../../core/errors/response.js';

@singleton()
export class ContainerController {
  constructor(
    @inject(ContainerService) private readonly service: ContainerService
  ) {}

  async start(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id);

    const result = await this.service.start(userId, projectId);
    res.json(success(result));
  }

  async stop(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id);

    const result = await this.service.stop(userId, projectId);
    res.json(success(result));
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id);

    const result = await this.service.getStatus(userId, projectId);
    res.json(success(result));
  }

  async remove(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id);

    await this.service.remove(userId, projectId);
    res.status(204).send();
  }
}
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/container/controller.ts
git -C /root/my/code-link commit -m "feat(container): add ContainerController"
```

---

### Task 6: 创建 Container Routes

**Files:**
- Create: `packages/server/src/modules/container/routes.ts`

- [ ] **Step 1: 创建 routes.ts**

```typescript
// packages/server/src/modules/container/routes.ts
import { Router } from 'express';
import { validateParams } from '../../middleware/validation.js';
import { containerIdParamsSchema } from './schemas.js';
import { ContainerController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createContainerRoutes(controller: ContainerController): Router {
  const router = Router();

  router.post(
    '/:id/container/start',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.start(req, res))
  );

  router.post(
    '/:id/container/stop',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.stop(req, res))
  );

  router.get(
    '/:id/container',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.getStatus(req, res))
  );

  router.delete(
    '/:id/container',
    authMiddleware,
    validateParams(containerIdParamsSchema),
    asyncHandler((req, res) => controller.remove(req, res))
  );

  return router;
}
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/container/routes.ts
git -C /root/my/code-link commit -m "feat(container): add container routes"
```

---

### Task 7: 创建 Container Module

**Files:**
- Create: `packages/server/src/modules/container/container.module.ts`

- [ ] **Step 1: 创建 container.module.ts**

```typescript
// packages/server/src/modules/container/container.module.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { ContainerService } from './service.js';
import { ContainerController } from './controller.js';

export function registerContainerModule(): void {
  container.registerSingleton(ContainerService);
  container.registerSingleton(ContainerController);
}

export { ContainerService } from './service.js';
export { ContainerController } from './controller.js';
export { createContainerRoutes } from './routes.js';
export { containerIdParamsSchema } from './schemas.js';
export type { ContainerStatus, ContainerStartResult, ContainerStopResult } from './types.js';
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/container/container.module.ts
git -C /root/my/code-link commit -m "feat(container): add container module registration"
```

---

## Phase 2: 扩展 Project 模块（添加仓库 API）

### Task 8: 添加仓库路由到 Project Routes

**Files:**
- Modify: `packages/server/src/modules/project/routes.ts`

- [ ] **Step 1: 更新 routes.ts 添加仓库 API**

在现有路由末尾添加仓库路由：

```typescript
// packages/server/src/modules/project/routes.ts
import { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.js';
import { createProjectSchema, projectIdParamsSchema, addRepoSchema, repoIdParamsSchema } from './schemas.js';
import { ProjectController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createProjectRoutes(controller: ProjectController): Router {
  const router = Router();

  // 项目 CRUD
  router.post(
    '/',
    authMiddleware,
    validateBody(createProjectSchema),
    asyncHandler((req, res) => controller.create(req, res))
  );

  router.get(
    '/',
    authMiddleware,
    asyncHandler((req, res) => controller.list(req, res))
  );

  router.get(
    '/:id',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.get(req, res))
  );

  router.delete(
    '/:id',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.delete(req, res))
  );

  // 仓库管理 API
  router.get(
    '/:id/repos',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    asyncHandler((req, res) => controller.listRepos(req, res))
  );

  router.post(
    '/:id/repos',
    authMiddleware,
    validateParams(projectIdParamsSchema),
    validateBody(addRepoSchema),
    asyncHandler((req, res) => controller.addRepo(req, res))
  );

  router.delete(
    '/:id/repos/:repoId',
    authMiddleware,
    validateParams(repoIdParamsSchema),
    asyncHandler((req, res) => controller.deleteRepo(req, res))
  );

  return router;
}
```

- [ ] **Step 2: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/project/routes.ts
git -C /root/my/code-link commit -m "feat(project): add repo routes to project module"
```

---

### Task 9: 添加仓库方法到 Project Controller

**Files:**
- Modify: `packages/server/src/modules/project/controller.ts`

- [ ] **Step 1: 读取现有 controller.ts**

```bash
cat packages/server/src/modules/project/controller.ts
```

- [ ] **Step 2: 添加仓库方法**

在 ProjectController 类中添加以下方法：

```typescript
// 在 class ProjectController 中添加

async listRepos(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const projectId = Number(req.params.id);

  const repos = await this.service.findRepos(projectId, userId);
  res.json(success(repos));
}

async addRepo(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const projectId = Number(req.params.id);
  const input = req.body; // AddRepoInput

  const repo = await this.service.addRepo(projectId, userId, input);
  res.status(201).json(success(repo));
}

async deleteRepo(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const projectId = Number(req.params.id);
  const repoId = Number(req.params.repoId);

  await this.service.deleteRepo(projectId, userId, repoId);
  res.status(204).send();
}
```

- [ ] **Step 3: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/modules/project/controller.ts
git -C /root/my/code-link commit -m "feat(project): add repo methods to ProjectController"
```

---

## Phase 3: 创建新的入口文件

### Task 10: 创建新的 index.ts

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 备份现有 index.ts**

```bash
cp packages/server/src/index.ts packages/server/src/index.ts.bak
```

- [ ] **Step 2: 重写 index.ts**

```typescript
// packages/server/src/index.ts
import "reflect-metadata";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { container } from 'tsyringe';

// 数据库初始化
import { getSqliteDb, initSchema, initDefaultAdmin } from './db/index.js';

// 模块注册
import { registerAuthModule, createAuthRoutes, AuthController } from './modules/auth/auth.module.js';
import { registerOrganizationModule, createOrganizationRoutes, OrganizationController } from './modules/organization/organization.module.js';
import { registerProjectModule, createProjectRoutes, ProjectController } from './modules/project/project.module.js';
import { registerDraftModule, createDraftRoutes, DraftController } from './modules/draft/draft.module.js';
import { registerBuildModule, createBuildRoutes, BuildController } from './modules/build/build.module.js';
import { registerGitProviderModule, createGitProviderRoutes, GitProviderController } from './modules/gitprovider/gitprovider.module.js';
import { registerClaudeConfigModule, createClaudeConfigRoutes, ClaudeConfigController } from './modules/claude-config/claude-config.module.js';
import { registerContainerModule, createContainerRoutes, ContainerController } from './modules/container/container.module.js';

// 核心服务
import { DatabaseConnection } from './core/database/connection.js';
import { LoggerService } from './core/logger/logger.js';
import { PermissionService } from './shared/permission.service.js';
import { createErrorHandler } from './core/errors/handler.js';

// WebSocket
import { createSocketServer } from './socket/index.js';

// 其他初始化
import { setEncryptionKey } from './crypto/aes.js';
import { initAIClient } from './ai/client.js';
import { success, Errors } from './utils/response.js';

const logger = new LoggerService();

export function createApp(): express.Express {
  const app = express();

  // 注册核心服务
  container.registerSingleton(DatabaseConnection);
  container.registerSingleton(LoggerService);
  container.registerSingleton(PermissionService);

  // 注册所有模块
  registerAuthModule();
  registerOrganizationModule();
  registerProjectModule();
  registerDraftModule();
  registerBuildModule();
  registerGitProviderModule();
  registerClaudeConfigModule();
  registerContainerModule();

  // 中间件
  app.use(cors());
  app.use(express.json());

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json(success({ status: 'ok' }));
  });

  // 获取 Controller 实例
  const authController = container.resolve(AuthController);
  const orgController = container.resolve(OrganizationController);
  const projectController = container.resolve(ProjectController);
  const draftController = container.resolve(DraftController);
  const buildController = container.resolve(BuildController);
  const gitProviderController = container.resolve(GitProviderController);
  const claudeConfigController = container.resolve(ClaudeConfigController);
  const containerController = container.resolve(ContainerController);

  // 注册路由
  app.use('/api/auth', createAuthRoutes(authController));
  app.use('/api/organizations', createOrganizationRoutes(orgController));
  app.use('/api/projects', createProjectRoutes(projectController));
  app.use('/api/projects', createContainerRoutes(containerController));
  app.use('/api/drafts', createDraftRoutes(draftController));
  app.use('/api/builds', createBuildRoutes(buildController));
  app.use('/api/gitprovider', createGitProviderRoutes(gitProviderController));
  app.use('/api/claude-config', createClaudeConfigRoutes(claudeConfigController));

  // 404 处理
  app.use((_req, res) => {
    res.status(404).json(Errors.notFound('接口'));
  });

  // 错误处理
  app.use(createErrorHandler(logger));

  return app;
}

export function startServer(port: number = 3001): void {
  const app = createApp();
  const server = createServer(app);

  // 初始化 Socket.IO 服务器
  createSocketServer(server);

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Socket.IO server ready on ws://localhost:${port}`);
  });
}

// 启动入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const db = getSqliteDb();
  initSchema(db);
  await initDefaultAdmin();

  // 设置加密密钥
  const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }
  setEncryptionKey(encryptionKey);

  // 初始化 AI 客户端
  initAIClient();

  startServer(process.env.PORT ? parseInt(process.env.PORT) : 4000);
}
```

- [ ] **Step 3: 提交更改**

```bash
git -C /root/my/code-link add packages/server/src/index.ts
git -C /root/my/code-link commit -m "refactor: migrate to new modular architecture"
```

---

## Phase 4: 验证

### Task 11: 编译验证

- [ ] **Step 1: 运行 TypeScript 编译**

```bash
cd /root/my/code-link/packages/server && npm run build
```

Expected: 编译成功，无类型错误

- [ ] **Step 2: 修复编译错误（如有）**

如果编译失败，根据错误信息修复类型定义或导入路径。

---

### Task 12: 功能验证

- [ ] **Step 1: 启动服务器**

```bash
cd /root/my/code-link/packages/server && npm run dev
```

Expected: 服务器启动成功，显示 "Server running on http://localhost:4000"

- [ ] **Step 2: 测试健康检查**

```bash
curl http://localhost:4000/api/health
```

Expected: `{"code":0,"data":{"status":"ok"},"message":"success"}`

---

## Phase 5: 清理旧代码

### Task 13: 删除旧路由目录

**Files:**
- Delete: `packages/server/src/routes/` 目录

- [ ] **Step 1: 确认 routes/ 目录中的文件**

```bash
ls -la packages/server/src/routes/
```

- [ ] **Step 2: 删除 routes/ 目录**

```bash
rm -rf packages/server/src/routes/
```

- [ ] **Step 3: 提交更改**

```bash
git -C /root/my/code-link add -A packages/server/src/routes/
git -C /root/my/code-link commit -m "refactor: remove old routes directory"
```

---

### Task 14: 删除旧服务目录

**Files:**
- Delete: `packages/server/src/services/` 目录

- [ ] **Step 1: 确认 services/ 目录中的文件**

```bash
ls -la packages/server/src/services/
```

- [ ] **Step 2: 删除 services/ 目录**

```bash
rm -rf packages/server/src/services/
```

- [ ] **Step 3: 提交更改**

```bash
git -C /root/my/code-link add -A packages/server/src/services/
git -C /root/my/code-link commit -m "refactor: remove old services directory"
```

---

### Task 15: 删除旧仓库目录

**Files:**
- Delete: `packages/server/src/repositories/` 目录

- [ ] **Step 1: 确认 repositories/ 目录中的文件**

```bash
ls -la packages/server/src/repositories/
```

- [ ] **Step 2: 删除 repositories/ 目录**

```bash
rm -rf packages/server/src/repositories/
```

- [ ] **Step 3: 提交更改**

```bash
git -C /root/my/code-link add -A packages/server/src/repositories/
git -C /root/my/code-link commit -m "refactor: remove old repositories directory"
```

---

### Task 16: 清理备份文件

**Files:**
- Delete: `packages/server/src/index.ts.bak`

- [ ] **Step 1: 删除备份文件**

```bash
rm -f packages/server/src/index.ts.bak
```

- [ ] **Step 2: 最终提交**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "refactor: complete architecture migration, remove backup files"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Container 模块创建 - Task 1-7
- [x] Project 模块扩展（仓库 API）- Task 8-9
- [x] 新入口文件创建 - Task 10
- [x] 编译验证 - Task 11
- [x] 功能验证 - Task 12
- [x] 删除旧路由 - Task 13
- [x] 删除旧服务 - Task 14
- [x] 删除旧仓库 - Task 15

**2. Placeholder scan:** 无 TBD/TODO

**3. Type consistency:** 已验证类型定义一致性

---

## 执行顺序

1. **Phase 1 (Task 1-7):** 创建 Container 模块
2. **Phase 2 (Task 8-9):** 扩展 Project 模块
3. **Phase 3 (Task 10):** 创建新入口文件
4. **Phase 4 (Task 11-12):** 验证
5. **Phase 5 (Task 13-16):** 清理旧代码
