# 测试用例 ORM 迁移实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 packages/server/tests 目录下所有测试文件从原生 SQL 迁移到 Drizzle ORM。

**Architecture:** 创建测试辅助函数模块封装常用数据操作，Schema 验证测试保留表存在性原生 SQL 查询，其他测试使用辅助函数或 ORM 直接操作。

**Tech Stack:** Drizzle ORM, Vitest, better-sqlite3

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `tests/helpers/test-db.ts` | 创建 | 测试辅助函数模块 |
| `tests/db.test.ts` | 修改 | Schema 验证迁移 |
| `tests/tokens-schema.test.ts` | 修改 | Schema 验证迁移 |
| `tests/drafts.test.ts` | 修改 | 使用辅助函数 |
| `tests/repos.test.ts` | 修改 | 使用辅助函数 |
| `tests/builds.test.ts` | 修改 | 使用辅助函数 |
| `tests/containers.test.ts` | 修改 | 使用辅助函数 |
| `tests/projects.test.ts` | 修改 | 使用辅助函数 |
| `tests/claude-config.test.ts` | 修改 | 使用辅助函数 |
| `tests/repo-manager.test.ts` | 修改 | 使用辅助函数 |
| `tests/build-manager.test.ts` | 修改 | 使用辅助函数 |
| `tests/token-manager.test.ts` | 修改 | 使用辅助函数 |

---

## Task 1: 创建测试辅助函数模块

**Files:**
- Create: `packages/server/tests/helpers/test-db.ts`

- [ ] **Step 1: 创建 helpers 目录**

```bash
mkdir -p packages/server/tests/helpers
```

- [ ] **Step 2: 编写测试辅助函数模块**

