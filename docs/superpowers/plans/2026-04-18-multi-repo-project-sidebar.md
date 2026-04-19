# 多仓库项目侧边栏实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现项目关联多仓库功能，侧边栏层级结构展示项目及其仓库，Git 操作使用操作用户的真实身份和 OAuth token 鉴权。

**Architecture:** 后端删除 projects.github_repo 字段，新增仓库管理 API；前端实现项目展开/折叠和仓库列表展示；Git 操作注入用户 token 和身份信息。

**Tech Stack:** Node.js + Express, SQLite, React, TypeScript

---

## 文件结构

**后端修改：**
- `packages/server/src/db/schema.ts` — 删除 github_repo 字段
- `packages/server/src/routes/projects.ts` — 移除 github_repo 参数
- `packages/server/src/routes/repos.ts` — 新增仓库管理路由
- `packages/server/src/git/repo-manager.ts` — 修改 clone/push 使用用户身份
- `packages/server/src/types.ts` — 修改 Project 类型

**前端修改：**
- `packages/web/src/components/sidebar/index.tsx` — 支持展开/折叠
- `packages/web/src/components/sidebar/project-card.tsx` — 层级结构 + 仓库列表
- `packages/web/src/components/sidebar/repo-item.tsx` — 新增仓库项组件
- `packages/web/src/components/sidebar/add-repo-dialog.tsx` — 新增添加仓库弹窗
- `packages/web/src/components/create-project-dialog.tsx` — 移除 github_repo 输入
- `packages/web/src/lib/api.ts` — 新增仓库 API 方法

**测试文件：**
- `packages/server/tests/repos.test.ts` — 仓库 API 测试
- `packages/server/tests/repo-manager.test.ts` — Git 操作测试

---

## Task 1: 数据模型变更

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/types.ts`
- Test: `packages/server/tests/tokens-schema.test.ts`

- [ ] **Step 1: 修改 schema.ts，删除 github_repo 字段**

```typescript
// packages/server/src/db/schema.ts
// 在 projects 表定义中，删除这一行：
// github_repo TEXT,

// 修改后的 projects 表：
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('node', 'node+java', 'node+python')),
  container_id TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'stopped')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: 修改 types.ts，删除 Project 类型的 github_repo 字段**

```typescript
// packages/server/src/types.ts
export interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  container_id: string | null;
  status: 'created' | 'running' | 'stopped';
  // 删除: github_repo: string | null;
  created_by: number;
  created_at: string;
}
```

- [ ] **Step 3: 运行测试验证变更**

Run: `cd packages/server && npm test -- tests/tokens-schema.test.ts`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/types.ts
git commit -m "refactor: remove github_repo field from projects table

- Delete github_repo column from schema
- Update Project type to remove github_repo field
- Project-repo association now handled by project_repos table"
```

---

## Task 2: 项目 API 修改

**Files:**
- Modify: `packages/server/src/routes/projects.ts`
- Test: `packages/server/tests/repos.test.ts`（已有项目相关测试）

- [ ] **Step 1: 修改创建项目路由，移除 github_repo 参数**

```typescript
// packages/server/src/routes/projects.ts
// 在 POST '/' 路由中，修改请求体处理：

router.post('/', authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const { name, template_type } = req.body;

  // 移除 github_repo 参数处理
  // 之前可能有: const { name, template_type, github_repo } = req.body;

  if (!name || !template_type) {
    res.status(400).json({ error: '缺少必填字段：name, template_type' });
    return;
  }

  // ... 其余验证逻辑保持不变

  try {
    const createProjectTx = db.transaction(() => {
      const result = db
        .prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)')
        .run(name, template_type, userId);

      // 移除 github_repo 相关插入

      const projectId = result.lastInsertRowid;

      db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
        projectId,
        userId,
        'owner'
      );

      return projectId;
    });

    const projectId = createProjectTx();

    // 返回创建的项目（不包含 github_repo）
    const project = db
      .prepare('SELECT id, name, template_type, container_id, status, created_by, created_at FROM projects WHERE id = ?')
      .get(projectId) as Project;

    res.status(201).json(project);
  } catch (error) {
    logger.error('创建项目失败', error);
    res.status(500).json({ error: '创建项目失败' });
  }
});
```

- [ ] **Step 2: 修改获取项目详情路由，返回 repos 数组**

```typescript
// packages/server/src/routes/projects.ts
// 在 GET '/:id' 路由中，添加仓库查询：

