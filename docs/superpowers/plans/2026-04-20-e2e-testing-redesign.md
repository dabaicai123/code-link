# E2E Testing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 E2E 测试架构，采用数据库快照 + 单 Server 实例模式，以用户旅程测试为核心，覆盖完整业务闭环。

**Architecture:** 单 Server 实例 + SQLite 内存数据库快照回滚，TestApp 封装页面操作，数据工厂生成测试参数，Playwright fixtures 提供测试上下文。

**Tech Stack:** Playwright, SQLite (better-sqlite3), JWT, TypeScript

---

## File Structure

```
packages/e2e/
├── tests/
│   ├── journeys/                    # 用户旅程测试 [NEW]
│   │   ├── new-user.journey.ts
│   │   ├── project-lifecycle.journey.ts
│   │   ├── organization.journey.ts
│   │   ├── invitation.journey.ts
│   │   └── settings.journey.ts
│   └── support/                     # 测试支持层 [NEW]
│       ├── fixtures.ts
│       ├── test-app.ts
│       ├── test-api.ts
│       ├── database.ts
│       ├── types.ts
│       └── factories/
│           ├── index.ts
│           ├── user.factory.ts
│           ├── organization.factory.ts
│           └── project.factory.ts
├── playwright.config.ts             # [MODIFY]
├── global-setup.ts                  # [KEEP]
└── helpers/                         # [DELETE after migration]
```

---

## Task 1: Create Types Definition

**Files:**
- Create: `packages/e2e/tests/support/types.ts`

- [ ] **Step 1: Create types definition file**

```typescript
// packages/e2e/tests/support/types.ts
import type { Page } from '@playwright/test';
import type Database from 'better-sqlite3';

export interface E2EServerInstance {
  baseUrl: string;
  sqlite: Database.Database;
  close: () => Promise<void>;
}

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

export interface TestOrganization {
  id: number;
  name: string;
  createdBy: number;
}

export interface TestProject {
  id: number;
  name: string;
  organizationId: number;
  status: string;
  createdBy: number;
}

export interface TestInvitation {
  id: number;
  organizationId: number;
  email: string;
  role: string;
  status: string;
}

export interface E2EFixtures {
  app: TestApp;
  db: TestDatabase;
  api: TestApi;
  server: E2EServerInstance;
}

// Forward declarations for circular dependencies
export type TestApp = import('./test-app').TestApp;
export type TestDatabase = import('./database').TestDatabase;
export type TestApi = import('./test-api').TestApi;
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/support/types.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add types definition for test support layer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create TestDatabase with Snapshot/Rollback

**Files:**
- Create: `packages/e2e/tests/support/database.ts`

- [ ] **Step 1: Create TestDatabase class**

```typescript
// packages/e2e/tests/support/database.ts
import type Database from 'better-sqlite3';

const SNAPSHOT_TABLES = [
  'users',
  'organizations',
  'organization_members',
  'organization_invitations',
  'projects',
  'drafts',
  'draft_members',
  'draft_messages',
  'builds',
  'tokens',
  'claude_configs',
  'repos',
];

const CLEAN_ORDER = [
  'draft_messages',
  'draft_members',
  'drafts',
  'builds',
  'tokens',
  'claude_configs',
  'repos',
  'projects',
  'organization_invitations',
  'organization_members',
  'organizations',
  'users',
];

export class TestDatabase {
  private db: Database.Database;
  private snapshots: Map<string, string> = new Map();

  constructor(sqlite: Database.Database) {
    this.db = sqlite;
  }

  /**
   * Create a named snapshot of current database state
   */
  checkpoint(name: string = 'default'): void {
    const data: Record<string, unknown[]> = {};

    for (const table of SNAPSHOT_TABLES) {
      try {
        data[table] = this.db.prepare(`SELECT * FROM ${table}`).all() as unknown[];
      } catch {
        // Table might not exist in all schemas
        data[table] = [];
      }
    }

    this.snapshots.set(name, JSON.stringify(data));
  }