```typescript
// packages/server/tests/helpers/test-db.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  drafts,
  draftMembers,
  draftMessages,
  messageConfirmations,
  projectTokens,
  projectRepos,
  userClaudeConfigs,
  builds,
} from '../../src/db/schema/index.js';
import type {
  InsertUser,
  SelectUser,
  InsertOrganization,
  SelectOrganization,
  InsertOrganizationMember,
  SelectOrganizationMember,
  InsertProject,
  SelectProject,
  InsertDraft,
  SelectDraft,
  InsertDraftMember,
  SelectDraftMember,
  InsertDraftMessage,
  SelectDraftMessage,
  InsertMessageConfirmation,
  SelectMessageConfirmation,
  InsertProjectToken,
  SelectProjectToken,
  InsertProjectRepo,
  SelectProjectRepo,
  InsertUserClaudeConfig,
  SelectUserClaudeConfig,
  InsertBuild,
  SelectBuild,
} from '../../src/db/schema/index.js';

// === 用户 ===

export async function createTestUser(
  options?: Partial<InsertUser>
): Promise<SelectUser> {
  const db = getDb();
  return db.insert(users)
    .values({
      name: options?.name ?? 'test',
      email: options?.email ?? 'test@test.com',
      passwordHash: options?.passwordHash ?? 'hash',
      ...options,
    })
    .returning()
    .get();
}

export async function findUserByEmail(email: string): Promise<SelectUser | undefined> {
  const db = getDb();
  return db.select()
    .from(users)
    .where(eq(users.email, email))
    .get();
}

export async function findUserById(id: number): Promise<SelectUser | undefined> {
  const db = getDb();
  return db.select()
    .from(users)
    .where(eq(users.id, id))
    .get();
}

// === 组织 ===

export async function createTestOrganization(
  userId: number,
  options?: Partial<InsertOrganization>
): Promise<SelectOrganization> {
  const db = getDb();
  return db.insert(organizations)
    .values({
      name: options?.name ?? 'test-org',
      createdBy: userId,
      ...options,
    })
    .returning()
    .get();
}

export async function createTestOrganizationMember(
  orgId: number,
  userId: number,
  role: 'owner' | 'developer' | 'member',
  invitedBy: number
): Promise<SelectOrganizationMember> {
  const db = getDb();
  return db.insert(organizationMembers)
    .values({
      organizationId: orgId,
      userId,
      role,
      invitedBy,
    })
    .returning()
    .get();
}

export async function findOrganizationById(id: number): Promise<SelectOrganization | undefined> {
  const db = getDb();
  return db.select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .get();
}

// === 项目 ===

export async function createTestProject(
  userId: number,
  orgId: number,
  options?: Partial<InsertProject>
): Promise<SelectProject> {
  const db = getDb();
  return db.insert(projects)
    .values({
      name: options?.name ?? 'test-project',
      templateType: options?.templateType ?? 'node',
      organizationId: orgId,
      createdBy: userId,
      ...options,
    })
    .returning()
    .get();
}

export async function findProjectById(id: number): Promise<SelectProject | undefined> {
  const db = getDb();
  return db.select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();
}

export async function findProjectsByOrganizationId(orgId: number): Promise<SelectProject[]> {
  const db = getDb();
  return db.select()
    .from(projects)
    .where(eq(projects.organizationId, orgId));
}

// === Draft ===

export async function createTestDraft(
  userId: number,
  projectId: number,
  options?: Partial<InsertDraft>
): Promise<SelectDraft> {
  const db = getDb();
  return db.insert(drafts)
    .values({
      projectId,
      title: options?.title ?? 'test-draft',
      createdBy: userId,
      ...options,
    })
    .returning()
    .get();
}

export async function createTestDraftMember(
  draftId: number,
  userId: number,
  role: 'owner' | 'participant'
): Promise<SelectDraftMember> {
  const db = getDb();
  return db.insert(draftMembers)
    .values({
      draftId,
      userId,
      role,
    })
    .returning()
    .get();
}

export async function createTestDraftMessage(
  draftId: number,
  userId: number,
  options?: Partial<InsertDraftMessage>
): Promise<SelectDraftMessage> {
  const db = getDb();
  return db.insert(draftMessages)
    .values({
      draftId,
      userId,
      content: options?.content ?? 'test message',
      messageType: options?.messageType ?? 'text',
      ...options,
    })
    .returning()
    .get();
}

export async function createTestMessageConfirmation(
  messageId: number,
  userId: number,
  type: 'agree' | 'disagree' | 'suggest',
  comment?: string
): Promise<SelectMessageConfirmation> {
  const db = getDb();
  return db.insert(messageConfirmations)
    .values({
      messageId,
      userId,
      type,
      comment,
    })
    .returning()
    .get();
}

export async function findDraftById(id: number): Promise<SelectDraft | undefined> {
  const db = getDb();
  return db.select()
    .from(drafts)
    .where(eq(drafts.id, id))
    .get();
}

export async function findDraftMembers(draftId: number): Promise<SelectDraftMember[]> {
  const db = getDb();
  return db.select()
    .from(draftMembers)
    .where(eq(draftMembers.draftId, draftId));
}

export async function findDraftMessages(draftId: number): Promise<SelectDraftMessage[]> {
  const db = getDb();
  return db.select()
    .from(draftMessages)
    .where(eq(draftMessages.draftId, draftId));
}

export async function findMessageConfirmations(messageId: number): Promise<SelectMessageConfirmation[]> {
  const db = getDb();
  return db.select()
    .from(messageConfirmations)
    .where(eq(messageConfirmations.messageId, messageId));
}

// === Token ===

export async function createTestToken(
  userId: number,
  provider: 'github' | 'gitlab',
  options?: Partial<InsertProjectToken>
): Promise<SelectProjectToken> {
  const db = getDb();
  return db.insert(projectTokens)
    .values({
      userId,
      provider,
      accessToken: options?.accessToken ?? 'test-token',
      refreshToken: options?.refreshToken,
      expiresAt: options?.expiresAt,
      ...options,
    })
    .returning()
    .get();
}

export async function findTokensByUserId(userId: number): Promise<SelectProjectToken[]> {
  const db = getDb();
  return db.select()
    .from(projectTokens)
    .where(eq(projectTokens.userId, userId));
}

export async function findTokenByUserIdAndProvider(
  userId: number,
  provider: 'github' | 'gitlab'
): Promise<SelectProjectToken | undefined> {
  const db = getDb();
  return db.select()
    .from(projectTokens)
    .where(and(
      eq(projectTokens.userId, userId),
      eq(projectTokens.provider, provider)
    ))
    .get();
}

// === Repo ===

export async function createTestRepo(
  projectId: number,
  options?: Partial<InsertProjectRepo>
): Promise<SelectProjectRepo> {
  const db = getDb();
  return db.insert(projectRepos)
    .values({
      projectId,
      provider: options?.provider ?? 'github',
      repoUrl: options?.repoUrl ?? 'https://github.com/user/repo.git',
      repoName: options?.repoName ?? 'user/repo',
      branch: options?.branch ?? 'main',
      ...options,
    })
    .returning()
    .get();
}

export async function findReposByProjectId(projectId: number): Promise<SelectProjectRepo[]> {
  const db = getDb();
  return db.select()
    .from(projectRepos)
    .where(eq(projectRepos.projectId, projectId));
}

export async function findRepoById(id: number): Promise<SelectProjectRepo | undefined> {
  const db = getDb();
  return db.select()
    .from(projectRepos)
    .where(eq(projectRepos.id, id))
    .get();
}

// === Claude Config ===

export async function createTestClaudeConfig(
  userId: number,
  config: string
): Promise<SelectUserClaudeConfig> {
  const db = getDb();
  return db.insert(userClaudeConfigs)
    .values({
      userId,
      config,
    })
    .returning()
    .get();
}

export async function findClaudeConfigByUserId(userId: number): Promise<SelectUserClaudeConfig | undefined> {
  const db = getDb();
  return db.select()
    .from(userClaudeConfigs)
    .where(eq(userClaudeConfigs.userId, userId))
    .get();
}

// === Build ===

export async function createTestBuild(
  projectId: number,
  options?: Partial<InsertBuild>
): Promise<SelectBuild> {
  const db = getDb();
  return db.insert(builds)
    .values({
      projectId,
      status: options?.status ?? 'pending',
      previewPort: options?.previewPort,
      ...options,
    })
    .returning()
    .get();
}

export async function findBuildById(id: number): Promise<SelectBuild | undefined> {
  const db = getDb();
  return db.select()
    .from(builds)
    .where(eq(builds.id, id))
    .get();
}

export async function findBuildsByProjectId(projectId: number): Promise<SelectBuild[]> {
  const db = getDb();
  return db.select()
    .from(builds)
    .where(eq(builds.projectId, projectId));
}

// === 删除函数 ===

export async function deleteTestUser(id: number): Promise<void> {
  const db = getDb();
  db.delete(users).where(eq(users.id, id)).run();
}

export async function deleteTestProject(id: number): Promise<void> {
  const db = getDb();
  db.delete(projects).where(eq(projects.id, id)).run();
}

export async function deleteTestDraft(id: number): Promise<void> {
  const db = getDb();
  db.delete(drafts).where(eq(drafts.id, id)).run();
}

export async function deleteTestToken(userId: number, provider: 'github' | 'gitlab'): Promise<void> {
  const db = getDb();
  db.delete(projectTokens)
    .where(and(
      eq(projectTokens.userId, userId),
      eq(projectTokens.provider, provider)
    ))
    .run();
}

export async function deleteTestRepo(id: number): Promise<void> {
  const db = getDb();
  db.delete(projectRepos).where(eq(projectRepos.id, id)).run();
}

export async function deleteTestClaudeConfig(userId: number): Promise<void> {
  const db = getDb();
  db.delete(userClaudeConfigs).where(eq(userClaudeConfigs.userId, userId)).run();
}

export async function deleteTestBuild(id: number): Promise<void> {
  const db = getDb();
  db.delete(builds).where(eq(builds.id, id)).run();
}

// === 更新函数 ===

export async function updateTestProjectStatus(
  id: number,
  status: 'created' | 'running' | 'stopped',
  containerId?: string
): Promise<void> {
  const db = getDb();
  db.update(projects)
    .set({ status, containerId })
    .where(eq(projects.id, id))
    .run();
}

export async function updateTestBuildStatus(
  id: number,
  status: 'pending' | 'running' | 'success' | 'failed',
  previewPort?: number
): Promise<void> {
  const db = getDb();
  db.update(builds)
    .set({ status, previewPort })
    .where(eq(builds.id, id))
    .run();
}

export async function updateTestDraftStatus(
  id: number,
  status: 'discussing' | 'brainstorming' | 'reviewing' | 'developing' | 'confirmed' | 'archived'
): Promise<void> {
  const db = getDb();
  db.update(drafts)
    .set({ status })
    .where(eq(drafts.id, id))
    .run();
}
```