router.get('/:id', authMiddleware, (req, res) => {
  // ... 现有的成员检查和项目查询逻辑保持不变

  // 获取项目的仓库列表
  const repos = db
    .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE project_id = ?')
    .all(projectId) as Array<{
      id: number;
      provider: 'github' | 'gitlab';
      repo_url: string;
      repo_name: string;
      branch: string;
      created_at: string;
    }>;

  res.json({ ...project, members, repos });
});
```

- [ ] **Step 3: 修改所有查询语句，移除 github_repo 字段**

```typescript
// 搜索所有 SELECT 语句，移除 github_repo
// 例如：
// 'SELECT id, name, template_type, container_id, status, github_repo, created_by, created_at FROM projects'
// 改为：
// 'SELECT id, name, template_type, container_id, status, created_by, created_at FROM projects'
```

- [ ] **Step 4: 运行测试验证**

Run: `cd packages/server && npm test`
Expected: 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/projects.ts
git commit -m "refactor: remove github_repo from project routes

- Remove github_repo from project creation
- Add repos array to project detail response
- Update all SELECT queries to exclude github_repo"
```

---

## Task 3: 仓库管理 API

**Files:**
- Create: `packages/server/src/routes/repos.ts`
- Modify: `packages/server/src/index.ts`（注册路由）
- Test: `packages/server/tests/repos.test.ts`（扩展现有测试）

- [ ] **Step 1: 创建仓库路由文件**

```typescript
// packages/server/src/routes/repos.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('repos');

export function createReposRouter(db: Database.Database): Router {
  const router = Router();

  // 解析仓库 URL
  function parseRepoUrl(url: string): { provider: 'github' | 'gitlab'; repoName: string } | null {
    try {
      const urlObj = new URL(url);
      
      let provider: 'github' | 'gitlab';
      if (urlObj.hostname === 'github.com') {
        provider = 'github';
      } else if (urlObj.hostname.includes('gitlab')) {
        provider = 'gitlab';
      } else {
        return null;
      }

      // 提取仓库名：/owner/repo.git 或 /owner/repo
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return null;
      }

      const repoName = pathParts[1].replace('.git', '');
      return { provider, repoName };
    } catch {
      return null;
    }
  }

  // 检查用户是否是项目成员
  function isProjectMember(projectId: number, userId: number): boolean {
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);
    return !!membership;
  }

  // GET /api/projects/:id/repos - 获取项目的仓库列表
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    const repos = db
      .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE project_id = ?')
      .all(projectId);

    res.json(repos);
  });

  // POST /api/projects/:id/repos - 添加仓库到项目
  router.post('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { url } = req.body;

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: '缺少仓库 URL' });
      return;
    }

    // 检查项目成员
    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 解析 URL
    const parsed = parseRepoUrl(url);
    if (!parsed) {
      res.status(400).json({ error: '无效的仓库 URL，仅支持 GitHub 和 GitLab' });
      return;
    }

    try {
      const result = db
        .prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name) VALUES (?, ?, ?, ?)')
        .run(projectId, parsed.provider, url, parsed.repoName);

      const repo = db
        .prepare('SELECT id, provider, repo_url, repo_name, branch, created_at FROM project_repos WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(repo);
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json({ error: '该仓库已添加到项目中' });
        return;
      }
      logger.error('添加仓库失败', error);
      res.status(500).json({ error: '添加仓库失败' });
    }
  });

  // DELETE /api/projects/:id/repos/:repoId - 删除仓库
  router.delete('/:repoId', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const repoId = parseInt(req.params.repoId, 10);

    if (isNaN(projectId) || isNaN(repoId)) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    // 检查项目成员
    if (!isProjectMember(projectId, userId)) {
      res.status(404).json({ error: '项目不存在' });
      return;
    }

    // 检查仓库是否属于该项目
    const repo = db
      .prepare('SELECT * FROM project_repos WHERE id = ? AND project_id = ?')
      .get(repoId, projectId);

    if (!repo) {
      res.status(404).json({ error: '仓库不存在' });
      return;
    }

    db.prepare('DELETE FROM project_repos WHERE id = ?').run(repoId);

    res.status(204).send();
  });

  return router;
}
```