  /**
   * Rollback database to a named snapshot
   */
  rollback(name: string = 'default'): void {
    const dataJson = this.snapshots.get(name);
    if (!dataJson) {
      throw new Error(`Snapshot '${name}' not found`);
    }

    const data = JSON.parse(dataJson) as Record<string, unknown[]>;

    // Disable foreign keys for bulk operations
    this.db.exec('PRAGMA foreign_keys = OFF');

    try {
      for (const [table, rows] of Object.entries(data)) {
        // Clear table
        this.db.exec(`DELETE FROM ${table}`);

        // Restore rows
        if (rows.length > 0) {
          for (const row of rows as Record<string, unknown>[]) {
            const columns = Object.keys(row);
            const values = columns.map((c) => this.escapeValue(row[c]));
            this.db.exec(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`
            );
          }
        }
      }
    } finally {
      // Re-enable foreign keys
      this.db.exec('PRAGMA foreign_keys = ON');
    }
  }

  /**
   * Clear all tables (for clean state)
   */
  clean(): void {
    this.db.exec('PRAGMA foreign_keys = OFF');
    try {
      for (const table of CLEAN_ORDER) {
        try {
          this.db.exec(`DELETE FROM ${table}`);
        } catch {
          // Table might not exist
        }
      }
    } finally {
      this.db.exec('PRAGMA foreign_keys = ON');
    }
  }

  /**
   * Check if a snapshot exists
   */
  hasSnapshot(name: string): boolean {
    return this.snapshots.has(name);
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots.clear();
  }

  private escapeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    // Handle Date objects and other types
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/support/database.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add TestDatabase with snapshot/rollback support

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create TestApi for Direct API Operations

**Files:**
- Create: `packages/e2e/tests/support/test-api.ts`

- [ ] **Step 1: Create TestApi class**

```typescript
// packages/e2e/tests/support/test-api.ts
import type { TestUser, TestOrganization, TestProject } from './types';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

export class TestApi {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // === User Operations ===

  async getCurrentUser(): Promise<TestUser> {
    const response = await this.get<ApiResponse<{ user: TestUser }>>('/auth/me');
    return response.data.user;
  }

  // === Organization Operations ===

  async getOrganizations(): Promise<TestOrganization[]> {
    const response = await this.get<ApiResponse<{ organizations: TestOrganization[] }>>('/organizations');
    return response.data.organizations;
  }

  async getOrganizationByName(name: string): Promise<TestOrganization | undefined> {
    const orgs = await this.getOrganizations();
    return orgs.find((o) => o.name === name);
  }

  async getOrganizationById(id: number): Promise<TestOrganization | undefined> {
    const response = await this.get<ApiResponse<{ organization: TestOrganization }>>(`/organizations/${id}`);
    return response.data.organization;
  }

  // === Project Operations ===

  async getProjects(): Promise<TestProject[]> {
    const response = await this.get<ApiResponse<{ projects: TestProject[] }>>('/projects');
    return response.data.projects;
  }

  async getProjectByName(name: string): Promise<TestProject | undefined> {
    const projects = await this.getProjects();
    return projects.find((p) => p.name === name);
  }

  async getProjectById(id: number): Promise<TestProject> {
    const response = await this.get<ApiResponse<{ project: TestProject }>>(`/projects/${id}`);
    return response.data.project;
  }

  async getProjectStatus(projectId: number): Promise<string> {
    const project = await this.getProjectById(projectId);
    return project.status;
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.delete(`/projects/${projectId}`);
  }

  // === Low-level HTTP Methods ===

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  private async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DELETE ${path} failed: ${response.status} ${text}`);
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${text}`);
    }
    return response.json();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/support/test-api.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add TestApi for direct API operations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create Data Factories

**Files:**
- Create: `packages/e2e/tests/support/factories/user.factory.ts`
- Create: `packages/e2e/tests/support/factories/organization.factory.ts`
- Create: `packages/e2e/tests/support/factories/project.factory.ts`
- Create: `packages/e2e/tests/support/factories/index.ts`

- [ ] **Step 1: Create user factory**

```typescript
// packages/e2e/tests/support/factories/user.factory.ts
export interface UserParams {
  email?: string;
  name?: string;
  password?: string;
}

export function createUserParams(overrides?: UserParams): Required<UserParams> {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    email: overrides?.email ?? `user-${id}@test.com`,
    name: overrides?.name ?? `Test User ${id.slice(0, 4)}`,
    password: overrides?.password ?? 'password123',
  };
}
```

- [ ] **Step 2: Create organization factory**

```typescript
// packages/e2e/tests/support/factories/organization.factory.ts
export interface OrganizationParams {
  name?: string;
}

export function createOrganizationParams(overrides?: OrganizationParams): Required<OrganizationParams> {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    name: overrides?.name ?? `Test Org ${id.slice(0, 4)}`,
  };
}
```

- [ ] **Step 3: Create project factory**

```typescript
// packages/e2e/tests/support/factories/project.factory.ts
export interface ProjectParams {
  name?: string;
  organizationId?: number;
}

export function createProjectParams(overrides?: ProjectParams): Required<ProjectParams> {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    name: overrides?.name ?? `Test Project ${id.slice(0, 4)}`,
    organizationId: overrides?.organizationId ?? 1,
  };
}
```

- [ ] **Step 4: Create index export**

```typescript
// packages/e2e/tests/support/factories/index.ts
export * from './user.factory';
export * from './organization.factory';
export * from './project.factory';
```

- [ ] **Step 5: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/support/factories/
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add data factories for test parameters

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create TestApp Page Controller

**Files:**
- Create: `packages/e2e/tests/support/test-app.ts`

- [ ] **Step 1: Create TestApp class**

```typescript
// packages/e2e/tests/support/test-app.ts
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { TestDatabase } from './database';
import type { TestApi } from './test-api';
import type { TestUser, TestOrganization, TestProject } from './types';

export class TestApp {
  constructor(
    public readonly page: Page,
    private readonly db: TestDatabase,
    public readonly api: TestApi
  ) {}

  // ============================================
  // Authentication Operations
  // ============================================

  /**
   * Register a new user
   */
  async register(params: {
    email: string;
    name: string;
    password: string;
  }): Promise<TestUser> {
    await this.page.goto('/register');
    await this.page.fill('input[type="email"]', params.email);
    await this.page.fill('input[placeholder="用户名"]', params.name);
    await this.page.fill('input[type="password"]', params.password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });

    // Return user info from API
    return this.api.getCurrentUser();
  }

  /**
   * Login with existing credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.page.click('text=退出');
    await this.page.waitForURL('**/login', { timeout: 5000 });
  }

  // ============================================
  // Settings Operations
  // ============================================

  /**
   * Configure Claude Code settings
   */
  async configureClaude(params: { authToken: string }): Promise<void> {
    await this.page.goto('/settings');
    
    // Click Claude Code tab
    await this.page.click('text=Claude Code');

    // Prepare config JSON
    const config = {
      env: {
        ANTHROPIC_BASE_URL: '',
        ANTHROPIC_AUTH_TOKEN: params.authToken,
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
      },
      skipDangerousModePermissionPrompt: true,
    };

    // Fill and save
    await this.page.fill('textarea', JSON.stringify(config, null, 2));
    await this.page.click('text=保存配置');
    await this.page.waitForSelector('text=配置保存成功', { timeout: 5000 });
  }

  // ============================================
  // Organization Operations
  // ============================================

  /**
   * Create a new organization
   */
  async createOrganization(params: { name: string }): Promise<TestOrganization> {
    await this.page.goto('/settings');
    await this.page.click('text=创建组织');
    await this.page.fill('input[placeholder="组织名称"]', params.name);
    await this.page.click('button:has-text("创建")');
    await this.page.waitForSelector(`text=${params.name}`, { timeout: 5000 });

    return this.api.getOrganizationByName(params.name);
  }

  /**
   * Invite a member to organization
   */
  async inviteMember(orgId: number, email: string): Promise<void> {
    await this.page.goto('/settings');
    
    // Find and click organization in list
    const orgLocator = this.page.locator(`text=${orgId}`).first();
    await orgLocator.click();
    
    // Click invite button
    await this.page.click('text=邀请成员');
    await this.page.fill('input[type="email"]', email);
    await this.page.click('button:has-text("发送邀请")');
    await this.page.waitForSelector(`text=${email}`, { timeout: 5000 });
  }

  // ============================================
  // Project Operations
  // ============================================

  /**
   * Create a new project
   */
  async createProject(params: { name: string }): Promise<TestProject> {
    await this.page.goto('/dashboard');
    await this.page.click('text=新建项目');
    await this.page.fill('input[placeholder="项目名称"]', params.name);
    await this.page.click('button:has-text("创建")');
    await this.page.waitForSelector(`text=${params.name}`, { timeout: 5000 });

    return this.api.getProjectByName(params.name);
  }

  /**
   * Start a project container
   */
  async startProject(projectId: number): Promise<void> {
    await this.page.goto('/dashboard');
    
    // Click on project to start
    await this.page.click(`[data-testid="project-${projectId}"], :text("${projectId}")`);
    
    // Wait for container startup
    await this.page.waitForSelector('text=终端', { timeout: 30000 });
  }

  /**
   * Delete a project via API
   */
  async deleteProject(projectId: number): Promise<void> {
    await this.api.deleteProject(projectId);
  }

  // ============================================
  // Invitation Operations
  // ============================================

  /**
   * Navigate to invitations page
   */
  async goToInvitations(): Promise<void> {
    await this.page.goto('/invitations');
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(orgName: string): Promise<void> {
    await this.goToInvitations();
    await this.page.waitForSelector(`text=${orgName}`, { timeout: 5000 });
    await this.page.click(`button:has-text("接受")`);
    await this.page.waitForSelector('text=已加入组织', { timeout: 5000 });
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(orgName: string): Promise<void> {
    await this.goToInvitations();
    await this.page.waitForSelector(`text=${orgName}`, { timeout: 5000 });
    await this.page.click(`button:has-text("拒绝")`);
    await this.page.waitForSelector('text=已拒绝邀请', { timeout: 5000 });
  }

  // ============================================
  // Assertion Methods
  // ============================================

  /**
   * Assert user is logged in (on dashboard)
   */
  async assertLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/.*dashboard.*/);
  }

  /**
   * Assert user is on login page
   */
  async assertOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*login.*/);
  }

  /**
   * Assert project is visible in list
   */
  async assertProjectVisible(name: string): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert project is NOT visible in list
   */
  async assertProjectNotVisible(name: string): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert project is running
   */
  async assertProjectRunning(projectId: number): Promise<void> {
    const status = await this.api.getProjectStatus(projectId);
    expect(status).toBe('running');
  }

  /**
   * Assert organization is visible in settings
   */
  async assertOrganizationVisible(name: string): Promise<void> {
    await this.page.goto('/settings');
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert organization is NOT visible in settings
   */
  async assertOrganizationNotVisible(name: string): Promise<void> {
    await this.page.goto('/settings');
    await expect(this.page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5000 });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get a locator for an element
   */
  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  /**
   * Navigate to a path
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Reload current page
   */
  async reload(): Promise<void> {
    await this.page.reload();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/support/test-app.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add TestApp page controller for high-level test operations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create Playwright Fixtures

**Files:**
- Create: `packages/e2e/tests/support/fixtures.ts`

- [ ] **Step 1: Create fixtures file**

```typescript
// packages/e2e/tests/support/fixtures.ts
import { test as base, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { TestDatabase } from './database';
import { TestApp } from './test-app';
import { TestApi } from './test-api';
import type { E2EServerInstance, E2EFixtures } from './types';

const TEST_JWT_SECRET = 'e2e-test-secret-key-minimum-32-chars-long';

// Global server instance (singleton)
let globalServer: E2EServerInstance | null = null;

async function getOrStartServer(): Promise<E2EServerInstance> {
  if (!globalServer) {
    const { startServerForE2E } = await import('@code-link/server/dist/index.js');
    globalServer = await startServerForE2E();
  }
  return globalServer;
}

/**
 * Generate a test JWT token for a user
 */
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Generate an expired JWT token for testing token expiration
 */
export function generateExpiredToken(userId: number): string {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '-1s' });
}

/**
 * Setup API proxy to route frontend requests to test server
 */
async function setupApiProxy(
  page: import('@playwright/test').Page,
  serverBaseUrl: string
): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const apiPath = url.replace(/^.*\/api/, `${serverBaseUrl}/api`);

    const originalHeaders = route.request().headers();
    const headers: Record<string, string> = {};

    // Forward only necessary headers
    for (const [key, value] of Object.entries(originalHeaders)) {
      const lowerKey = key.toLowerCase();
      if (['content-type', 'authorization', 'accept'].includes(lowerKey)) {
        headers[key] = value;
      }
    }

    try {
      const response = await fetch(apiPath, {
        method: route.request().method(),
        headers,
        body: route.request().postData() || undefined,
      });

      const responseBody = await response.text();

      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      });
    } catch (error) {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Test server unreachable' }),
      });
    }
  });
}

