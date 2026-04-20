# E2E Testing Redesign Design Spec

> **Goal:** 重构 E2E 测试架构，采用数据库快照 + 单 Server 实例模式，以用户旅程测试为核心，覆盖完整业务闭环（排除实时协作功能）。

---

## 一、背景与目标

### 当前状态

现有 E2E 测试位于 `packages/e2e/`，使用 Playwright：
- **架构**：全局 Server 实例 + SQLite 内存数据库 + API proxy 模式
- **组织方式**：按功能模块划分（auth.spec.ts, projects.spec.ts, organizations.spec.ts, collaboration.spec.ts）
- **问题**：
  - 测试间存在数据污染风险
  - 模块化测试无法反映真实用户使用流程
  - 启动慢（全局 Server 需等待启动）

### 目标

1. **完整业务闭环**：覆盖用户从注册到项目管理的完整路径
2. **数据隔离**：每个测试完全独立，无状态污染
3. **快速执行**：单 Server 实例 + 数据库快照回滚
4. **易于维护**：清晰目录结构、可复用测试工具

### 排除范围

- **实时协作功能**：WebSocket 实时编辑、消息同步等功能不纳入测试

---

## 二、架构设计

### 2.1 目录结构

```
packages/e2e/
├── tests/
│   ├── journeys/                    # 用户旅程测试
│   │   ├── new-user.journey.ts          # 新用户完整旅程
│   │   ├── project-lifecycle.journey.ts  # 项目生命周期
│   │   ├── organization.journey.ts       # 组织管理旅程
│   │   ├── invitation.journey.ts         # 邀请处理旅程
│   │   └── settings.journey.ts           # 配置管理旅程
│   └── support/                     # 测试支持层
│       ├── fixtures.ts                  # Playwright fixtures
│       ├── test-app.ts                  # 测试应用控制器
│       ├── database.ts                  # 数据库快照/回滚
│       ├── factories/                   # 数据工厂
│       │   ├── user.factory.ts
│       │   ├── organization.factory.ts
│       │   ├── project.factory.ts
│       │   └── invitation.factory.ts
│       │   └── index.ts
│       └── assertions/                  # 自定义断言
│           ├── auth.assertions.ts
│           ├── project.assertions.ts
│           └── organization.assertions.ts
│           └── index.ts
├── playwright.config.ts             # Playwright 配置
├── global-setup.ts                  # 全局启动（检查前端服务）
├── global-teardown.ts               # 全局清理
└── helpers/                         # 保留现有 helper（迁移后删除）
```

### 2.2 数据库快照机制

核心原理：SQLite 内存数据库支持序列化/反序列化操作。

```typescript
// tests/support/database.ts
export class TestDatabase {
  private db: Database;
  private snapshots: Map<string, string> = new Map();

  constructor(sqlite: Database) {
    this.db = sqlite;
  }

  // 创建快照
  async checkpoint(name: string = 'default'): void {
    const tables = ['users', 'organizations', 'organization_members', 
                    'organization_invitations', 'projects', 'drafts'];
    const data: Record<string, unknown[]> = {};

    for (const table of tables) {
      data[table] = this.db.prepare(`SELECT * FROM ${table}`).all();
    }

    this.snapshots.set(name, JSON.stringify(data));
  }

  // 回滚到快照
  async rollback(name: string = 'default'): void {
    const data = JSON.parse(this.snapshots.get(name) || '{}');

    this.db.exec('PRAGMA foreign_keys = OFF');

    for (const [table, rows] of Object.entries(data)) {
      this.db.exec(`DELETE FROM ${table}`);
      if (rows.length > 0) {
        for (const row of rows as Record<string, unknown>[]) {
          const cols = Object.keys(row);
          const vals = cols.map(c => this.escapeValue(row[c]));
          this.db.exec(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')})`);
        }
      }
    }

    this.db.exec('PRAGMA foreign_keys = ON');
  }

  // 清空数据库
  async clean(): void {
    const tables = ['organization_invitations', 'organization_members', 
                    'projects', 'organizations', 'users'];
    for (const table of tables) {
      this.db.exec(`DELETE FROM ${table}`);
    }
  }

  private escapeValue(v: unknown): string {
    if (v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    return `'${JSON.stringify(v)}'`;
  }
}
```

### 2.3 TestApp - 测试应用控制器

统一封装所有页面操作，提供高层 API。

```typescript
// tests/support/test-app.ts
export class TestApp {
  constructor(
    public page: Page,
    private db: TestDatabase,
    private api: TestApi
  ) {}

