# Git/GitHub/GitLab 集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现与 GitHub 和 GitLab 的集成 — 创建项目时从远程仓库导入代码、编码完成后推送代码回仓库、管理仓库关联关系。

**Architecture:** 使用 GitHub REST API 和 GitLab REST API 进行仓库操作。在容器内通过 git 命令进行 clone/push。OAuth2 认证流程获取用户 access token，安全存储在数据库中。支持同时关联多个仓库（GitHub + GitLab）。

**Tech Stack:** GitHub REST API, GitLab REST API, OAuth2, git CLI (容器内)

---

## 文件结构

```
packages/server/
├── src/
│   ├── git/
│   │   ├── github-client.ts       # GitHub API 客户端
│   │   ├── gitlab-client.ts       # GitLab API 客户端
│   │   ├── oauth.ts               # OAuth 认证处理
│   │   ├── repo-manager.ts        # 仓库管理（clone/push）
│   │   └── token-manager.ts       # Access token 管理
│   ├── routes/
│   │   ├── github.ts              # GitHub OAuth 和仓库 API
│   │   └── gitlab.ts              # GitLab OAuth 和仓库 API
│   │   └── repos.ts               # 仓库关联管理 API
│   ├── db/
│   │   └── schema.ts              # 添加 tokens 表
│   ├── types.ts                   # 更新类型定义
│   └── index.ts                   # 挂载路由
├── tests/
│   ├── github-client.test.ts
│   ├── gitlab-client.test.ts
│   ├── oauth.test.ts
│   └── repos.test.ts

packages/web/
├── src/
│   ├── app/
│   │   ├── oauth/
│   │   │   ├── github/
│   │   │   │   └── callback/
│   │   │   │   │   └: page.tsx    # GitHub OAuth 回调
│   │   │   ├── gitlab/
│   │   │   │   └: callback/
│   │   │   │   │   └: page.tsx    # GitLab OAuth 回调
│   │   └── projects/
│   │   │   └: [id]/
│   │   │   │   └: import/
│   │   │   │   │   └: page.tsx    # 导入仓库页面
│   │   │   │   └: push/
│   │   │   │   │   └: page.tsx    # 推送代码页面
│   ├── components/
│   │   └: repo-import-dialog.tsx  # 导入仓库弹窗
│   │   └ repo-list.tsx            # 已关联仓库列表
```

---

### Task 1: 数据库 Schema 更新 - 添加 tokens 表

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/types.ts`
- Create: `packages/server/tests/tokens-schema.test.ts`

- [ ] **Step 1: 写 tokens 表测试**

```typescript
// tests/tokens-schema.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.ts';

describe('Tokens Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
  });

  it('should have tokens table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    expect(tables.some(t => t.name === 'tokens')).toBe(true);
  });

  it('should insert and retrieve token', () => {
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');

    db.prepare('INSERT INTO tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z'
    );

    const token = db.prepare('SELECT * FROM tokens WHERE user_id = ? AND provider = ?').get(1, 'github') as any;
    expect(token.access_token).toBe('gh_token');
    expect(token.provider).toBe('github');
  });
});
```

- [ ] **Step 2: 更新 schema.ts**

```typescript
// src/db/schema.ts - 在 initSchema 函数中添加
export function initSchema(db: Database.Database): void {
  db.exec(`
    // ... 现有表定义 ...

    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS project_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
      repo_url TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, repo_url)
    );
  `);
}
```

- [ ] **Step 3: 更新 types.ts**

```typescript
// src/types.ts - 添加以下类型定义
export interface Token {
  id: number;
  user_id: number;
  provider: 'github' | 'gitlab';
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ProjectRepo {
  id: number;
  project_id: number;
  provider: 'github' | 'gitlab';
  repo_url: string;
  repo_name: string;
  branch: string;
  created_at: string;
}
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && pnpm test tests/tokens-schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/types.ts packages/server/tests/tokens-schema.test.ts
git commit -m "feat: add tokens and project_repos tables for Git integration"
```

---

### Task 2: GitHub API 客户端

**Files:**
- Create: `packages/server/src/git/github-client.ts`
- Create: `packages/server/tests/github-client.test.ts`

- [ ] **Step 1: 写 GitHub 客户端测试**

```typescript
// tests/github-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GitHubClient } from '../src/git/github-client.ts';

describe('GitHubClient', () => {
  it('should create client with access token', () => {
    const client = new GitHubClient('test_token');
    expect(client).toBeDefined();
  });

  it('should get user repositories', async () => {
    const client = new GitHubClient('test_token');

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'test-repo', full_name: 'user/test-repo', html_url: 'https://github.com/user/test-repo' }
      ]),
    });

    const repos = await client.getUserRepos();
    expect(repos.length).toBeGreaterThan(0);
    expect(repos[0].name).toBe('test-repo');
  });

  it('should get repository info', async () => {
    const client = new GitHubClient('test_token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        default_branch: 'main',
      }),
    });

    const repo = await client.getRepo('user', 'test-repo');
    expect(repo.name).toBe('test-repo');
    expect(repo.default_branch).toBe('main');
  });

  it('should throw error on API failure', async () => {
    const client = new GitHubClient('test_token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    try {
      await client.getRepo('user', 'nonexistent');
      expect.fail('Should throw error');
    } catch (error: any) {
      expect(error.message).toContain('404');
    }
  });
});
```

- [ ] **Step 2: 实现 GitHub 客户端**

```typescript
// src/git/github-client.ts
const GITHUB_API_BASE = 'https://api.github.com';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
}