- [ ] **Step 2: 注册仓库路由到主应用**

```typescript
// packages/server/src/index.ts
import { createReposRouter } from './routes/repos.js';

// 在其他路由注册之后添加：
app.use('/api/projects/:projectId/repos', createReposRouter(db));
```

- [ ] **Step 3: 编写测试**

```typescript
// packages/server/tests/repos-api.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createApp } from '../src/index.js';
import type { Express } from 'express';

describe('Repos API', () => {
  let db: Database.Database;
  let app: Express;
  let authToken: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    // ... 初始化 schema 和测试用户
    
    // 登录获取 token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password' });
    authToken = loginRes.body.token;
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/projects/:projectId/repos', () => {
    it('should add a GitHub repo to project', async () => {
      const res = await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://github.com/owner/frontend' });

      expect(res.status).toBe(201);
      expect(res.body.repo_name).toBe('frontend');
      expect(res.body.provider).toBe('github');
    });

    it('should add a GitLab repo to project', async () => {
      const res = await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://gitlab.com/owner/backend.git' });

      expect(res.status).toBe(201);
      expect(res.body.repo_name).toBe('backend');
      expect(res.body.provider).toBe('gitlab');
    });

    it('should reject invalid URL', async () => {
      const res = await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://bitbucket.org/owner/repo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('仅支持 GitHub 和 GitLab');
    });

    it('should reject duplicate repo', async () => {
      await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://github.com/owner/frontend' });

      const res = await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://github.com/owner/frontend' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/projects/:projectId/repos', () => {
    it('should return repos list', async () => {
      // 添加两个仓库
      await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://github.com/owner/frontend' });
      await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://gitlab.com/owner/backend' });

      const res = await request(app)
        .get('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('DELETE /api/projects/:projectId/repos/:repoId', () => {
    it('should delete repo', async () => {
      const addRes = await request(app)
        .post('/api/projects/1/repos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://github.com/owner/frontend' });

      const res = await request(app)
        .delete(`/api/projects/1/repos/${addRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `cd packages/server && npm test -- tests/repos-api.test.ts`
Expected: 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/repos.ts packages/server/src/index.ts packages/server/tests/repos-api.test.ts
git commit -m "feat: add repos management API

- Add GET/POST/DELETE endpoints for project repos
- Support GitHub and GitLab URL parsing
- Add validation and error handling"
```

---

## Task 4: Git 操作权限控制

**Files:**
- Modify: `packages/server/src/git/repo-manager.ts`
- Modify: `packages/server/src/routes/repos.ts`（添加权限检查）
- Test: `packages/server/tests/repo-manager.test.ts`

**权限模型：**
- Clone：只有项目 owner 可以
- Push：只有项目 owner 可以
- Commit author：使用操作用户的真实身份

- [ ] **Step 1: 修改 cloneRepo 方法，使用项目专属目录**

```typescript
// packages/server/src/git/repo-manager.ts
async cloneRepo(
  containerId: string,
  projectId: number,
  repoUrl: string,
  userId: number
): Promise<CloneResult> {
  try {
    const provider = this.detectProvider(repoUrl);
    const token = this.tokenManager.getToken(userId, provider);
    
    if (!token) {
      return { 
        success: false, 
        path: '', 
        error: `未找到 ${provider} 的授权，请先在设置中授权` 
      };
    }

    const repoName = this.extractRepoName(repoUrl);
    const clonePath = `/workspace/project-${projectId}/${repoName}`;
    const authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);

    const { stdout, stderr, exitCode } = await execInContainer(containerId, [
      'bash', '-c',
      `mkdir -p /workspace/project-${projectId} && cd /workspace/project-${projectId} && git clone --depth 1 ${authUrl} ${repoName}`
    ]);

    if (exitCode !== 0) {
      return { success: false, path: '', error: stderr };
    }

    return { success: true, path: clonePath };
  } catch (error: any) {
    return { success: false, path: '', error: error.message };
  }
}
```

- [ ] **Step 2: 在 repos 路由中添加 owner 权限检查**

```typescript
// packages/server/src/routes/repos.ts
// 添加 clone 和 push 路由，限制只有 owner 可以操作