  // === 认证操作 ===
  async register(params: { email: string; name: string; password: string }): User {
    await this.page.goto('/register');
    await this.page.fill('input[type="email"]', params.email);
    await this.page.fill('input[placeholder="用户名"]', params.name);
    await this.page.fill('input[type="password"]', params.password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/dashboard');
    return this.api.getCurrentUser();
  }

  async login(email: string, password: string): void {
    await this.page.goto('/login');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/dashboard');
  }

  async logout(): void {
    await this.page.click('text=退出');
    await this.page.waitForURL('**/login');
  }

  // === 配置操作 ===
  async configureClaude(params: { authToken: string }): void {
    await this.page.goto('/settings');
    await this.page.click('text=Claude Code');
    
    const config = {
      env: { ANTHROPIC_AUTH_TOKEN: params.authToken },
      skipDangerousModePermissionPrompt: true
    };
    
    await this.page.fill('textarea', JSON.stringify(config));
    await this.page.click('text=保存配置');
    await this.page.waitForSelector('text=配置保存成功');
  }

  // === 组织操作 ===
  async createOrganization(params: { name: string }): Organization {
    await this.page.goto('/settings');
    await this.page.click('text=创建组织');
    await this.page.fill('input[placeholder="组织名称"]', params.name);
    await this.page.click('button:has-text("创建")');
    await this.page.waitForSelector(`text=${params.name}`);
    return this.api.getOrganizationByName(params.name);
  }

  async inviteMember(orgId: number, email: string): void {
    await this.page.goto('/settings');
    await this.page.click(`text=组织-${orgId}`);
    await this.page.click('text=邀请成员');
    await this.page.fill('input[type="email"]', email);
    await this.page.click('button:has-text("发送邀请")');
  }

  // === 项目操作 ===
  async createProject(params: { name: string; organizationId?: number }): Project {
    await this.page.goto('/dashboard');
    await this.page.click('text=新建项目');
    await this.page.fill('input[placeholder="项目名称"]', params.name);
    await this.page.click('button:has-text("创建")');
    await this.page.waitForSelector(`text=${params.name}`);
    return this.api.getProjectByName(params.name);
  }

  async startProject(projectId: number): void {
    await this.page.goto('/dashboard');
    await this.page.click(`text=项目-${projectId}`);
    await this.page.waitForSelector('text=正在启动容器...', { timeout: 10000 });
    await this.page.waitForSelector('text=终端', { timeout: 30000 });
  }

  async deleteProject(projectId: number): void {
    // 通过 API 删除（页面暂无删除入口）
    await this.api.deleteProject(projectId);
  }

  // === 邀请处理 ===
  async acceptInvitation(invitationId: number): void {
    await this.page.goto('/invitations');
    await this.page.click(`text=接受-${invitationId}`);
    await this.page.waitForSelector('text=已加入组织');
  }

  async declineInvitation(invitationId: number): void {
    await this.page.goto('/invitations');
    await this.page.click(`text=拒绝-${invitationId}`);
    await this.page.waitForSelector('text=已拒绝邀请');
  }

  // === 断言方法 ===
  async assertLoggedIn(): void {
    await expect(this.page).toHaveURL(/.*dashboard.*/);
  }

  async assertProjectVisible(name: string): void {
    await expect(this.page.locator(`text=${name}`)).toBeVisible();
  }

  async assertProjectRunning(projectId: number): void {
    const status = await this.api.getProjectStatus(projectId);
    expect(status).toBe('running');
  }

  async assertOrganizationVisible(name: string): void {
    await this.page.goto('/settings');
    await expect(this.page.locator(`text=${name}`)).toBeVisible();
  }
}
```

### 2.4 TestApi - API 直接操作

绕过页面，直接操作 API，用于快速设置测试状态。

```typescript
// tests/support/test-api.ts
export class TestApi {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async getCurrentUser(): User {
    return this.get('/auth/me');
  }