export class GitHubClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(path: string): Promise<any> {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CodeLink-App',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUserRepos(): Promise<GitHubRepo[]> {
    return this.request('/user/repos?per_page=100');
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request(`/repos/${owner}/${repo}`);
  }

  async getRepoBranches(owner: string, repo: string): Promise<{ name: string }[]> {
    return this.request(`/repos/${owner}/${repo}/branches`);
  }

  async createWebhook(owner: string, repo: string, webhookUrl: string): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CodeLink-App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push', 'pull_request'],
        config: {
          url: webhookUrl,
          content_type: 'json',
        },
      }),
    });
  }
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/github-client.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/git/github-client.ts packages/server/tests/github-client.test.ts
git commit -m "feat: add GitHub API client"
```

---

### Task 3: GitLab API 客户端

**Files:**
- Create: `packages/server/src/git/gitlab-client.ts`
- Create: `packages/server/tests/gitlab-client.test.ts`

- [ ] **Step 1: 写 GitLab 客户端测试**

```typescript
// tests/gitlab-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GitLabClient } from '../src/git/gitlab-client.ts';

describe('GitLabClient', () => {
  it('should create client with access token', () => {
    const client = new GitLabClient('https://gitlab.com', 'test_token');
    expect(client).toBeDefined();
  });

  it('should get user projects', async () => {
    const client = new GitLabClient('https://gitlab.com', 'test_token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'test-project', path_with_namespace: 'user/test-project', web_url: 'https://gitlab.com/user/test-project' }
      ]),
    });

    const projects = await client.getUserProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0].name).toBe('test-project');
  });

  it('should get project info', async () => {
    const client = new GitLabClient('https://gitlab.com', 'test_token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'test-project',
        path_with_namespace: 'user/test-project',
        web_url: 'https://gitlab.com/user/test-project',
        default_branch: 'main',
      }),
    });

    const project = await client.getProject(1);
    expect(project.name).toBe('test-project');
    expect(project.default_branch).toBe('main');
  });
});
```

- [ ] **Step 2: 实现 GitLab 客户端**

```typescript
// src/git/gitlab-client.ts
interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  http_url_to_repo: string;
  default_branch: string;
}