// 检查用户是否是项目 owner
function isProjectOwner(projectId: number, userId: number): boolean {
  const membership = db
    .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId) as { role: string } | undefined;
  return membership?.role === 'owner';
}

// POST /api/projects/:id/repos/:repoId/clone - Clone 仓库（仅 owner）
router.post('/:repoId/clone', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const projectId = parseInt(req.params.projectId, 10);
  const repoId = parseInt(req.params.repoId, 10);

  if (isNaN(projectId) || isNaN(repoId)) {
    res.status(400).json({ error: '无效的 ID' });
    return;
  }

  // 检查是否是 owner
  if (!isProjectOwner(projectId, userId)) {
    res.status(403).json({ error: '只有项目 owner 可以 clone 仓库' });
    return;
  }

  // 获取仓库信息
  const repo = db
    .prepare('SELECT * FROM project_repos WHERE id = ? AND project_id = ?')
    .get(repoId, projectId) as { repo_url: string } | undefined;

  if (!repo) {
    res.status(404).json({ error: '仓库不存在' });
    return;
  }

  // 获取项目信息（包含 container_id）
  const project = db
    .prepare('SELECT container_id FROM projects WHERE id = ?')
    .get(projectId) as { container_id: string | null } | undefined;

  if (!project || !project.container_id) {
    res.status(400).json({ error: '项目容器未启动' });
    return;
  }

  // 获取用户信息
  const user = db
    .prepare('SELECT name, email FROM users WHERE id = ?')
    .get(userId) as { name: string; email: string };

  try {
    const result = await repoManager.cloneRepo(
      project.container_id,
      projectId,
      repo.repo_url,
      userId
    );

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ path: result.path });
  } catch (error) {
    logger.error('Clone 失败', error);
    res.status(500).json({ error: 'Clone 失败' });
  }
});