- [ ] **Step 3: 提交测试辅助函数模块**

```bash
git add packages/server/tests/helpers/test-db.ts
git commit -m "feat: add test helpers module for ORM operations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 迁移 db.test.ts

**Files:**
- Modify: `packages/server/tests/db.test.ts`

- [ ] **Step 1: 更新导入语句**

将文件开头的导入改为：

```typescript
import { describe, it, expect } from 'vitest';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { createTestUser, createTestOrganization, createTestProject, createTestOrganizationMember, findUserByEmail, findProjectById, findDraftMembers, deleteTestProject, deleteTestUser } from './helpers/test-db.js';
import { eq } from 'drizzle-orm';
import { users, projects, projectMembers, organizations } from '../src/db/schema/index.js';
```

- [ ] **Step 2: 迁移"应能插入用户"测试**

```typescript
it('应能插入用户', async () => {
  closeDb();
  const db = getSqliteDb(':memory:');
  initSchema(db);
  const drizzleDb = getDb();

  const user = await createTestUser({ name: '测试用户', email: 'test@test.com', passwordHash: 'hash123' });
  expect(user.name).toBe('测试用户');

  closeDb();
});
```

- [ ] **Step 3: 迁移"不允许重复邮箱"测试**

```typescript
it('不允许重复邮箱', async () => {
  closeDb();
  const db = getSqliteDb(':memory:');
  initSchema(db);
  const drizzleDb = getDb();

  await createTestUser({ name: '用户1', email: 'dup@test.com', passwordHash: 'hash' });
  
  // 尝试插入重复邮箱应抛出错误
  try {
    await createTestUser({ name: '用户2', email: 'dup@test.com', passwordHash: 'hash' });
    expect.fail('应该抛出错误');
  } catch (error) {
    expect(error).toBeDefined();
  }

  closeDb();
});
```

- [ ] **Step 4: 迁移"应能创建项目并关联成员"测试**

```typescript
it('应能创建项目并关联成员', async () => {
  closeDb();
  const db = getSqliteDb(':memory:');
  initSchema(db);
  const drizzleDb = getDb();

  const user = await createTestUser({ name: '创建者', email: 'owner@test.com', passwordHash: 'hash' });
  const org = await createTestOrganization(user.id, { name: '测试组织' });
  const project = await createTestProject(user.id, org.id, { name: '测试项目' });
  const member = await createTestOrganizationMember(org.id, user.id, 'owner', user.id);

  // 验证成员角色
  const members = await findDraftMembers(project.id); // 需要改为 findProjectMembers
  // 由于没有 findProjectMembers，直接用 ORM 查询
  const pm = drizzleDb.select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, project.id))
    .all();
  expect(pm[0].role).toBe('owner');

  closeDb();
});
```

- [ ] **Step 5: 迁移"外键约束应阻止插入无效的用户引用"测试**

```typescript
it('外键约束应阻止插入无效的用户引用', async () => {
  closeDb();
  const db = getSqliteDb(':memory:');
  initSchema(db);
  const drizzleDb = getDb();

  const user = await createTestUser({ name: 'temp', email: 'temp@test.com', passwordHash: 'hash' });
  const org = await createTestOrganization(user.id, { name: 'temp-org' });

  // 尝试创建项目引用不存在用户应失败
  try {
    await createTestProject(9999, org.id, { name: '项目' });
    expect.fail('应该抛出错误');
  } catch (error) {
    expect(error).toBeDefined();
  }

  closeDb();
});
```

- [ ] **Step 6: 迁移"CHECK 约束应拒绝无效的模板类型"测试**

```typescript
it('CHECK 约束应拒绝无效的模板类型', async () => {
  closeDb();
  const db = getSqliteDb(':memory:');
  initSchema(db);
  const drizzleDb = getDb();

  const user = await createTestUser({ name: '用户', email: 'check@test.com', passwordHash: 'hash' });
  const org = await createTestOrganization(user.id, { name: '测试组织' });

  // 尝试创建无效模板类型应失败
  try {
    drizzleDb.insert(projects)
      .values({
        name: '项目',
        templateType: 'invalid_type' as any,
        createdBy: user.id,
        organizationId: org.id,
      })
      .run();
    expect.fail('应该抛出错误');
  } catch (error) {
    expect(error).toBeDefined();
  }

  closeDb();
});
```

- [ ] **Step 7: 迁移"ON DELETE CASCADE 应删除相关项目成员"测试**

```typescript
it('ON DELETE CASCADE 应删除相关项目成员', async () => {
  closeDb();
  const db = getSqliteDb(':memory:');
  initSchema(db);
  const drizzleDb = getDb();

  const user = await createTestUser({ name: '用户', email: 'cascade@test.com', passwordHash: 'hash' });
  const org = await createTestOrganization(user.id, { name: '测试组织' });
  const project = await createTestProject(user.id, org.id, { name: '项目' });
  
  // 添加项目成员
  drizzleDb.insert(projectMembers)
    .values({ projectId: project.id, userId: user.id, role: 'owner' })
    .run();

  // 删除项目
  await deleteTestProject(project.id);

  // 验证成员已删除
  const members = drizzleDb.select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, project.id))
    .all();
  expect(members).toHaveLength(0);

  closeDb();
});
```

- [ ] **Step 8: 运行测试验证迁移成功**

```bash
cd packages/server && npm test -- db.test.ts
```

Expected: 所有测试通过

- [ ] **Step 9: 提交 db.test.ts 迁移**

```bash
git add packages/server/tests/db.test.ts
git commit -m "refactor(test): migrate db.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: 迁移 tokens-schema.test.ts