export class GitLabClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl: string = 'https://gitlab.com', accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  private async request(path: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v4${path}`, {
      headers: {
        'PRIVATE-TOKEN': this.accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUserProjects(): Promise<GitLabProject[]> {
    return this.request('/projects?membership=true&per_page=100');
  }

  async getProject(projectId: number): Promise<GitLabProject> {
    return this.request(`/projects/${projectId}`);
  }

  async getProjectBranches(projectId: number): Promise<{ name: string }[]> {
    return this.request(`/projects/${projectId}/repository/branches`);
  }

  async getProjectByPath(path: string): Promise<GitLabProject> {
    const encodedPath = encodeURIComponent(path);
    return this.request(`/projects/${encodedPath}`);
  }
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/gitlab-client.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/git/gitlab-client.ts packages/server/tests/gitlab-client.test.ts
git commit -m "feat: add GitLab API client"
```

---

### Task 4: OAuth 认证处理

**Files:**
- Create: `packages/server/src/git/oauth.ts`
- Create: `packages/server/tests/oauth.test.ts`

- [ ] **Step 1: 写 OAuth 测试**

```typescript
// tests/oauth.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  getGitHubOAuthUrl,
  getGitLabOAuthUrl,
  exchangeGitHubCode,
  exchangeGitLabCode,
} from '../src/git/oauth.ts';

describe('OAuth', () => {
  const config = {
    githubClientId: 'gh_client_id',
    githubClientSecret: 'gh_client_secret',
    gitlabClientId: 'gl_client_id',
    gitlabClientSecret: 'gl_client_secret',
    gitlabBaseUrl: 'https://gitlab.com',
    redirectUri: 'http://localhost:3001/oauth/callback',
  };

  it('should generate GitHub OAuth URL', () => {
    const url = getGitHubOAuthUrl(config);
    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=gh_client_id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('scope=repo');
  });

  it('should generate GitLab OAuth URL', () => {
    const url = getGitLabOAuthUrl(config);
    expect(url).toContain('https://gitlab.com/oauth/authorize');
    expect(url).toContain('client_id=gl_client_id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('scope=api');
  });

  it('should exchange GitHub code for token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'gh_access_token',
        refresh_token: 'gh_refresh_token',
        expires_in: 3600,
      }),
    });

    const result = await exchangeGitHubCode(config, 'test_code');
    expect(result.access_token).toBe('gh_access_token');
  });

  it('should exchange GitLab code for token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'gl_access_token',
        refresh_token: 'gl_refresh_token',
        expires_in: 3600,
      }),
    });

    const result = await exchangeGitLabCode(config, 'test_code');
    expect(result.access_token).toBe('gl_access_token');
  });
});
```

- [ ] **Step 2: 实现 OAuth 处理**

```typescript
// src/git/oauth.ts
interface OAuthConfig {
  githubClientId: string;
  githubClientSecret: string;
  gitlabClientId: string;
  gitlabClientSecret: string;
  gitlabBaseUrl: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export function getGitHubOAuthUrl(config: OAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: `${config.redirectUri}/github`,
    scope: 'repo',
    state: Math.random().toString(36).substring(7),
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export function getGitLabOAuthUrl(config: OAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.gitlabClientId,
    redirect_uri: `${config.redirectUri}/gitlab`,
    response_type: 'code',
    scope: 'api',
    state: Math.random().toString(36).substring(7),
  });

  return `${config.gitlabBaseUrl}/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode(
  config: OAuthConfig,
  code: string
): Promise<TokenResponse> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: `${config.redirectUri}/github`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange GitHub code');
  }

  return response.json();
}

export async function exchangeGitLabCode(
  config: OAuthConfig,
  code: string
): Promise<TokenResponse> {
  const response = await fetch(`${config.gitlabBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.gitlabClientId,
      client_secret: config.gitlabClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${config.redirectUri}/gitlab`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange GitLab code');
  }

  return response.json();
}

// 从环境变量获取配置
export function getOAuthConfig(): OAuthConfig {
  return {
    githubClientId: process.env.GITHUB_CLIENT_ID || '',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    gitlabClientId: process.env.GITLAB_CLIENT_ID || '',
    gitlabClientSecret: process.env.GITLAB_CLIENT_SECRET || '',
    gitlabBaseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3001/oauth/callback',
  };
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/oauth.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/git/oauth.ts packages/server/tests/oauth.test.ts
git commit -m "feat: add OAuth authentication for GitHub and GitLab"
```

---

### Task 5: Token 管理

**Files:**
- Create: `packages/server/src/git/token-manager.ts`
- Create: `packages/server/tests/token-manager.test.ts`

- [ ] **Step 1: 写 Token 管理测试**

```typescript
// tests/token-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.ts';
import { TokenManager } from '../src/git/token-manager.ts';

describe('TokenManager', () => {
  let db: Database.Database;
  let manager: TokenManager;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    manager = new TokenManager(db);
  });

  it('should save token', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');

    const token = manager.getToken(1, 'github');
    expect(token?.access_token).toBe('gh_token');
  });

  it('should update existing token', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');
    manager.saveToken(1, 'github', 'new_gh_token', 'new_gh_refresh', '2025-02-01T00:00:00Z');

    const token = manager.getToken(1, 'github');
    expect(token?.access_token).toBe('new_gh_token');
  });

  it('should delete token', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');
    manager.deleteToken(1, 'github');

    const token = manager.getToken(1, 'github');
    expect(token).toBeNull();
  });

  it('should check if token exists', () => {
    manager.saveToken(1, 'github', 'gh_token', 'gh_refresh', '2025-01-01T00:00:00Z');

    expect(manager.hasToken(1, 'github')).toBe(true);
    expect(manager.hasToken(1, 'gitlab')).toBe(false);
  });
});
```

- [ ] **Step 2: 实现 Token 管理器**

```typescript
// src/git/token-manager.ts
import type Database from 'better-sqlite3';
import type { Token } from '../types.ts';