  async getOrganizationByName(name: string): Organization {
    const orgs = await this.get('/organizations');
    return orgs.find(o => o.name === name);
  }

  async getProjectByName(name: string): Project {
    const projects = await this.get('/projects');
    return projects.find(p => p.name === name);
  }

  async getProjectStatus(projectId: number): string {
    const project = await this.get(`/projects/${projectId}`);
    return project.status;
  }

  async deleteProject(projectId: number): void {
    await this.delete(`/projects/${projectId}`);
  }

  private async get(path: string): any {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {}
    });
    return res.json().data;
  }

  private async delete(path: string): void {
    await fetch(`${this.baseUrl}/api${path}`, {
      method: 'DELETE',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {}
    });
  }
}
```

### 2.5 数据工厂

```typescript
// tests/support/factories/user.factory.ts
export interface UserParams {
  email?: string;
  name?: string;
  password?: string;
}

export function createUserParams(overrides?: UserParams): Required<UserParams> {
  const id = Math.random().toString(36).slice(2);
  return {
    email: overrides?.email || `user-${id}@test.com`,
    name: overrides?.name || `Test User ${id}`,
    password: overrides?.password || 'password123',
  };
}

// tests/support/factories/organization.factory.ts
export interface OrganizationParams {
  name?: string;
}

export function createOrganizationParams(overrides?: OrganizationParams): Required<OrganizationParams> {
  const id = Math.random().toString(36).slice(2);
  return {
    name: overrides?.name || `Test Org ${id}`,
  };
}

// tests/support/factories/project.factory.ts
export interface ProjectParams {
  name?: string;
  organizationId?: number;
}

export function createProjectParams(overrides?: ProjectParams): Required<ProjectParams> {
  const id = Math.random().toString(36).slice(2);
  return {
    name: overrides?.name || `Test Project ${id}`,
    organizationId: overrides?.organizationId || 1,
  };
}

// tests/support/factories/index.ts
export * from './user.factory';
export * from './organization.factory';
export * from './project.factory';
```

### 2.6 Playwright Fixtures

```typescript
// tests/support/fixtures.ts
import { test as base } from '@playwright/test';
import { TestDatabase } from './database';
import { TestApp } from './test-app';
import { TestApi } from './test-api';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'e2e-test-secret-key-minimum-32-chars-long';

interface E2EFixtures {
  app: TestApp;
  db: TestDatabase;
  api: TestApi;
  server: E2EServerInstance;
}

let globalServer: E2EServerInstance | null = null;

async function getOrStartServer(): Promise<E2EServerInstance> {
  if (!globalServer) {
    const { startServerForE2E } = await import('@code-link/server/dist/index.js');
    globalServer = await startServerForE2E();
  }
  return globalServer;
}

export const test = base.extend<E2EFixtures>({
  server: async ({}, use) => {
    await use(await getOrStartServer());
  },

  db: async ({ server }, use) => {
    const db = new TestDatabase(server.sqlite);
    await db.clean();
    await db.checkpoint('initial');
    await use(db);
    await db.rollback('initial');
  },

  api: async ({ server }, use) => {
    const api = new TestApi(server.baseUrl);
    await use(api);
  },

  app: async ({ page, db, api, server }, use) => {
    // 设置 API proxy
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const apiPath = url.replace(/^.*\/api/, `${server.baseUrl}/api`);
      const headers: Record<string, string> = {};
      const original = route.request().headers();
      
      for (const [key, value] of Object.entries(original)) {
        if (['content-type', 'authorization', 'accept'].includes(key.toLowerCase())) {
          headers[key] = value;
        }
      }

      try {
        const response = await fetch(apiPath, {
          method: route.request().method(),
          headers,
          body: route.request().postData(),
        });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: await response.text(),
        });
      } catch {
        await route.fulfill({ status: 500, body: '{"error":"server unreachable"}' });
      }
    });

    const app = new TestApp(page, db, api);
    await use(app);
  },
});