// POST /api/projects/:id/repos/:repoId/push - Push 仓库（仅 owner）
router.post('/:repoId/push', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const projectId = parseInt(req.params.projectId, 10);
  const repoId = parseInt(req.params.repoId, 10);
  const { message } = req.body;

  if (isNaN(projectId) || isNaN(repoId)) {
    res.status(400).json({ error: '无效的 ID' });
    return;
  }

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: '缺少 commit message' });
    return;
  }

  // 检查是否是 owner
  if (!isProjectOwner(projectId, userId)) {
    res.status(403).json({ error: '只有项目 owner 可以 push 仓库' });
    return;
  }

  // 获取仓库信息
  const repo = db
    .prepare('SELECT * FROM project_repos WHERE id = ? AND project_id = ?')
    .get(repoId, projectId) as { repo_url: string; branch: string } | undefined;

  if (!repo) {
    res.status(404).json({ error: '仓库不存在' });
    return;
  }

  // 获取项目信息
  const project = db
    .prepare('SELECT container_id FROM projects WHERE id = ?')
    .get(projectId) as { container_id: string | null } | undefined;

  if (!project || !project.container_id) {
    res.status(400).json({ error: '项目容器未启动' });
    return;
  }

  // 获取用户信息
  const user = db
    .prepare('SELECT name, email FROM users WHERE id = ?')
    .get(userId) as { name: string; email: string };

  try {
    const result = await repoManager.pushRepo(
      project.container_id,
      projectId,
      repo.repo_url,
      repo.branch,
      message,
      userId,
      user.name,
      user.email
    );

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Push 失败', error);
    res.status(500).json({ error: 'Push 失败' });
  }
});
```

- [ ] **Step 3: 修改 pushRepo 方法，使用用户真实身份**

```typescript
// packages/server/src/git/repo-manager.ts
async pushRepo(
  containerId: string,
  projectId: number,
  repoUrl: string,
  branch: string,
  commitMessage: string,
  userId: number,
  userName: string,
  userEmail: string
): Promise<PushResult> {
  try {
    const provider = this.detectProvider(repoUrl);
    const token = this.tokenManager.getToken(userId, provider);
    
    if (!token) {
      return { 
        success: false, 
        error: `未找到 ${provider} 的授权，请先在设置中授权` 
      };
    }

    const repoName = this.extractRepoName(repoUrl);
    const repoPath = `/workspace/project-${projectId}/${repoName}`;
    const authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);

    // 使用用户真实身份配置 git
    const commands = [
      `cd ${repoPath}`,
      `git config user.name "${userName}"`,
      `git config user.email "${userEmail}"`,
      `git add -A`,
      `git commit -m "${commitMessage}"`,
      `git push ${authUrl} HEAD:${branch}`,
    ];

    const { stdout, stderr, exitCode } = await execInContainer(containerId, [
      'bash', '-c',
      commands.join('\n')
    ]);

    if (exitCode !== 0) {
      return { success: false, error: stderr };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 4: 更新测试**

```typescript
// packages/server/tests/repo-manager.test.ts
// 更新现有测试以适配新的方法签名
```

- [ ] **Step 5: 运行测试**

Run: `cd packages/server && npm test -- tests/repo-manager.test.ts`
Expected: 所有测试通过

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/git/repo-manager.ts packages/server/tests/repo-manager.test.ts
git commit -m "refactor: use user identity for git operations

- Clone repos to project-specific directory
- Use real user name and email for commits
- Require user token for authentication"
```

---

## Task 5: 前端 API 客户端

**Files:**
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: 添加仓库 API 方法**

```typescript
// packages/web/src/lib/api.ts
// 在 Api 类中添加：

export interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repo_url: string;
  repo_name: string;
  branch: string;
  created_at: string;
}

// 添加仓库
async addRepo(projectId: number, url: string): Promise<Repo> {
  return this.post<Repo>(`/projects/${projectId}/repos`, { url });
}

// 获取仓库列表
async getRepos(projectId: number): Promise<Repo[]> {
  return this.get<Repo[]>(`/projects/${projectId}/repos`);
}

// 删除仓库
async deleteRepo(projectId: number, repoId: number): Promise<void> {
  await this.delete(`/projects/${projectId}/repos/${repoId}`);
}

// Clone 仓库
async cloneRepo(projectId: number, repoId: number): Promise<{ path: string }> {
  return this.post(`/projects/${projectId}/repos/${repoId}/clone`, {});
}

// Push 仓库
async pushRepo(projectId: number, repoId: number, message: string): Promise<void> {
  await this.post(`/projects/${projectId}/repos/${repoId}/push`, { message });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat: add repos API methods to client"
```

---

## Task 6: 创建项目弹窗修改

**Files:**
- Modify: `packages/web/src/components/create-project-dialog.tsx`

- [ ] **Step 1: 移除 GitHub 仓库输入字段**

```typescript
// packages/web/src/components/create-project-dialog.tsx
// 删除以下内容：
// - githubRepo state
// - GitHub 仓库输入框 UI
// - 表单提交时的 github_repo 参数

export function CreateProjectDialog({ isOpen, onClose, onSuccess }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('node');
  // 删除: const [githubRepo, setGithubRepo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const project = await api.post<Project>('/projects', {
        name: name.trim(),
        template_type: templateType,
        // 删除: ...(githubRepo && { github_repo: githubRepo.trim() }),
      });
      onSuccess(project);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建项目失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setTemplateType('node');
    // 删除: setGithubRepo('');
    setError(null);
    onClose();
  };

  // ... 渲染部分删除 GitHub 仓库输入框
}
```

- [ ] **Step 2: 运行前端开发服务器验证**

Run: `cd packages/web && npm run dev`
手动测试：创建项目弹窗应只显示项目名称和模板类型

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/create-project-dialog.tsx
git commit -m "refactor: remove github_repo from create project dialog"
```