export class TokenManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  saveToken(
    userId: number,
    provider: 'github' | 'gitlab',
    accessToken: string,
    refreshToken?: string,
    expiresAt?: string
  ): void {
    const existing = this.db
      .prepare('SELECT id FROM tokens WHERE user_id = ? AND provider = ?')
      .get(userId, provider);

    if (existing) {
      this.db
        .prepare('UPDATE tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND provider = ?')
        .run(accessToken, refreshToken || null, expiresAt || null, userId, provider);
    } else {
      this.db
        .prepare('INSERT INTO tokens (user_id, provider, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)')
        .run(userId, provider, accessToken, refreshToken || null, expiresAt || null);
    }
  }

  getToken(userId: number, provider: 'github' | 'gitlab'): Token | null {
    return this.db
      .prepare('SELECT * FROM tokens WHERE user_id = ? AND provider = ?')
      .get(userId, provider) as Token | null;
  }

  deleteToken(userId: number, provider: 'github' | 'gitlab'): void {
    this.db
      .prepare('DELETE FROM tokens WHERE user_id = ? AND provider = ?')
      .run(userId, provider);
  }

  hasToken(userId: number, provider: 'github' | 'gitlab'): boolean {
    return this.getToken(userId, provider) !== null;
  }

  // 检查 token 是否过期
  isTokenExpired(token: Token): boolean {
    if (!token.expires_at) return false;

    const expiresAt = new Date(token.expires_at);
    const now = new Date();

    // 提前 5 分钟视为过期
    return now.getTime() >= expiresAt.getTime() - 5 * 60 * 1000;
  }
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/token-manager.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/git/token-manager.ts packages/server/tests/token-manager.test.ts
git commit -m "feat: add token manager for storing OAuth tokens"
```

---

### Task 6: 仓库管理（Clone/Push）

**Files:**
- Create: `packages/server/src/git/repo-manager.ts`
- Create: `packages/server/tests/repo-manager.test.ts`

- [ ] **Step 1: 写仓库管理测试**

```typescript
// tests/repo-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.ts';
import { RepoManager } from '../src/git/repo-manager.ts';
import { execInContainer } from '../src/docker/container-manager.ts';
import { createProjectContainer, startContainer, removeContainer } from '../src/docker/container-manager.ts';
import { createProjectVolume } from '../src/docker/volume-manager.ts';