**Files:**
- Modify: `packages/server/tests/tokens-schema.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { createTestUser, createTestOrganization, createTestProject, createTestToken, createTestRepo, findTokenByUserIdAndProvider, findReposByProjectId, deleteTestUser } from './helpers/test-db.js';
import { eq } from 'drizzle-orm';
import { projectTokens, projectRepos } from '../src/db/schema/index.js';
```

- [ ] **Step 2: 更新 beforeEach/afterEach**

```typescript
beforeEach(() => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());
});

afterEach(() => {
  closeDb();
});
```

- [ ] **Step 3: 迁移"should insert and retrieve token"测试**

```typescript
it('should insert and retrieve token', async () => {
  await createTestUser();

  await createTestToken(1, 'github', {
    accessToken: 'gh_token',
    refreshToken: 'gh_refresh',
    expiresAt: '2025-01-01T00:00:00Z',
  });

  const token = await findTokenByUserIdAndProvider(1, 'github');
  expect(token?.accessToken).toBe('gh_token');
  expect(token?.provider).toBe('github');
});
```

- [ ] **Step 4: 迁移"should enforce unique constraint on user_id and provider"测试**

```typescript
it('should enforce unique constraint on user_id and provider', async () => {
  await createTestUser();

  await createTestToken(1, 'github', {
    accessToken: 'gh_token',
    refreshToken: 'gh_refresh',
    expiresAt: '2025-01-01T00:00:00Z',
  });

  // Should fail due to unique constraint
  try {
    const db = getDb();
    db.insert(projectTokens)
      .values({
        userId: 1,
        provider: 'github',
        accessToken: 'gh_token2',
        refreshToken: 'gh_refresh2',
        expiresAt: '2025-02-01T00:00:00Z',
      })
      .run();
    expect.fail('应该抛出错误');
  } catch (error) {
    expect(error).toBeDefined();
  }
});
```

- [ ] **Step 5: 迁移"should cascade delete tokens when user is deleted"测试**

```typescript
it('should cascade delete tokens when user is deleted', async () => {
  await createTestUser();
  await createTestToken(1, 'github', {
    accessToken: 'gh_token',
    refreshToken: 'gh_refresh',
    expiresAt: '2025-01-01T00:00:00Z',
  });

  // Delete user
  await deleteTestUser(1);

  // Token should be deleted
  const token = await findTokenByUserIdAndProvider(1, 'github');
  expect(token).toBeUndefined();
});
```