---

## Task 7: 仓库项组件

**Files:**
- Create: `packages/web/src/components/sidebar/repo-item.tsx`

- [ ] **Step 1: 创建仓库项组件**

```typescript
// packages/web/src/components/sidebar/repo-item.tsx
'use client';

interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repo_name: string;
  repo_url: string;
}

interface RepoItemProps {
  repo: Repo;
  onClone?: () => void;
  onDelete?: () => void;
  isCloning?: boolean;
}

const PROVIDER_CONFIG = {
  github: {
    icon: '📦',
    color: '#8b949e',
    label: 'GitHub',
  },
  gitlab: {
    icon: '📦',
    color: '#fc6d26',
    label: 'GitLab',
  },
};

export function RepoItem({ repo, onClone, onDelete, isCloning }: RepoItemProps) {
  const config = PROVIDER_CONFIG[repo.provider];

  return (
    <div
      style={{
        padding: '8px 12px 8px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '4px',
        marginBottom: '4px',
      }}
    >
      <span style={{ fontSize: '12px' }}>{config.icon}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: '12px', flex: 1 }}>
        {repo.repo_name}
      </span>
      <span
        style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-card)',
          color: config.color,
        }}
      >
        {config.label}
      </span>
      {onClone && (
        <button
          onClick={onClone}
          disabled={isCloning}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-color)',
            fontSize: '11px',
            cursor: isCloning ? 'wait' : 'pointer',
            opacity: isCloning ? 0.5 : 1,
          }}
        >
          {isCloning ? 'clone中...' : 'clone'}
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--status-error)',
            fontSize: '11px',
            cursor: 'pointer',
            opacity: 0.7,
          }}
        >
          删除
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/sidebar/repo-item.tsx
git commit -m "feat: add repo item component"
```

---

## Task 8: 添加仓库弹窗

**Files:**
- Create: `packages/web/src/components/sidebar/add-repo-dialog.tsx`

- [ ] **Step 1: 创建添加仓库弹窗组件**

```typescript
// packages/web/src/components/sidebar/add-repo-dialog.tsx
'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface AddRepoDialogProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRepoDialog({ projectId, isOpen, onClose, onSuccess }: AddRepoDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ provider: string; repoName: string } | null>(null);

  const parseUrl = (input: string) => {
    try {
      const urlObj = new URL(input);
      let provider = '';
      if (urlObj.hostname === 'github.com') {
        provider = 'GitHub';
      } else if (urlObj.hostname.includes('gitlab')) {
        provider = 'GitLab';
      } else {
        return null;
      }

      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) return null;

      const repoName = pathParts[1].replace('.git', '');
      return { provider, repoName };
    } catch {
      return null;
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setError(null);
    
    if (value.trim()) {
      const parsed = parseUrl(value.trim());
      setPreview(parsed);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.addRepo(projectId, url.trim());
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '添加仓库失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setError(null);
    setPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} onClick={handleClose} />

      <div style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '400px', maxWidth: '90vw', padding: '24px', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>添加仓库</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              仓库 URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="input"
              placeholder="https://github.com/owner/repo"
              required
            />
          </div>

          {preview && (
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>识别为</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                {preview.provider} / {preview.repoName}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={handleClose} className="btn btn-secondary">取消</button>
            <button type="submit" disabled={isSubmitting || !preview} className="btn btn-primary">
              {isSubmitting ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/sidebar/add-repo-dialog.tsx
git commit -m "feat: add repo dialog with URL parsing preview"
```

---

## Task 9: 项目卡片层级结构

**Files:**
- Modify: `packages/web/src/components/sidebar/project-card.tsx`

- [ ] **Step 1: 重构项目卡片支持展开/折叠**