/**
 * Main test fixture with all E2E support
 */
export const test = base.extend<E2EFixtures>({
  // Server instance (shared across tests)
  server: async ({}, use) => {
    const server = await getOrStartServer();
    await use(server);
  },

  // Database with snapshot support
  db: async ({ server }, use) => {
    const db = new TestDatabase(server.sqlite);
    db.clean();
    db.checkpoint('initial');

    await use(db);

    // Always rollback to initial state after test
    db.rollback('initial');
  },

  // API client
  api: async ({ server }, use) => {
    const api = new TestApi(server.baseUrl);
    await use(api);
  },

  // Test application controller
  app: async ({ page, db, api, server }, use) => {
    // Setup API proxy before each test
    await setupApiProxy(page, server.baseUrl);

    const app = new TestApp(page, db, api);
    await use(app);
  },
});

/**
 * Auth-specific test fixture (no pre-authenticated state)
 */
export const authTest = base.extend<E2EFixtures>({
  server: async ({}, use) => {
    const server = await getOrStartServer();
    await use(server);
  },

  db: async ({ server }, use) => {
    const db = new TestDatabase(server.sqlite);
    db.clean();
    db.checkpoint('initial');
    await use(db);
    db.rollback('initial');
  },

  api: async ({ server }, use) => {
    const api = new TestApi(server.baseUrl);
    await use(api);
  },

  app: async ({ page, db, api, server }, use) => {
    await setupApiProxy(page, server.baseUrl);
    const app = new TestApp(page, db, api);
    await use(app);
  },
});