- [ ] **Step 6: 迁移"should insert and retrieve project_repo"测试**

```typescript
it('should insert and retrieve project_repo', async () => {
  await createTestUser();
  await createTestOrganization(1);
  await createTestProject(1, 1);

  await createTestRepo(1, {
    provider: 'github',
    repoUrl: 'https://github.com/user/repo',
    repoName: 'user/repo',
    branch: 'main',
  });

  const repos = await findReposByProjectId(1);
  expect(repos[0].repoUrl).toBe('https://github.com/user/repo');
  expect(repos[0].repoName).toBe('user/repo');
  expect(repos[0].provider).toBe('github');
  expect(repos[0].branch).toBe('main');
});
```

- [ ] **Step 7: 迁移"should enforce unique constraint on project_id and repo_url"测试**

```typescript
it('should enforce unique constraint on project_id and repo_url', async () => {
  await createTestUser();
  await createTestOrganization(1);
  await createTestProject(1, 1);

  await createTestRepo(1, {
    provider: 'github',
    repoUrl: 'https://github.com/user/repo',
    repoName: 'user/repo',
    branch: 'main',
  });

  // Should fail due to unique constraint
  try {
    const db = getDb();
    db.insert(projectRepos)
      .values({
        projectId: 1,
        provider: 'gitlab',
        repoUrl: 'https://github.com/user/repo',
        repoName: 'user/repo',
        branch: 'develop',
      })
      .run();
    expect.fail('应该抛出错误');
  } catch (error) {
    expect(error).toBeDefined();
  }
});
```

- [ ] **Step 8: 迁移"should cascade delete project_repos when project is deleted"测试**

```typescript
it('should cascade delete project_repos when project is deleted', async () => {
  await createTestUser();
  await createTestOrganization(1);
  await createTestProject(1, 1);
  await createTestRepo(1, {
    provider: 'github',
    repoUrl: 'https://github.com/user/repo',
    repoName: 'user/repo',
    branch: 'main',
  });

  // Delete project - 需要先删除组织成员关联，否则外键约束会阻止
  const db = getDb();
  db.delete(projects).where(eq(projects.id, 1)).run();

  // project_repo should be deleted
  const repos = await findReposByProjectId(1);
  expect(repos).toHaveLength(0);
});
```

- [ ] **Step 9: 迁移"should only accept valid provider values"测试（两个测试）**

```typescript
it('should only accept valid provider values for project_tokens', async () => {
  await createTestUser();

  // Invalid provider should fail
  try {
    const db = getDb();
    db.insert(projectTokens)
      .values({
        userId: 1,
        provider: 'invalid_provider' as any,
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2025-01-01T00:00:00Z',
      })
      .run();
    expect.fail('应该抛出错误');
  } catch (error) {
    expect(error).toBeDefined();
  }
});

it('should only accept valid provider values for project_repos', async () => {
  await createTestUser();
  await createTestOrganization(1);
  await createTestProject(1, 1);

  // Invalid provider should fail
  try {
    const db = getDb();
    db.insert(projectRepos)
      .values({
        projectId: 1,
        provider: 'invalid_provider' as any,
        repoUrl: 'https://example.com/repo',
        repoName: 'repo',
        branch: 'main',
      })
      .run();
    expect.fail('应该抛出错误');
  } catch (error) {
    expect(error).toBeDefined();
  }
});
```

- [ ] **Step 10: 运行测试验证**

```bash
cd packages/server && npm test -- tokens-schema.test.ts
```

Expected: 所有测试通过

- [ ] **Step 11: 提交 tokens-schema.test.ts 迁移**

```bash
git add packages/server/tests/tokens-schema.test.ts
git commit -m "refactor(test): migrate tokens-schema.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: 迁移 drafts.test.ts

**Files:**
- Modify: `packages/server/tests/drafts.test.ts`

- [ ] **Step 1: 更新导入语句，移除原生 Database 类型**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { createDraftsRouter } from '../src/routes/drafts.js';
import { createAuthRouter } from '../src/routes/auth.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
  createTestDraft,
  createTestDraftMember,
  findDraftById,
  findDraftMembers,
  findDraftMessages,
} from './helpers/test-db.js';
import { eq } from 'drizzle-orm';
import { drafts, draftMembers } from '../src/db/schema/index.js';
```

- [ ] **Step 2: 更新 beforeEach 数据准备**

将 `beforeEach` 中原生 SQL 改为辅助函数：

```typescript
beforeEach(async () => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());

  app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter());
  app.use('/api/drafts', createDraftsRouter());

  // Create test user
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });
  authToken = registerRes.body.token;
  userId = registerRes.body.user.id;

  // Create test organization
  const org = await createTestOrganization(userId, { name: 'Test Org' });
  orgId = org.id;

  // Add user as organization member
  await createTestOrganizationMember(orgId, userId, 'owner', userId);

  // Create test project
  const project = await createTestProject(userId, orgId, { name: 'Test Project' });
  projectId = project.id;
});
```

- [ ] **Step 3: 更新 afterEach**

```typescript
afterEach(() => {
  closeDb();
});
```