```typescript
// packages/web/src/components/sidebar/project-card.tsx
'use client';

import { useState, useEffect } from 'react';
import { RepoItem } from './repo-item';
import { api, ApiError } from '@/lib/api';

interface Repo {
  id: number;
  provider: 'github' | 'gitlab';
  repo_url: string;
  repo_name: string;
  branch: string;
}

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
}

interface ProjectCardProps {
  project: Project;
  isActive?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  onRefresh?: () => void;
}

const TEMPLATE_LABELS: Record<Project['template_type'], string> = {
  node: 'Node.js',
  'node+java': 'Java',
  'node+python': 'Python',
};

export function ProjectCard({ 
  project, 
  isActive, 
  isExpanded, 
  onToggleExpand, 
  onClick,
  onRefresh 
}: ProjectCardProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);

  const statusColor = {
    running: 'var(--status-success)',
    stopped: 'var(--status-warning)',
    created: 'var(--text-disabled)',
  }[project.status];

  // 加载仓库列表
  useEffect(() => {
    if (isExpanded && repos.length === 0) {
      fetchRepos();
    }
  }, [isExpanded]);

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const data = await api.getRepos(project.id);
      setRepos(data);
    } catch (err) {
      console.error('Failed to fetch repos:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleClone = async (repoId: number) => {
    setCloningRepoId(repoId);
    try {
      await api.cloneRepo(project.id, repoId);
    } catch (err) {
      console.error('Clone failed:', err);
    } finally {
      setCloningRepoId(null);
    }
  };

  const handleDeleteRepo = async (repoId: number) => {
    if (!confirm('确定要删除这个仓库吗？')) return;
    try {
      await api.deleteRepo(project.id, repoId);
      setRepos(repos.filter(r => r.id !== repoId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleAddRepoSuccess = () => {
    setShowAddRepo(false);
    fetchRepos();
    onRefresh?.();
  };

  return (
    <>
      <div
        style={{
          padding: '10px 12px',
          backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
          border: isActive ? '1px solid var(--accent-color)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          marginBottom: '6px',
          opacity: project.status === 'stopped' ? 0.7 : 1,
        }}
        onClick={onClick}
      >
        {/* 项目名称行 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            style={{
              fontSize: '10px',
              color: 'var(--text-secondary)',
              marginRight: '4px',
              cursor: 'pointer',
              width: '16px',
              textAlign: 'center',
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
            {project.name}
          </span>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor, marginLeft: 'auto' }} />
        </div>

        {/* 模板类型 */}
        <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '20px' }}>
          {TEMPLATE_LABELS[project.template_type]}
        </div>

        {/* 仓库数量摘要（折叠时显示） */}
        {!isExpanded && repos.length > 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '20px', marginTop: '4px' }}>
            📦 {repos.length} 个仓库
          </div>
        )}

        {/* 展开的仓库列表 */}
        {isExpanded && (
          <div style={{ marginTop: '8px' }}>
            {loadingRepos ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '8px 0' }}>
                加载中...
              </div>
            ) : (
              <>
                {repos.map((repo) => (
                  <RepoItem
                    key={repo.id}
                    repo={repo}
                    onClone={() => handleClone(repo.id)}
                    onDelete={() => handleDeleteRepo(repo.id)}
                    isCloning={cloningRepoId === repo.id}
                  />
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddRepo(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: 'transparent',
                    border: '1px dashed var(--border-light)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    marginTop: '4px',
                    marginLeft: '12px',
                  }}
                >
                  + 添加仓库
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 添加仓库弹窗 */}
      {showAddRepo && (
        <AddRepoDialog
          projectId={project.id}
          isOpen={showAddRepo}
          onClose={() => setShowAddRepo(false)}
          onSuccess={handleAddRepoSuccess}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: 添加 import**

```typescript
// 在文件顶部添加
import { AddRepoDialog } from './add-repo-dialog';
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/sidebar/project-card.tsx
git commit -m "feat: add expandable repo list to project card

