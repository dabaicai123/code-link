# API 统一响应格式实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后端所有 API 响应统一为 `{ code, data/error }` 格式，前端适配新格式。

**Architecture:** 创建后端响应工具函数 `utils/response.ts`，修改所有 routes 使用统一格式；前端修改 `api.ts` 解析新格式并自动提取 `data` 字段。

**Tech Stack:** TypeScript, Express, React/Next.js

---

## 文件结构

**新建文件：**
- `packages/server/src/utils/response.ts` - 响应工具函数

**修改文件（后端 routes）：**
- `packages/server/src/routes/auth.ts`
- `packages/server/src/routes/projects.ts`
- `packages/server/src/routes/containers.ts`
- `packages/server/src/routes/organizations.ts`
- `packages/server/src/routes/invitations.ts`
- `packages/server/src/routes/drafts.ts`
- `packages/server/src/routes/repos.ts`
- `packages/server/src/routes/builds.ts`
- `packages/server/src/routes/claude-config.ts`
- `packages/server/src/routes/github.ts`
- `packages/server/src/routes/gitlab.ts`
- `packages/server/src/routes/terminal.ts`
- `packages/server/src/index.ts`

**修改文件（前端）：**
- `packages/web/src/lib/api.ts`

---

### Task 1: 创建后端响应工具函数

**Files:**
- Create: `packages/server/src/utils/response.ts`

- [ ] **Step 1: 创建响应工具函数文件**

```typescript
// packages/server/src/utils/response.ts

/**
 * API 统一响应格式
 */

export interface ApiResponse<T> {
  code: 0;
  data: T;
}

export interface ApiErrorResponse {
  code: number;
  error: string;
}

/**
 * 成功响应
 */
export function success<T>(data: T): ApiResponse<T> {
  return { code: 0, data };
}

/**
 * 失败响应
 */
export function fail(code: number, error: string): ApiErrorResponse {
  return { code, error };
}

/**
 * 错误码常量
 */
export const ErrorCode = {
  // 系统错误 10000-19999
  INTERNAL_ERROR: 10001,

  // 参数错误 20000-29999
  PARAM_MISSING: 20001,
  PARAM_INVALID: 20002,

  // 认证/授权错误 30000-39999
  UNAUTHORIZED: 30001,
  FORBIDDEN: 30002,

  // 业务错误 40000-49999
  NOT_FOUND: 40001,
  CLAUDE_CONFIG_MISSING: 40002,
  CONFLICT: 40003,
  ALREADY_EXISTS: 40004,
} as const;

/**
 * 预定义错误工厂函数
 */
export const Errors = {
  // 系统错误
  internal: (msg?: string) => fail(ErrorCode.INTERNAL_ERROR, msg || '服务器内部错误'),

  // 参数错误
  paramMissing: (field: string) => fail(ErrorCode.PARAM_MISSING, `缺少参数: ${field}`),
  paramInvalid: (field: string, reason?: string) => fail(ErrorCode.PARAM_INVALID, reason || `参数格式错误: ${field}`),

  // 认证/授权错误
  unauthorized: () => fail(ErrorCode.UNAUTHORIZED, '请先登录'),
  forbidden: () => fail(ErrorCode.FORBIDDEN, '权限不足'),

  // 业务错误
  notFound: (resource: string) => fail(ErrorCode.NOT_FOUND, `${resource}不存在`),
  claudeConfigMissing: () => fail(ErrorCode.CLAUDE_CONFIG_MISSING, '请先在「设置 → Claude Code 配置」中完成配置'),
  conflict: (msg: string) => fail(ErrorCode.CONFLICT, msg),
  alreadyExists: (resource: string) => fail(ErrorCode.ALREADY_EXISTS, `${resource}已存在`),
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/utils/response.ts
git commit -m "feat(server): add unified API response utilities"
```

---

### Task 2: 修改前端 API 客户端适配新格式

**Files:**
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: 修改 ApiError 类和响应解析逻辑**

修改 `packages/web/src/lib/api.ts`，将现有的 `apiClient` 函数改为解析新格式：

```typescript
// 修改 ApiError 类
export class ApiError extends Error {
  status: number;
  code: number;

  constructor(status: number, code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// 修改 apiClient 函数中的响应处理部分
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, headers = {}, ...rest } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: requestHeaders,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  
  if (!response.ok) {
    let errorMessage = '请求失败';
    let errorCode = 10001;
    if (isJson) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorCode = errorData.code || errorCode;
      } catch {
        // ignore
      }
    }
    throw new ApiError(response.status, errorCode, errorMessage);
  }

  // 处理空响应
  if (!isJson) {
    return {} as T;
  }

  const result = await response.json();
  
  // 适配新格式：直接返回 data 字段
  // 兼容旧格式：如果 code 不存在，直接返回结果
  if (result.code === 0 && 'data' in result) {
    return result.data as T;
  }
  
  return result as T;
}
```

- [ ] **Step 2: 运行前端测试验证**

```bash
cd packages/web && npm test -- --run
```

预期：测试通过