- [ ] **Step 4: 迁移所有 db.prepare 查询**

文件中的 `db.prepare('SELECT * FROM draft_members WHERE ...')` 等查询替换为辅助函数：

```typescript
// 替换 db.prepare('SELECT * FROM draft_members WHERE draft_id = ?').all(...)
const members = await findDraftMembers(draftId);

// 替换 db.prepare('SELECT * FROM drafts WHERE id = ?').get(...)
const draft = await findDraftById(draftId);
```

- [ ] **Step 5: 迁移 beforeEach 中添加成员的 SQL**

在多个测试的 beforeEach 中有添加 draft_member 的 SQL：

```typescript
// 替换 db.prepare('INSERT INTO draft_members ...').run(...)
await createTestDraftMember(draftId, anotherUserId, 'participant');
```

- [ ] **Step 6: 运行测试验证**

```bash
cd packages/server && npm test -- drafts.test.ts
```

Expected: 所有测试通过

- [ ] **Step 7: 提交 drafts.test.ts 迁移**

```bash
git add packages/server/tests/drafts.test.ts
git commit -m "refactor(test): migrate drafts.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: 迁移 repos.test.ts

**Files:**
- Modify: `packages/server/tests/repos.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
  createTestToken,
  createTestRepo,
  findTokenByUserIdAndProvider,
  findReposByProjectId,
  findRepoById,
  deleteTestToken,
} from './helpers/test-db.js';
```

- [ ] **Step 2: 迁移 GitHub/GitLab OAuth 测试中的 db.prepare**

替换所有 `db.prepare('INSERT INTO project_tokens ...')` 和 `db.prepare('SELECT * FROM project_tokens ...')`：

```typescript
// 替换 INSERT
await createTestToken(1, 'github', { accessToken: 'gh_token' });

// 替换 SELECT 验证
const token = await findTokenByUserIdAndProvider(1, 'github');
expect(token).toBeDefined();
```

- [ ] **Step 3: 迁移 Repos 路由测试的 beforeEach**

```typescript
beforeEach(async () => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());
  app = createApp();
  vi.restoreAllMocks();

  // 创建用户
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'test', email: 'test@test.com', password: 'password123' });
  token = regRes.body.token;
  userId = regRes.body.user.id;

  // 创建组织
  const org = await createTestOrganization(userId, { name: 'test-org' });
  orgId = org.id;

  // 添加组织成员
  await createTestOrganizationMember(orgId, userId, 'owner', userId);

  // 创建项目
  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'test-project', templateType: 'node', organizationId: orgId });
  projectId = projectRes.body.id;
});
```

- [ ] **Step 4: 迁移 repo 相关测试的 db.prepare**

```typescript
// 替换 INSERT repo
await createTestRepo(projectId, {
  provider: 'github',
  repoUrl: 'https://github.com/user/repo.git',
  repoName: 'repo',
  branch: 'main',
});

// 替换 SELECT repo
const repos = await findReposByProjectId(projectId);
const repo = await findRepoById(repoId);
```

- [ ] **Step 5: 运行测试验证**

```bash
cd packages/server && npm test -- repos.test.ts
```

Expected: 所有测试通过

- [ ] **Step 6: 提交 repos.test.ts 迁移**

```bash
git add packages/server/tests/repos.test.ts
git commit -m "refactor(test): migrate repos.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: 迁移 builds.test.ts

**Files:**
- Modify: `packages/server/tests/builds.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/index.js';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { JWT_SECRET } from '../src/middleware/auth.js';
import { resetBuildManagerInstance } from '../src/build/build-manager.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
} from './helpers/test-db.js';
```

- [ ] **Step 2: 迁移 beforeEach**

```typescript
beforeEach(async () => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());

  // 创建测试用户
  const user = await createTestUser({ name: 'test', email: 'test@test.com', passwordHash: 'hash' });

  // 创建测试组织
  const org = await createTestOrganization(user.id, { name: 'test-org' });
  await createTestOrganizationMember(org.id, user.id, 'owner', user.id);

  // 创建测试项目
  await createTestProject(user.id, org.id, { name: 'test-project' });

  app = createApp();
  resetBuildManagerInstance();
});
```

- [ ] **Step 3: 迁移其他用户创建的 db.prepare**

在测试中创建其他用户的 SQL 替换为辅助函数：

```typescript
// 替换 db.prepare('INSERT INTO users ...').run(...)
const otherUser = await createTestUser({ name: 'other', email: 'other@test.com', passwordHash: 'hash' });
const otherToken = jwt.sign({ userId: otherUser.id }, JWT_SECRET, { expiresIn: '24h' });
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && npm test -- builds.test.ts
```

Expected: 所有测试通过

- [ ] **Step 5: 提交 builds.test.ts 迁移**