// Re-export expect for convenience
export { expect };

/**
 * Cleanup global resources (call in global teardown)
 */
export async function cleanupGlobalResources(): Promise<void> {
  if (globalServer) {
    await globalServer.close();
    globalServer = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/support/fixtures.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add Playwright fixtures with server, db, api, and app

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update Playwright Configuration

**Files:**
- Modify: `packages/e2e/playwright.config.ts`

- [ ] **Step 1: Update playwright.config.ts**

```typescript
// packages/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory - journey tests
  testDir: './tests/journeys',

  // Sequential execution for data consistency
  fullyParallel: false,
  workers: 1,

  // Fail build on .only in CI
  forbidOnly: !!process.env.CI,

  // Retry in CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],

  // Global setup/teardown
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  // Test configuration
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,

    // Browser launch options
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ],
    },

    // Tighter timeouts for faster failure
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Test projects
  projects: [
    {
      name: 'journeys',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: '**/*.journey.ts',
    },
  ],
});
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/playwright.config.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
refactor(e2e): update playwright config for journey tests

- Set testDir to tests/journeys
- Sequential execution (workers: 1) for data consistency
- Single project for all journey tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create New User Journey Test

**Files:**
- Create: `packages/e2e/tests/journeys/new-user.journey.ts`

- [ ] **Step 1: Create new user journey test**

```typescript
// packages/e2e/tests/journeys/new-user.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('新用户完整旅程', () => {
  test('从注册到项目启动的完整流程', async ({ app, db, api }) => {
    // 创建初始快照
    db.checkpoint('journey-start');

    try {
      // 1. 注册新用户
      const userParams = createUserParams();
      const user = await app.register(userParams);
      expect(user.email).toBe(userParams.email);
      expect(user.name).toBe(userParams.name);

      // 2. 验证自动登录成功
      await app.assertLoggedIn();

      // 3. 设置 API token
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

    } finally {
      // 回滚数据
      db.rollback('journey-start');
    }
  });

  test('用户登录流程', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 先注册一个用户
      const userParams = createUserParams();
      await app.register(userParams);

      // 登出
      await app.logout();
      await app.assertOnLoginPage();

      // 重新登录
      await app.login(userParams.email, userParams.password);
      await app.assertLoggedIn();

    } finally {
      db.rollback('journey-start');
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/journeys/new-user.journey.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add new user journey test

Covers: register -> configure -> create org -> create project -> start project

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Create Project Lifecycle Journey Test

**Files:**
- Create: `packages/e2e/tests/journeys/project-lifecycle.journey.ts`

- [ ] **Step 1: Create project lifecycle journey test**

```typescript
// packages/e2e/tests/journeys/project-lifecycle.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';

test.describe('项目生命周期旅程', () => {
  test('项目创建、启动、删除流程', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 前置：创建用户和组织
      const userParams = createUserParams();
      const user = await app.register(userParams);
      api.setToken(generateToken(user.id));

      await app.configureClaude({ authToken: 'sk-test-token' });
      const org = await app.createOrganization(createOrganizationParams());

      // 1. 创建项目
      const projectParams = createProjectParams({ organizationId: org.id });
      const project = await app.createProject(projectParams);
      await app.assertProjectVisible(projectParams.name);

      // 2. 启动项目
      await app.startProject(project.id);
      await app.assertProjectRunning(project.id);

      // 3. 删除项目
      await app.deleteProject(project.id);
      await app.assertProjectNotVisible(projectParams.name);

    } finally {
      db.rollback('journey-start');
    }
  });

  test('多项目显示', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 前置准备
      const user = await app.register(createUserParams());
      api.setToken(generateToken(user.id));
      await app.configureClaude({ authToken: 'sk-test-token' });
      const org = await app.createOrganization(createOrganizationParams());

      // 创建多个项目
      const projectNames = ['Project Alpha', 'Project Beta', 'Project Gamma'];
      for (const name of projectNames) {
        await app.createProject({ name });
      }

      // 验证所有项目可见
      await app.page.goto('/dashboard');
      for (const name of projectNames) {
        await app.assertProjectVisible(name);
      }

    } finally {
      db.rollback('journey-start');
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/journeys/project-lifecycle.journey.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add project lifecycle journey test

Covers: create project -> start -> delete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Create Organization Journey Test

**Files:**
- Create: `packages/e2e/tests/journeys/organization.journey.ts`

- [ ] **Step 1: Create organization journey test**

```typescript
// packages/e2e/tests/journeys/organization.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('组织管理旅程', () => {
  test('组织创建与成员邀请', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 创建用户和组织
      const user = await app.register(createUserParams());
      api.setToken(generateToken(user.id));
      const org = await app.createOrganization(
        createOrganizationParams({ name: '邀请测试组织' })
      );

      // 邀请成员
      await app.inviteMember(org.id, 'invited-member@example.com');

      // 验证邀请在列表中
      await app.page.goto('/settings');
      await app.page.click('text=邀请测试组织');
      await app.page.click('text=展开');
      await expect(app.page.locator('text=invited-member@example.com')).toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });

  test('多组织显示', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      const user = await app.register(createUserParams());
      api.setToken(generateToken(user.id));

      // 创建多个组织
      const orgNames = ['First Organization', 'Second Organization', 'Third Organization'];
      for (const name of orgNames) {
        await app.createOrganization({ name });
      }

      // 验证所有组织可见
      await app.page.goto('/settings');
      for (const name of orgNames) {
        await expect(app.page.locator(`text=${name}`)).toBeVisible();
      }

    } finally {
      db.rollback('journey-start');
    }
  });

  test('空组织列表显示', async ({ app, db }) => {
    db.checkpoint('journey-start');

    try {
      await app.register(createUserParams());
      await app.page.goto('/settings');
      await expect(app.page.locator('text=创建组织')).toBeVisible();
    } finally {
      db.rollback('journey-start');
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/journeys/organization.journey.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add organization journey test

Covers: create org -> invite member -> view member list

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Create Invitation Journey Test

**Files:**
- Create: `packages/e2e/tests/journeys/invitation.journey.ts`

- [ ] **Step 1: Create invitation journey test**

```typescript
// packages/e2e/tests/journeys/invitation.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams } from '../support/factories';

test.describe('邀请处理旅程', () => {
  test('接受邀请并加入组织', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 创建邀请者用户和组织
      const inviterParams = createUserParams({ email: 'inviter@test.com' });
      const inviter = await app.register(inviterParams);
      api.setToken(generateToken(inviter.id));
      const org = await app.createOrganization(
        createOrganizationParams({ name: '邀请组织' })
      );

      // 邀请另一个用户
      const inviteeEmail = 'invitee@test.com';
      await app.inviteMember(org.id, inviteeEmail);

      // 登出邀请者
      await app.logout();

      // 被邀请者注册
      const inviteeParams = createUserParams({ email: inviteeEmail });
      await app.register(inviteeParams);

      // 查看邀请列表
      await app.goToInvitations();
      await expect(app.page.locator('text=邀请组织')).toBeVisible();

      // 接受邀请
      await app.page.click('button:has-text("接受")');
      await app.page.waitForSelector('text=已加入组织', { timeout: 5000 });

      // 验证已加入组织
      await app.page.goto('/settings');
      await expect(app.page.locator('text=邀请组织')).toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });

  test('拒绝邀请', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      // 准备邀请
      const inviter = await app.register(createUserParams({ email: 'inviter2@test.com' }));
      api.setToken(generateToken(inviter.id));
      const org = await app.createOrganization(createOrganizationParams({ name: '拒绝测试组织' }));

      const inviteeEmail = 'declined@test.com';
      await app.inviteMember(org.id, inviteeEmail);

      // 被邀请者登录
      await app.logout();
      await app.register(createUserParams({ email: inviteeEmail }));

      // 拒绝邀请
      await app.goToInvitations();
      await app.page.click('button:has-text("拒绝")');
      await app.page.waitForSelector('text=已拒绝邀请', { timeout: 5000 });

      // 验证未加入组织
      await app.page.goto('/settings');
      await expect(app.page.locator('text=拒绝测试组织')).not.toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/journeys/invitation.journey.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add invitation journey test

Covers: receive invitation -> accept/decline -> join/ignore organization

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Create Settings Journey Test

**Files:**
- Create: `packages/e2e/tests/journeys/settings.journey.ts`

- [ ] **Step 1: Create settings journey test**

```typescript
// packages/e2e/tests/journeys/settings.journey.ts
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams } from '../support/factories';

test.describe('配置管理旅程', () => {
  test('Claude Code 配置管理', async ({ app, db, api }) => {
    db.checkpoint('journey-start');

    try {
      const user = await app.register(createUserParams());
      api.setToken(generateToken(user.id));

      // 进入设置页
      await app.page.goto('/settings');
      await expect(app.page.locator('text=组织')).toBeVisible();
      await expect(app.page.locator('text=Claude Code')).toBeVisible();

      // 配置 Claude Code
      await app.configureClaude({ authToken: 'sk-ant-test-token-12345' });

      // 验证配置已保存
      await app.page.reload();
      await app.page.click('text=Claude Code');
      const configText = await app.page.locator('textarea').inputValue();
      expect(configText).toContain('sk-ant-test-token-12345');

    } finally {
      db.rollback('journey-start');
    }
  });

  test('切换设置标签', async ({ app, db }) => {
    db.checkpoint('journey-start');

    try {
      await app.register(createUserParams());
      await app.page.goto('/settings');

      // 默认在组织标签
      await expect(app.page.locator('text=创建组织')).toBeVisible();

      // 切换到 Claude Code 标签
      await app.page.click('text=Claude Code');
      await expect(app.page.locator('text=JSON 配置')).toBeVisible();

      // 切换回组织标签
      await app.page.click('text=组织');
      await expect(app.page.locator('text=创建组织')).toBeVisible();

    } finally {
      db.rollback('journey-start');
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/tests/journeys/settings.journey.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
feat(e2e): add settings journey test

Covers: view config -> modify config -> verify saved

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Update Global Teardown

**Files:**
- Modify: `packages/e2e/global-teardown.ts`

- [ ] **Step 1: Update global-teardown.ts**

```typescript
// packages/e2e/global-teardown.ts
import { cleanupGlobalResources } from './tests/support/fixtures';

export default async function globalTeardown() {
  await cleanupGlobalResources();
  console.log('E2E 测试清理完成');
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add packages/e2e/global-teardown.ts
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
refactor(e2e): update global teardown to use fixtures cleanup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Remove Old Test Files

**Files:**
- Delete: `packages/e2e/tests/auth.spec.ts`
- Delete: `packages/e2e/tests/projects.spec.ts`
- Delete: `packages/e2e/tests/organizations.spec.ts`
- Delete: `packages/e2e/tests/collaboration.spec.ts`
- Delete: `packages/e2e/helpers/` (entire directory)

- [ ] **Step 1: Delete old test files**

```bash
rm -f packages/e2e/tests/auth.spec.ts
rm -f packages/e2e/tests/projects.spec.ts
rm -f packages/e2e/tests/organizations.spec.ts
rm -f packages/e2e/tests/collaboration.spec.ts
rm -rf packages/e2e/helpers/
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lsx/code-link add -A packages/e2e/tests/*.spec.ts packages/e2e/helpers/
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
refactor(e2e): remove old spec-based test files

Replaced by journey-based tests in tests/journeys/

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Verify Tests Pass

**Files:**
- None (verification only)

- [ ] **Step 1: Run tests to verify**

```bash
cd /home/lsx/code-link && pnpm --filter @code-link/e2e test
```

Expected: All journey tests pass

- [ ] **Step 2: Verify test isolation**

Run tests twice to ensure data isolation works:
```bash
pnpm --filter @code-link/e2e test
pnpm --filter @code-link/e2e test
```

Expected: Both runs pass without data pollution

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git -C /home/lsx/code-link add -A
git -C /home/lsx/code-link commit -m "$(cat <<'EOF'
fix(e2e): fix any test issues after migration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create types definition | types.ts |
| 2 | Create TestDatabase | database.ts |
| 3 | Create TestApi | test-api.ts |
| 4 | Create data factories | factories/*.ts |
| 5 | Create TestApp | test-app.ts |
| 6 | Create fixtures | fixtures.ts |
| 7 | Update playwright config | playwright.config.ts |
| 8 | New user journey | new-user.journey.ts |
| 9 | Project lifecycle journey | project-lifecycle.journey.ts |
| 10 | Organization journey | organization.journey.ts |
| 11 | Invitation journey | invitation.journey.ts |
| 12 | Settings journey | settings.journey.ts |
| 13 | Update global teardown | global-teardown.ts |
| 14 | Remove old tests | *.spec.ts, helpers/ |
| 15 | Verify tests pass | - |