export { expect } from '@playwright/test';
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });
}
```

### 2.7 Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/journeys',
  fullyParallel: false,  // 旅程测试顺序执行
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  
  expect: { timeout: 5000 },
  
  projects: [
    {
      name: 'journeys',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*.journey.ts',
    },
  ],
});
```

---

## 三、用户旅程定义

### 3.1 新用户完整旅程

**覆盖场景：** 注册 → 配置 → 创建组织 → 创建项目 → 启动项目

```typescript
// tests/journeys/new-user.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('新用户完整旅程', () => {
  test('从注册到项目启动', async ({ app, db, api }) => {
    // 快照初始状态
    await db.checkpoint('journey-start');

    // 1. 注册新用户
    const userParams = createUserParams();
    const user = await app.register(userParams);
    expect(user.email).toBe(userParams.email);

    // 2. 验证自动登录
    await app.assertLoggedIn();

    // 3. 设置 API token 用于后续操作
    api.setToken(generateToken(user.id));

    // 4. 配置 Claude Code
    await app.configureClaude({ authToken: 'sk-test-token-xxx' });

    // 5. 创建组织
    const orgParams = createOrganizationParams();
    const org = await app.createOrganization(orgParams);
    expect(org.name).toBe(orgParams.name);

    // 6. 创建项目
    const projectParams = createProjectParams({ organizationId: org.id });
    const project = await app.createProject(projectParams);
    expect(project.name).toBe(projectParams.name);

    // 7. 启动项目
    await app.startProject(project.id);
    await app.assertProjectRunning(project.id);

    // 8. 回滚数据
    await db.rollback('journey-start');
  });
});
```

### 3.2 项目生命周期旅程

**覆盖场景：** 创建项目 → 启动 → 验证状态 → 删除

```typescript
// tests/journeys/project-lifecycle.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('项目生命周期旅程', () => {
  test('项目创建、启动、删除流程', async ({ app, db, api }) => {
    await db.checkpoint('journey-start');

    // 前置：创建用户和组织
    const userParams = createUserParams();
    const user = await app.register(userParams);
    api.setToken(generateToken(user.id));

    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());

    // 创建项目
    const projectParams = createProjectParams({ organizationId: org.id });
    const project = await app.createProject(projectParams);
    await app.assertProjectVisible(projectParams.name);

    // 启动项目
    await app.startProject(project.id);
    await app.assertProjectRunning(project.id);

    // 删除项目（通过 API）
    await app.deleteProject(project.id);
    await app.page.goto('/dashboard');
    await expect(app.page.locator(`text=${projectParams.name}`)).not.toBeVisible();

    await db.rollback('journey-start');
  });
});
```

### 3.3 组织管理旅程

**覆盖场景：** 创建组织 → 邀请成员 → 查看成员列表 → 成员角色管理

```typescript
// tests/journeys/organization.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('组织管理旅程', () => {
  test('组织创建与成员邀请', async ({ app, db, api }) => {
    await db.checkpoint('journey-start');

    // 创建用户和组织
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    const org = await app.createOrganization(createOrganizationParams({ name: '邀请测试组织' }));

    // 邀请成员
    await app.inviteMember(org.id, 'invited-member@example.com');

    // 验证邀请在列表中
    await app.page.goto('/settings');
    await app.page.click('text=邀请测试组织');
    await app.page.click('text=展开');
    await expect(app.page.locator('text=invited-member@example.com')).toBeVisible();

    await db.rollback('journey-start');
  });
});
```

### 3.4 邀请处理旅程

**覆盖场景：** 接收邀请 → 接受 → 加入组织 → 或拒绝