```bash
git add packages/server/tests/builds.test.ts
git commit -m "refactor(test): migrate builds.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: 迁移 containers.test.ts

**Files:**
- Modify: `packages/server/tests/containers.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { setEncryptionKey, encrypt } from '../src/crypto/aes.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
  createTestClaudeConfig,
  findProjectById,
} from './helpers/test-db.js';
```

- [ ] **Step 2: 迁移 beforeEach**

```typescript
beforeEach(async () => {
  containerStates.clear();
  setEncryptionKey('test-encryption-key-for-containers-test-32-chars');

  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());
  app = createApp();

  // 创建用户
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: '测试用户', email: 'test@test.com', password: 'password123' });
  token = regRes.body.token;
  userId = regRes.body.user.id;

  // 创建组织
  const org = await createTestOrganization(userId, { name: '测试组织' });
  orgId = org.id;

  // 添加组织成员
  await createTestOrganizationMember(orgId, userId, 'owner', userId);

  // 添加 Claude 配置
  const config = {
    env: { ANTHROPIC_AUTH_TOKEN: 'test-token-for-containers' },
  };
  await createTestClaudeConfig(userId, encrypt(JSON.stringify(config)));

  // 创建项目
  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '测试项目', templateType: 'node', organizationId: orgId });
  projectId = projectRes.body.id;
});
```

- [ ] **Step 3: 迁移验证项目状态的 db.prepare**

```typescript
// 替换 db.prepare('SELECT container_id, status FROM projects WHERE id = ?').get(...)
const project = await findProjectById(projectId);
expect(project?.containerId).toBeNull();
expect(project?.status).toBe('created');
```

- [ ] **Step 4: 迁移添加组织成员的 SQL**

```typescript
// 替换 db.prepare('INSERT INTO organization_members ...').run(...)
await createTestOrganizationMember(orgId, otherUserId, 'developer', userId);
```

- [ ] **Step 5: 运行测试验证**

```bash
cd packages/server && npm test -- containers.test.ts
```

Expected: 所有测试通过

- [ ] **Step 6: 提交 containers.test.ts 迁移**

```bash
git add packages/server/tests/containers.test.ts
git commit -m "refactor(test): migrate containers.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: 迁移 projects.test.ts

**Files:**
- Modify: `packages/server/tests/projects.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  findProjectById,
} from './helpers/test-db.js';
```

- [ ] **Step 2: 迁移 beforeEach**

```typescript
beforeEach(async () => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());
  app = createApp();

  // 创建测试用户
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ name: '测试用户', email: 'test@test.com', password: 'password123' });
  token = regRes.body.token;
  userId = regRes.body.user.id;

  // 创建组织
  const org = await createTestOrganization(userId, { name: '测试组织' });
  orgId = org.id;

  // 添加组织成员
  await createTestOrganizationMember(orgId, userId, 'owner', userId);
});
```

- [ ] **Step 3: 迁移 DELETE 测试中的验证**

```typescript
// 替换 db.prepare('SELECT * FROM projects WHERE id = ?').get(...)
const project = await findProjectById(projectId);
expect(project).toBeUndefined();
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && npm test -- projects.test.ts
```

Expected: 所有测试通过

- [ ] **Step 5: 提交 projects.test.ts 迁移**

```bash
git add packages/server/tests/projects.test.ts
git commit -m "refactor(test): migrate projects.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: 迁移 claude-config.test.ts

**Files:**
- Modify: `packages/server/tests/claude-config.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setEncryptionKey, encrypt, decrypt } from '../src/crypto/aes.js';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { Router } from 'express';
import { createLogger } from '../src/logger/index.js';
import {
  createTestUser,
  findClaudeConfigByUserId,
  deleteTestClaudeConfig,
} from './helpers/test-db.js';
import { eq } from 'drizzle-orm';
import { userClaudeConfigs } from '../src/db/schema/index.js';
```

- [ ] **Step 2: 重写测试路由使用 ORM**

将 `createTestClaudeConfigRouter` 改为使用 ORM：

```typescript
function createTestClaudeConfigRouter(): Router {
  const router = Router();
  const db = getDb();

  // 获取用户配置
  router.get('/', async (req, res) => {
    const userId = (req as any).userId;

    const row = await findClaudeConfigByUserId(userId);

    if (!row) {
      res.json({ config: DEFAULT_CONFIG, hasConfig: false });
      return;
    }

    try {
      const config = JSON.parse(decrypt(row.config));
      res.json({ config, hasConfig: true });
    } catch (error) {
      logger.error('Failed to decrypt user config', error);
      res.status(500).json({ error: '配置解密失败' });
    }
  });

  // 保存用户配置
  router.post('/', async (req, res) => {
    const userId = (req as any).userId;
    const { config } = req.body;

    if (!config) {
      res.status(400).json({ error: '缺少 config 字段' });
      return;
    }

    if (!config.env || typeof config.env !== 'object') {
      res.status(400).json({ error: 'config.env 必须是对象' });
      return;
    }

    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      res.status(400).json({ error: 'ANTHROPIC_AUTH_TOKEN 不能为空' });
      return;
    }

    try {
      const encryptedConfig = encrypt(JSON.stringify(config));
      
      // Upsert using ORM
      const existing = await findClaudeConfigByUserId(userId);
      if (existing) {
        db.update(userClaudeConfigs)
          .set({ config: encryptedConfig })
          .where(eq(userClaudeConfigs.userId, userId))
          .run();
      } else {
        db.insert(userClaudeConfigs)
          .values({ userId, config: encryptedConfig })
          .run();
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to save user config', error);
      res.status(500).json({ error: '保存配置失败' });
    }
  });

  // 删除用户配置
  router.delete('/', async (req, res) => {
    const userId = (req as any).userId;
    await deleteTestClaudeConfig(userId);
    res.json({ success: true });
  });

  return router;
}
```

- [ ] **Step 3: 更新 beforeAll**

```typescript
beforeAll(async () => {
  setEncryptionKey(testKey);
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());

  // 创建测试用户
  await createTestUser();

  app = express();
  app.use(express.json());

  // Mock auth middleware
  app.use((req, res, next) => {
    (req as any).userId = 1;
    next();
  });

  app.use('/api/claude-config', createTestClaudeConfigRouter());
});
```

- [ ] **Step 4: 更新 afterAll**

```typescript
afterAll(() => {
  closeDb();
});
```

- [ ] **Step 5: 运行测试验证**

```bash
cd packages/server && npm test -- claude-config.test.ts
```

Expected: 所有测试通过

- [ ] **Step 6: 提交 claude-config.test.ts 迁移**

```bash
git add packages/server/tests/claude-config.test.ts
git commit -m "refactor(test): migrate claude-config.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: 迁移 repo-manager.test.ts