describe('RepoManager', () => {
  let db: Database.Database;
  let manager: RepoManager;
  let testContainerId: string;
  let testVolumePath: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    initSchema(db);
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    manager = new RepoManager(db);

    // 创建测试容器
    testVolumePath = await createProjectVolume(9999);
    testContainerId = await createProjectContainer(9999, 'node', testVolumePath);
    await startContainer(testContainerId);
  });

  afterEach(async () => {
    await removeContainer(testContainerId);
  });

  it('should clone repository into container', async () => {
    // 模拟 token
    manager.saveToken(1, 'github', 'test_token');

    const result = await manager.cloneRepo(testContainerId, 'https://github.com/octocat/Hello-World.git', 'main');

    expect(result.success).toBe(true);
    expect(result.path).toContain('Hello-World');
  });

  it('should add repo association to project', () => {
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run('test-project', 'node', 1);

    manager.addRepoAssociation(1, 'github', 'https://github.com/user/test-repo', 'test-repo', 'main');

    const repos = manager.getProjectRepos(1);
    expect(repos.length).toBe(1);
    expect(repos[0].repo_name).toBe('test-repo');
  });

  it('should push changes to repository', async () => {
    // 模拟场景：clone 后修改，然后 push
    manager.saveToken(1, 'github', 'test_token');

    await manager.cloneRepo(testContainerId, 'https://github.com/test/test-repo.git', 'main');

    // 在容器内创建文件
    await execInContainer(testContainerId, ['bash', '-c', 'cd test-repo && echo "test" > test.txt']);

    // Push
    const result = await manager.pushRepo(testContainerId, 'https://github.com/test/test-repo.git', 'main', 'test commit');

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: 实现仓库管理器**

```typescript
// src/git/repo-manager.ts
import type Database from 'better-sqlite3';
import { execInContainer } from '../docker/container-manager.ts';
import { TokenManager } from './token-manager.ts';
import type { ProjectRepo } from '../types.ts';

interface CloneResult {
  success: boolean;
  path: string;
  error?: string;
}

interface PushResult {
  success: boolean;
  error?: string;
}

export class RepoManager {
  private db: Database.Database;
  private tokenManager: TokenManager;

  constructor(db: Database.Database) {
    this.db = db;
    this.tokenManager = new TokenManager(db);
  }

  async cloneRepo(
    containerId: string,
    repoUrl: string,
    branch: string,
    userId?: number
  ): Promise<CloneResult> {
    try {
      // 获取 token（如果提供了 userId）
      let authUrl = repoUrl;
      if (userId) {
        const token = this.tokenManager.getToken(userId, this.detectProvider(repoUrl));
        if (token) {
          authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);
        }
      }

      // 在容器内执行 git clone
      const repoName = this.extractRepoName(repoUrl);
      const { stdout, stderr, exitCode } = await execInContainer(containerId, [
        'bash', '-c',
        `cd /workspace && git clone --branch ${branch} --depth 1 ${authUrl} ${repoName}`
      ]);

      if (exitCode !== 0) {
        return { success: false, path: '', error: stderr };
      }

      return { success: true, path: `/workspace/${repoName}` };
    } catch (error: any) {
      return { success: false, path: '', error: error.message };
    }
  }

  async pushRepo(
    containerId: string,
    repoUrl: string,
    branch: string,
    commitMessage: string,
    userId?: number
  ): Promise<PushResult> {
    try {
      const repoName = this.extractRepoName(repoUrl);

      // 获取 token
      let authUrl = repoUrl;
      if (userId) {
        const token = this.tokenManager.getToken(userId, this.detectProvider(repoUrl));
        if (token) {
          authUrl = this.injectTokenIntoUrl(repoUrl, token.access_token);
        }
      }

      // 在容器内执行 git add, commit, push
      const commands = [
        `cd /workspace/${repoName}`,
        `git config user.email "bot@code-link.app"`,
        `git config user.name "CodeLink Bot"`,
        `git add -A`,
        `git commit -m "${commitMessage}"`,
        `git push ${authUrl} HEAD:${branch}`,
      ];

      const { stdout, stderr, exitCode } = await execInContainer(containerId, [
        'bash', '-c', commands.join('\n')
      ]);

      if (exitCode !== 0) {
        return { success: false, error: stderr };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  addRepoAssociation(
    projectId: number,
    provider: 'github' | 'gitlab',
    repoUrl: string,
    repoName: string,
    branch: string
  ): void {
    this.db
      .prepare('INSERT INTO project_repos (project_id, provider, repo_url, repo_name, branch) VALUES (?, ?, ?, ?, ?)')
      .run(projectId, provider, repoUrl, repoName, branch);
  }

  getProjectRepos(projectId: number): ProjectRepo[] {
    return this.db
      .prepare('SELECT * FROM project_repos WHERE project_id = ?')
      .all(projectId) as ProjectRepo[];
  }

  removeRepoAssociation(projectId: number, repoUrl: string): void {
    this.db
      .prepare('DELETE FROM project_repos WHERE project_id = ? AND repo_url = ?')
      .run(projectId, repoUrl);
  }

  private detectProvider(url: string): 'github' | 'gitlab' {
    if (url.includes('github.com')) return 'github';
    if (url.includes('gitlab')) return 'gitlab';
    throw new Error('Unknown Git provider');
  }

  private injectTokenIntoUrl(url: string, token: string): string {
    // 将 token 注入 URL：https://github.com/user/repo.git -> https://token@github.com/user/repo.git
    return url.replace('https://', `https://${token}@`);
  }

  private extractRepoName(url: string): string {
    // 从 URL 提取仓库名：https://github.com/user/repo.git -> repo
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace('.git', '');
  }
}
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && pnpm test tests/repo-manager.test.ts
```

Expected: PASS（需要本地 Docker 运行和网络访问）

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/git/repo-manager.ts packages/server/tests/repo-manager.test.ts
git commit -m "feat: add repository manager for clone/push operations"
```

---

### Task 7: OAuth 和仓库 API 路由