```typescript
// tests/journeys/invitation.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('邀请处理旅程', () => {
  test('接受邀请并加入组织', async ({ app, db, api, server }) => {
    await db.checkpoint('journey-start');

    // 创建邀请者用户和组织
    const inviterParams = createUserParams({ email: 'inviter@test.com' });
    const inviter = await app.register(inviterParams);
    api.setToken(generateToken(inviter.id));
    const org = await app.createOrganization(createOrganizationParams({ name: '邀请组织' }));

    // 邀请另一个用户
    const inviteeEmail = 'invitee@test.com';
    await app.inviteMember(org.id, inviteeEmail);

    // 切换到被邀请用户（模拟登录）
    await app.logout();
    const inviteeParams = createUserParams({ email: inviteeEmail });
    await app.register(inviteeParams);

    // 查看邀请列表
    await app.page.goto('/invitations');
    await expect(app.page.locator('text=邀请组织')).toBeVisible();

    // 接受邀请
    await app.page.click('button:has-text("接受")');
    await app.page.waitForSelector('text=已加入组织');

    // 验证已加入组织
    await app.page.goto('/settings');
    await expect(app.page.locator('text=邀请组织')).toBeVisible();

    await db.rollback('journey-start');
  });
});
```

### 3.5 配置管理旅程

**覆盖场景：** 查看 Claude 配置 → 修改配置 → 验证配置生效

```typescript
// tests/journeys/settings.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams } from '../support/factories';

test.describe('配置管理旅程', () => {
  test('Claude Code 配置管理', async ({ app, db, api }) => {
    await db.checkpoint('journey-start');

    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));

    // 进入设置页
    await app.page.goto('/settings');
    await expect(app.page.locator('text=组织')).toBeVisible();
    await expect(app.page.locator('text=Claude Code')).toBeVisible();

    // 配置 Claude Code
    await app.configureClaude({ authToken: 'sk-ant-test-token' });

    // 验证配置已保存
    await app.page.reload();
    await app.page.click('text=Claude Code');
    const configText = await app.page.locator('textarea').inputValue();
    expect(configText).toContain('sk-ant-test-token');

    await db.rollback('journey-start');
  });
});
```

---

## 四、测试执行策略

### 4.1 执行顺序

旅程测试按顺序执行（workers: 1），保证数据库状态一致性：
1. `new-user.journey.ts` - 新用户注册流程
2. `project-lifecycle.journey.ts` - 项目管理流程
3. `organization.journey.ts` - 组织管理流程
4. `invitation.journey.ts` - 邀请处理流程
5. `settings.journey.ts` - 配置管理流程

### 4.2 数据隔离

每个测试：
- 开始前：`db.checkpoint('test-start')`
- 结束后：`db.rollback('test-start')`

保证测试间零干扰。

### 4.3 CI 集成

```yaml
# CI 中执行
- pnpm --filter @code-link/e2e test
```

---

## 五、迁移计划

### 5.1 阶段一：基础设施

1. 创建 `tests/support/` 目录结构
2. 实现 `TestDatabase` 快照机制
3. 实现 `TestApi` API 操作
4. 实现 `TestApp` 页面控制器
5. 实现 Playwright fixtures

### 5.2 阶段二：数据工厂

1. 实现用户工厂
2. 实现组织工厂
3. 实现项目工厂
4. 实现邀请工厂

### 5.3 阶段三：用户旅程

1. 编写 `new-user.journey.ts`
2. 编写 `project-lifecycle.journey.ts`
3. 编写 `organization.journey.ts`
4. 编写 `invitation.journey.ts`
5. 编写 `settings.journey.ts`

### 5.4 阶段四：清理

1. 删除旧测试文件（auth.spec.ts 等）
2. 删除旧 helpers 目录
3. 更新 playwright.config.ts

---

## 六、技术栈

- **Playwright** - 测试框架
- **SQLite (better-sqlite3)** - 内存数据库
- **JWT** - 测试 token 生成
- **TypeScript** - 类型安全

---

## 七、验收标准

1. 所有 5 个用户旅程测试通过
2. 测试间数据完全隔离，可重复执行
3. 单次执行时间 < 60 秒
4. CI 集成正常工作