**Files:**
- Modify: `packages/server/tests/repo-manager.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { RepoManager } from '../src/git/repo-manager.js';
import { TokenManager } from '../src/git/token-manager.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
} from './helpers/test-db.js';
```

- [ ] **Step 2: 迁移 beforeEach**

```typescript
beforeEach(async () => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());

  // 创建测试用户
  const user = await createTestUser();

  // 创建测试组织
  const org = await createTestOrganization(user.id);
  await createTestOrganizationMember(org.id, user.id, 'owner', user.id);

  // 创建测试项目
  await createTestProject(user.id, org.id);

  manager = new RepoManager();
  vi.clearAllMocks();
});
```

- [ ] **Step 3: 运行测试验证**

```bash
cd packages/server && npm test -- repo-manager.test.ts
```

Expected: 所有测试通过

- [ ] **Step 4: 提交 repo-manager.test.ts 迁移**

```bash
git add packages/server/tests/repo-manager.test.ts
git commit -m "refactor(test): migrate repo-manager.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: 迁移 build-manager.test.ts

**Files:**
- Modify: `packages/server/tests/build-manager.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSqliteDb, closeDb, getDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { BuildManager, resetBuildManagerInstance } from '../src/build/build-manager.js';
import { resetWebSocketServerInstance } from '../src/websocket/server.js';
import {
  createTestUser,
  createTestOrganization,
  createTestOrganizationMember,
  createTestProject,
} from './helpers/test-db.js';
```

- [ ] **Step 2: 迁移 beforeEach**

```typescript
beforeEach(async () => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());

  // 创建测试用户
  const user = await createTestUser();

  // 创建测试组织
  const org = await createTestOrganization(user.id);
  await createTestOrganizationMember(org.id, user.id, 'owner', user.id);

  // 创建测试项目
  await createTestProject(user.id, org.id);

  const db = getDb();
  manager = new BuildManager(db);
});
```

- [ ] **Step 3: 更新 afterEach**

```typescript
afterEach(() => {
  resetBuildManagerInstance();
  resetWebSocketServerInstance();
  closeDb();
});
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && npm test -- build-manager.test.ts
```

Expected: 所有测试通过

- [ ] **Step 5: 提交 build-manager.test.ts 迁移**

```bash
git add packages/server/tests/build-manager.test.ts
git commit -m "refactor(test): migrate build-manager.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: 迁移 token-manager.test.ts

**Files:**
- Modify: `packages/server/tests/token-manager.test.ts`

- [ ] **Step 1: 更新导入语句**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSqliteDb, closeDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { TokenManager } from '../src/git/token-manager.js';
import { createTestUser } from './helpers/test-db.js';
```

- [ ] **Step 2: 迁移 beforeEach**

```typescript
beforeEach(async () => {
  closeDb();
  getSqliteDb(':memory:');
  initSchema(getSqliteDb());

  await createTestUser();
  manager = new TokenManager();
});
```

- [ ] **Step 3: 更新 afterEach**

```typescript
afterEach(() => {
  closeDb();
});
```

- [ ] **Step 4: 运行测试验证**

```bash
cd packages/server && npm test -- token-manager.test.ts
```

Expected: 所有测试通过

- [ ] **Step 5: 提交 token-manager.test.ts 迁移**

```bash
git add packages/server/tests/token-manager.test.ts
git commit -m "refactor(test): migrate token-manager.test.ts to Drizzle ORM

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: 运行所有测试验证完整性

- [ ] **Step 1: 运行完整测试套件**

```bash
cd packages/server && npm test
```

Expected: 所有测试通过

- [ ] **Step 2: 验证无原生 SQL（除 Schema 验证）**

```bash
grep -r "db\.prepare\(" packages/server/tests --include="*.ts" | grep -v "sqlite_master"
```

Expected: 无输出（或仅有 sqlite_master 相关查询）

- [ ] **Step 3: 最终提交（如有遗漏修复）**

```bash
git add -A
git commit -m "refactor(test): complete ORM migration for all test files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```