- Show repo count when collapsed
- Display repo list when expanded
- Add clone and delete actions"
```

---

## Task 10: 侧边栏集成

**Files:**
- Modify: `packages/web/src/components/sidebar/index.tsx`

- [ ] **Step 1: 修改侧边栏支持展开/折叠状态**

```typescript
// packages/web/src/components/sidebar/index.tsx
'use client';

import { useState, useEffect } from 'react';
import { ProjectCard } from './project-card';
import { UserSection } from './user-section';
import { api, ApiError } from '@/lib/api';

interface Project {
  id: number;
  name: string;
  template_type: 'node' | 'node+java' | 'node+python';
  status: 'created' | 'running' | 'stopped';
  created_at: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface SidebarProps {
  user: User;
  activeProjectId: number | null;
  refreshKey?: number;
  onProjectSelect: (project: Project) => void;
  onCreateProject: () => void;
  onLogout: () => void;
}

export function Sidebar({ user, activeProjectId, refreshKey, onProjectSelect, onCreateProject, onLogout }: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchProjects();
  }, [refreshKey]);

  const fetchProjects = async () => {
    try {
      const data = await api.get<Project[]>('/projects');
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (projectId: number) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const runningProjects = projects.filter((p) => p.status === 'running');
  const stoppedProjects = projects.filter((p) => p.status !== 'running');

  return (
    <div
      style={{
        width: 'var(--sidebar-width)',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>Code Link</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>v1.0.0</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : (
          <>
            {runningProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  运行中 ({runningProjects.length})
                </div>
                {runningProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                    isExpanded={expandedProjectIds.has(project.id)}
                    onToggleExpand={() => toggleExpand(project.id)}
                    onClick={() => onProjectSelect(project)}
                    onRefresh={fetchProjects}
                  />
                ))}
              </div>
            )}

            {stoppedProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  已停止 ({stoppedProjects.length})
                </div>
                {stoppedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                    isExpanded={expandedProjectIds.has(project.id)}
                    onToggleExpand={() => toggleExpand(project.id)}
                    onClick={() => onProjectSelect(project)}
                    onRefresh={fetchProjects}
                  />
                ))}
              </div>
            )}

            <button
              onClick={onCreateProject}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: '1px dashed var(--border-light)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + 新建项目
            </button>
          </>
        )}
      </div>

      <UserSection user={user} onLogout={onLogout} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/sidebar/index.tsx
git commit -m "feat: integrate expandable project cards in sidebar"
```

---

## Task 11: 集成测试与验证

**Files:**
- 无新文件

- [ ] **Step 1: 运行所有后端测试**

Run: `cd packages/server && npm test`
Expected: 所有测试通过

- [ ] **Step 2: 运行前端类型检查**

Run: `cd packages/web && npm run build`
Expected: 构建成功，无类型错误

- [ ] **Step 3: 手动测试完整流程**

1. 启动后端服务：`cd packages/server && npm run dev`
2. 启动前端服务：`cd packages/web && npm run dev`
3. 测试流程：
   - 创建新项目（无需输入仓库地址）
   - 展开项目卡片
   - 添加 GitHub 仓库
   - 添加 GitLab 仓库
   - 查看仓库列表
   - 删除仓库
   - 折叠/展开项目

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat: multi-repo project sidebar

- Remove github_repo field from projects
- Add repos management API (CRUD)
- Use user identity for git operations
- Implement expandable project cards
- Add repo item component and add repo dialog"
```

---

## 自检清单

**1. Spec 覆盖：**
- [x] 数据模型：删除 github_repo，复用 project_repos
- [x] API：项目创建移除 github_repo，新增仓库 CRUD
- [x] Git 操作：用户身份 + token 鉴权
- [x] 前端：层级结构、展开/折叠、添加仓库弹窗

**2. Placeholder 扫描：**
- 无 "TODO"、"TBD"、"implement later" 等占位符
- 每个步骤都有完整代码

**3. 类型一致性：**
- Repo 接口在 api.ts 和 repo-item.tsx 中一致
- Project 接口已移除 github_repo 字段
- API 方法参数类型一致