- [ ] **Step 3: 提交**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat(web): adapt API client for unified response format"
```

---

### Task 3: 修改 auth.ts 路由

**Files:**
- Modify: `packages/server/src/routes/auth.ts`

- [ ] **Step 1: 导入响应工具函数并修改所有响应**

```typescript
import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, Errors } from '../utils/response.js';

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(success(result));
    } catch (error: any) {
      if (error.message === '该邮箱已被注册') {
        res.status(409).json(Errors.alreadyExists('该邮箱'));
      } else {
        res.status(400).json(Errors.paramInvalid('', error.message));
      }
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json(Errors.paramMissing('邮箱或密码'));
      return;
    }
    try {
      const result = await authService.login(req.body);
      res.json(success(result));
    } catch (error: any) {
      res.status(401).json(Errors.unauthorized());
    }
  });

  router.get('/me', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const user = await authService.getUser(userId);
      if (!user) {
        res.status(404).json(Errors.notFound('用户'));
        return;
      }
      res.json(success(user));
    } catch (error: any) {
      res.status(500).json(Errors.internal(error.message));
    }
  });

  return router;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/auth.ts
git commit -m "refactor(server): unify auth routes response format"
```

---

### Task 4: 修改 projects.ts 路由

**Files:**
- Modify: `packages/server/src/routes/projects.ts`

- [ ] **Step 1: 导入响应工具函数并修改所有响应**

```typescript
import { Router } from 'express';
import { ProjectService } from '../services/project.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { success, Errors } from '../utils/response.js';

const logger = createLogger('projects');

export function createProjectsRouter(): Router {
  const router = Router();
  const projectService = new ProjectService();

  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const project = await projectService.create(userId, req.body);
      res.status(201).json(success(project));
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('名称') || error.message.includes('模板')) {
        res.status(400).json(Errors.paramInvalid('', error.message));
      } else {
        logger.error('创建项目失败', error);
        res.status(500).json(Errors.internal('创建项目失败'));
      }
    }
  });

  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId as string, 10) : undefined;

    try {
      const projects = await projectService.findByUserId(userId, organizationId);
      res.json(success(projects));
    } catch (error: any) {
      logger.error('获取项目列表失败', error);
      res.status(500).json(Errors.internal('获取项目列表失败'));
    }
  });

  router.get('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    try {
      const project = await projectService.findById(userId, projectId);
      res.json(success(project));
    } catch (error: any) {
      if (error.message.includes('权限')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('不存在')) {
        res.status(404).json(Errors.notFound('项目'));
      } else {
        logger.error('获取项目详情失败', error);
        res.status(500).json(Errors.internal('获取项目详情失败'));
      }
    }
  });

  router.delete('/:id', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    try {
      await projectService.delete(userId, projectId);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('权限') || error.message.includes('owner')) {
        res.status(403).json(Errors.forbidden());
      } else if (error.message.includes('不存在')) {
        res.status(404).json(Errors.notFound('项目'));
      } else {
        logger.error('删除项目失败', error);
        res.status(500).json(Errors.internal('删除项目失败'));
      }
    }
  });

  return router;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/projects.ts
git commit -m "refactor(server): unify projects routes response format"
```

---

### Task 5: 修改 containers.ts 路由

**Files:**
- Modify: `packages/server/src/routes/containers.ts`

- [ ] **Step 1: 导入响应工具函数并修改所有响应**

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';
import { createProjectContainer, startContainer, stopContainer, removeContainer, getContainerStatus, getProjectContainer } from '../docker/container-manager.js';
import { createProjectVolume, removeProjectVolume } from '../docker/volume-manager.js';
import { ProjectRepository, ClaudeConfigRepository, OrganizationRepository } from '../repositories/index.js';
import { success, Errors } from '../utils/response.js';

const logger = createLogger('containers');

export function createContainersRouter(): Router {
  const router = Router();
  const projectRepo = new ProjectRepository();
  const claudeConfigRepo = new ClaudeConfigRepository();
  const orgRepo = new OrganizationRepository();

  router.post('/:id/container/start', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    try {
      const configRow = await claudeConfigRepo.findByUserId(userId);

      if (!configRow) {
        res.status(400).json(Errors.claudeConfigMissing());
        return;
      }

      let containerId = project.containerId;

      if (!containerId) {
        await createProjectVolume(projectId);
        containerId = await createProjectContainer(projectId, project.templateType, `/workspace/project-${projectId}`);
        await projectRepo.updateContainerId(projectId, containerId);
      }

      await startContainer(containerId);
      const status = await getContainerStatus(containerId);
      await projectRepo.updateStatus(projectId, 'running');

      res.json(success({ containerId, status }));
    } catch (error) {
      logger.error('启动容器失败', error);
      res.status(500).json(Errors.internal('启动容器失败'));
    }
  });

  router.post('/:id/container/stop', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    if (!project.containerId) {
      res.status(400).json(Errors.paramInvalid('', '项目没有关联的容器'));
      return;
    }

    try {
      const currentStatus = await getContainerStatus(project.containerId);
      if (currentStatus === 'running') {
        await stopContainer(project.containerId);
      }

      const status = await getContainerStatus(project.containerId);
      await projectRepo.updateStatus(projectId, 'stopped');

      res.json(success({ containerId: project.containerId, status }));
    } catch (error) {
      logger.error('停止容器失败', error);
      res.status(500).json(Errors.internal('停止容器失败'));
    }
  });

  router.get('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    if (!project.containerId) {
      res.status(404).json(Errors.notFound('容器'));
      return;
    }

    try {
      const status = await getContainerStatus(project.containerId);
      res.json(success({ containerId: project.containerId, status }));
    } catch (error) {
      logger.error('获取容器状态失败', error);
      res.status(500).json(Errors.internal('获取容器状态失败'));
    }
  });

  router.delete('/:id/container', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const idParam = req.params.id;
    const projectId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership || membership.role !== 'owner') {
      res.status(403).json(Errors.forbidden());
      return;
    }

    try {
      if (project.containerId) {
        await removeContainer(project.containerId);
      }
      await removeProjectVolume(projectId);
      await projectRepo.updateContainerId(projectId, null);
      await projectRepo.updateStatus(projectId, 'created');

      res.status(204).send();
    } catch (error) {
      logger.error('删除容器失败', error);
      res.status(500).json(Errors.internal('删除容器失败'));
    }
  });

  return router;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/containers.ts
git commit -m "refactor(server): unify containers routes response format"
```