**Files:**
- Create: `packages/server/src/routes/github.ts`
- Create: `packages/server/src/routes/gitlab.ts`
- Create: `packages/server/src/routes/repos.ts`
- Create: `packages/server/tests/repos.test.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 实现 GitHub OAuth 路由**

```typescript
// src/routes/github.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getGitHubOAuthUrl, exchangeGitHubCode, getOAuthConfig } from '../git/oauth.ts';
import { TokenManager } from '../git/token-manager.ts';
import { GitHubClient } from '../git/github-client.ts';

export function createGitHubRouter(db: Database.Database): Router {
  const router = Router();
  const tokenManager = new TokenManager(db);

  // GET /api/github/oauth - 获取 OAuth URL
  router.get('/oauth', (req, res) => {
    const config = getOAuthConfig();
    const url = getGitHubOAuthUrl(config);
    res.json({ url });
  });

  // POST /api/github/oauth/callback - 处理 OAuth 回调
  router.post('/oauth/callback', async (req, res) => {
    const { code, userId } = req.body;

    if (!code || !userId) {
      res.status(400).json({ error: '缺少 code 或 userId' });
      return;
    }

    try {
      const config = getOAuthConfig();
      const tokenResponse = await exchangeGitHubCode(config, code);

      // 计算过期时间
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined;

      tokenManager.saveToken(
        userId,
        'github',
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/github/repos - 获取用户的 GitHub 仓库
  router.get('/repos', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const token = tokenManager.getToken(Number(userId), 'github');
    if (!token) {
      res.status(401).json({ error: '未授权 GitHub' });
      return;
    }

    try {
      const client = new GitHubClient(token.access_token);
      const repos = await client.getUserRepos();
      res.json(repos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
```

- [ ] **Step 2: 实现 GitLab OAuth 路由**

```typescript
// src/routes/gitlab.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getGitLabOAuthUrl, exchangeGitLabCode, getOAuthConfig } from '../git/oauth.ts';
import { TokenManager } from '../git/token-manager.ts';
import { GitLabClient } from '../git/gitlab-client.ts';

export function createGitLabRouter(db: Database.Database): Router {
  const router = Router();
  const tokenManager = new TokenManager(db);

  // GET /api/gitlab/oauth - 获取 OAuth URL
  router.get('/oauth', (req, res) => {
    const config = getOAuthConfig();
    const url = getGitLabOAuthUrl(config);
    res.json({ url });
  });

  // POST /api/gitlab/oauth/callback - 处理 OAuth 回调
  router.post('/oauth/callback', async (req, res) => {
    const { code, userId } = req.body;

    if (!code || !userId) {
      res.status(400).json({ error: '缺少 code 或 userId' });
      return;
    }

    try {
      const config = getOAuthConfig();
      const tokenResponse = await exchangeGitLabCode(config, code);

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined;

      tokenManager.saveToken(
        userId,
        'gitlab',
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/gitlab/projects - 获取用户的 GitLab 项目
  router.get('/projects', async (req, res) => {
    const userId = req.query.userId;
    const baseUrl = req.query.baseUrl as string;

    if (!userId) {
      res.status(400).json({ error: '缺少 userId' });
      return;
    }

    const token = tokenManager.getToken(Number(userId), 'gitlab');
    if (!token) {
      res.status(401).json({ error: '未授权 GitLab' });
      return;
    }

    try {
      const client = new GitLabClient(baseUrl || 'https://gitlab.com', token.access_token);
      const projects = await client.getUserProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
```

- [ ] **Step 3: 实现仓库关联路由**

```typescript
// src/routes/repos.ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.ts';
import { RepoManager } from '../git/repo-manager.ts';
import { getContainerStatus } from '../docker/container-manager.ts';

export function createReposRouter(db: Database.Database): Router {
  const router = Router();
  const repoManager = new RepoManager(db);

  // GET /api/repos/:projectId - 获取项目关联的仓库
  router.get('/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: '无效的项目 ID' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const repos = repoManager.getProjectRepos(projectId);
    res.json(repos);
  });

  // POST /api/repos/:projectId/import - 导入仓库到项目
  router.post('/:projectId/import', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { repoUrl, branch, provider } = req.body;

    if (!repoUrl || !branch || !provider) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    // 检查容器是否运行
    const project = db
      .prepare('SELECT container_id FROM projects WHERE id = ?')
      .get(projectId) as any;

    if (!project?.container_id) {
      res.status(400).json({ error: '项目容器未启动' });
      return;
    }

    try {
      // Clone 仓库
      const result = await repoManager.cloneRepo(
        project.container_id,
        repoUrl,
        branch,
        userId
      );

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      // 添加关联
      const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
      repoManager.addRepoAssociation(projectId, provider, repoUrl, repoName, branch);

      res.json({ success: true, path: result.path });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/repos/:projectId/push - 推送代码到仓库
  router.post('/:projectId/push', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { repoUrl, branch, commitMessage } = req.body;

    if (!repoUrl || !commitMessage) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    // 检查权限
    const membership = db
      .prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);

    if (!membership) {
      res.status(403).json({ error: '无权限访问此项目' });
      return;
    }

    const project = db
      .prepare('SELECT container_id FROM projects WHERE id = ?')
      .get(projectId) as any;

    if (!project?.container_id) {
      res.status(400).json({ error: '项目容器未启动' });
      return;
    }

    try {
      const result = await repoManager.pushRepo(
        project.container_id,
        repoUrl,
        branch || 'main',
        commitMessage,
        userId
      );

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/repos/:projectId - 移除仓库关联
  router.delete('/:projectId', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const projectId = parseInt(req.params.projectId, 10);
    const { repoUrl } = req.body;

    if (!repoUrl) {
      res.status(400).json({ error: '缺少 repoUrl' });
      return;
    }

    repoManager.removeRepoAssociation(projectId, repoUrl);
    res.status(204).send();
  });

  return router;
}
```

- [ ] **Step 4: 挂载路由**

```typescript
// src/index.ts - 在 createApp 中添加
import { createGitHubRouter } from './routes/github.ts';
import { createGitLabRouter } from './routes/gitlab.ts';
import { createReposRouter } from './routes/repos.ts';

// 挂载路由
app.use('/api/github', createGitHubRouter(db));
app.use('/api/gitlab', createGitLabRouter(db));
app.use('/api/repos', createReposRouter(db));
```

- [ ] **Step 5: 运行测试验证**

```bash
cd packages/server && pnpm test tests/repos.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/github.ts packages/server/src/routes/gitlab.ts packages/server/src/routes/repos.ts packages/server/tests/repos.test.ts packages/server/src/index.ts
git commit -m "feat: add GitHub/GitLab OAuth and repository management routes"
```

---

### Task 8: 前端 OAuth 回调页面

**Files:**
- Create: `packages/web/src/app/oauth/github/callback/page.tsx`
- Create: `packages/web/src/app/oauth/gitlab/callback/page.tsx`
- Create: `packages/web/src/components/repo-import-dialog.tsx`
- Create: `packages/web/src/components/repo-list.tsx`

- [ ] **Step 1: 实现 GitHub OAuth 回调页面**

```typescript
// src/app/oauth/github/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function GitHubOAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code || !user) {
      setStatus('error');
      return;
    }

    api.post('/api/github/oauth/callback', {
      code,
      userId: user.id,
    })
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      })
      .catch(() => {
        setStatus('error');
      });
  }, [searchParams, user, router]);

  if (status === 'loading') {
    return <div>正在授权 GitHub...</div>;
  }

  if (status === 'success') {
    return <div>GitHub 授权成功！正在跳转...</div>;
  }

  return <div>GitHub 授权失败，请重试</div>;
}
```

- [ ] **Step 2: 实现 GitLab OAuth 回调页面**

```typescript
// src/app/oauth/gitlab/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function GitLabOAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code || !user) {
      setStatus('error');
      return;
    }

    api.post('/api/gitlab/oauth/callback', {
      code,
      userId: user.id,
    })
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      })
      .catch(() => {
        setStatus('error');
      });
  }, [searchParams, user, router]);

  if (status === 'loading') {
    return <div>正在授权 GitLab...</div>;
  }

  if (status === 'success') {
    return <div>GitLab 授权成功！正在跳转...</div>;
  }

  return <div>GitLab 授权失败，请重试</div>;
}
```

- [ ] **Step 3: 实现导入仓库弹窗**

```typescript
// src/components/repo-import-dialog.tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface RepoImportDialogProps {
  projectId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function RepoImportDialog({ projectId, onClose, onSuccess }: RepoImportDialogProps) {
  const { user } = useAuth();
  const [provider, setProvider] = useState<'github' | 'gitlab'>('github');
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(false);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const endpoint = provider === 'github' ? '/api/github/repos' : '/api/gitlab/projects';
      const response = await api.get(`${endpoint}?userId=${user?.id}`);
      setRepos(response.data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
    setLoading(false);
  };

  const importRepo = async () => {
    if (!selectedRepo) return;

    setLoading(true);
    try {
      const repo = repos.find(r => r.html_url === selectedRepo || r.web_url === selectedRepo);

      await api.post(`/api/repos/${projectId}/import`, {
        repoUrl: selectedRepo,
        branch,
        provider,
        repoName: repo?.name,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to import repo:', error);
    }
    setLoading(false);
  };

  return (
    <div className="dialog">
      <h2>导入仓库</h2>

      <div>
        <label>选择平台：</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value as any)}>
          <option value="github">GitHub</option>
          <option value="gitlab">GitLab</option>
        </select>
      </div>

      <button onClick={loadRepos} disabled={loading}>
        加载仓库列表
      </button>

      {repos.length > 0 && (
        <div>
          <label>选择仓库：</label>
          <select
            value={selectedRepo || ''}
            onChange={(e) => setSelectedRepo(e.target.value)}
          >
            {repos.map((repo) => (
              <option key={repo.id} value={repo.html_url || repo.web_url}>
                {repo.full_name || repo.path_with_namespace}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label>分支：</label>
        <input value={branch} onChange={(e) => setBranch(e.target.value)} />
      </div>

      <div className="dialog-actions">
        <button onClick={onClose}>取消</button>
        <button onClick={importRepo} disabled={loading || !selectedRepo}>
          导入
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 实现仓库列表组件**

```typescript
// src/components/repo-list.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface RepoListProps {
  projectId: number;
}

export function RepoList({ projectId }: RepoListProps) {
  const { user } = useAuth();
  const [repos, setRepos] = useState<any[]>([]);
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    loadRepos();
  }, [projectId]);

  const loadRepos = async () => {
    try {
      const response = await api.get(`/api/repos/${projectId}`);
      setRepos(response.data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
  };

  const pushToRepo = async (repoUrl: string, branch: string) => {
    if (!commitMessage) {
      alert('请输入提交信息');
      return;
    }

    try {
      await api.post(`/api/repos/${projectId}/push`, {
        repoUrl,
        branch,
        commitMessage,
      });

      alert('推送成功');
      setCommitMessage('');
    } catch (error) {
      alert('推送失败');
    }
  };

  const removeRepo = async (repoUrl: string) => {
    if (!confirm('确认移除仓库关联？')) return;

    try {
      await api.delete(`/api/repos/${projectId}`, { data: { repoUrl } });
      loadRepos();
    } catch (error) {
      console.error('Failed to remove repo:', error);
    }
  };

  if (repos.length === 0) {
    return <div>尚未关联仓库</div>;
  }

  return (
    <div>
      <h3>已关联仓库</h3>

      <ul>
        {repos.map((repo) => (
          <li key={repo.id}>
            <div>
              <span>{repo.repo_name}</span>
              <span>({repo.provider})</span>
              <a href={repo.repo_url} target="_blank">查看</a>
            </div>

            <div>
              <input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="提交信息"
              />
              <button onClick={() => pushToRepo(repo.repo_url, repo.branch)}>
                推送
              </button>
              <button onClick={() => removeRepo(repo.repo_url)}>
                移除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/app/oauth packages/web/src/components/repo-import-dialog.tsx packages/web/src/components/repo-list.tsx
git commit -m "feat: add frontend OAuth callback pages and repo management components"
```

---

### Task 9: 全量测试 + 端到端验证

**Files:**
- None (测试现有功能)

- [ ] **Step 1: 运行所有测试**

```bash
cd packages/server && pnpm test
cd packages/web && pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 2: 手动验证 OAuth 流程**

```bash
# 启动服务
pnpm dev

# 在浏览器中访问
http://localhost:3000

# 点击 "授权 GitHub" 按钮
# 完成 GitHub OAuth 授权流程
# 验证授权成功后能看到仓库列表
# 导入一个仓库到项目
# 在项目中修改代码
# 推送代码回仓库
```

Expected: OAuth 流程正常工作，能导入和推送代码

- [ ] **Step 3: 测试 GitLab OAuth**

```bash
# 同样的流程测试 GitLab
```

Expected: GitLab OAuth 流程正常工作

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify GitHub/GitLab integration end-to-end"
```