---

### Task 6: 修改 organizations.ts 路由

**Files:**
- Modify: `packages/server/src/routes/organizations.ts`

- [ ] **Step 1: 导入响应工具函数并修改所有响应**

将所有 `res.json(...)` 改为 `res.json(success(...))`，将所有 `{ error: ... }` 改为使用 `Errors.xxx()`。

主要修改点：
- `res.status(201).json(org)` → `res.status(201).json(success(org))`
- `res.json(organizations)` → `res.json(success(organizations))`
- `res.status(403).json({ error: error.message })` → `res.status(403).json(Errors.forbidden())` 或其他合适错误
- `res.status(404).json({ error: error.message })` → `res.status(404).json(Errors.notFound('组织'))`

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/organizations.ts
git commit -m "refactor(server): unify organizations routes response format"
```

---

### Task 7: 修改 invitations.ts 路由

**Files:**
- Modify: `packages/server/src/routes/invitations.ts`

- [ ] **Step 1: 导入响应工具函数并修改所有响应**

类似 Task 6 的修改方式。

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/invitations.ts
git commit -m "refactor(server): unify invitations routes response format"
```

---

### Task 8: 修改 drafts.ts 路由

**Files:**
- Modify: `packages/server/src/routes/drafts.ts`

- [ ] **Step 1: 导入响应工具函数并修改所有响应**

注意：drafts.ts 中有些响应已经包裹了一层如 `{ draft }`，需要改为 `{ code: 0, data: { draft } }` 或直接 `{ code: 0, data: draft }`。

建议统一为：单个资源直接返回，如 `success(draft)` 而非 `success({ draft })`。

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/drafts.ts
git commit -m "refactor(server): unify drafts routes response format"
```

---

### Task 9: 修改剩余路由文件

**Files:**
- Modify: `packages/server/src/routes/repos.ts`
- Modify: `packages/server/src/routes/builds.ts`
- Modify: `packages/server/src/routes/claude-config.ts`
- Modify: `packages/server/src/routes/github.ts`
- Modify: `packages/server/src/routes/gitlab.ts`
- Modify: `packages/server/src/routes/terminal.ts`

- [ ] **Step 1: 依次修改每个文件**

每个文件执行类似的修改：
1. 添加 `import { success, Errors } from '../utils/response.js';`
2. 将成功响应改为 `res.json(success(data))`
3. 将错误响应改为 `res.status(code).json(Errors.xxx())`

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/repos.ts packages/server/src/routes/builds.ts packages/server/src/routes/claude-config.ts packages/server/src/routes/github.ts packages/server/src/routes/gitlab.ts packages/server/src/routes/terminal.ts
git commit -m "refactor(server): unify remaining routes response format"
```

---

### Task 10: 修改 index.ts 健康检查端点

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 修改健康检查和 404 响应**

```typescript
// 健康检查
app.get('/api/health', (req, res) => {
  res.json(success({ status: 'ok' }));
});

// 404 处理
app.use((req, res) => {
  res.status(404).json(Errors.notFound('接口'));
});
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/index.ts
git commit -m "refactor(server): unify index.ts response format"
```

---

### Task 11: 运行测试验证

- [ ] **Step 1: 运行后端测试**

```bash
cd packages/server && npm test
```

预期：所有测试通过

- [ ] **Step 2: 运行前端测试**

```bash
cd packages/web && npm test -- --run
```

预期：所有测试通过

- [ ] **Step 3: 手动测试关键接口**

```bash
# 测试登录
curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'

# 预期响应格式
# {"code":0,"data":{...}}
```

---

### Task 12: 最终提交

- [ ] **Step 1: 检查所有更改**

```bash
git status
```

- [ ] **Step 2: 推送到远程**

```bash
git push origin main
```
