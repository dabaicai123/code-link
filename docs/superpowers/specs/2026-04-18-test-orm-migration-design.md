# 测试用例 ORM 迁移设计

## 背景

项目使用 Drizzle ORM 作为数据库层，但测试文件中有 110 处 `db.prepare()` 原生 SQL 调用，分布在 11 个测试文件中。需要将所有测试迁移到使用 Drizzle ORM。

## 目标

- 将所有测试中的原生 SQL 数据操作迁移到 Drizzle ORM
- 保持测试的可读性和可维护性
- 复用现有的 Repository 层代码

## 设计决策

### 1. Schema 验证测试保留原生 SQL

`db.test.ts` 和 `tokens-schema.test.ts` 中验证表结构、约束、外键的测试，保留使用 `sqlite_master` 原生查询。原因：

- 这些测试验证的是数据库 Schema 定义本身，不是业务逻辑
- 表存在性检查没有对应的 ORM 操作

数据操作部分（INSERT/SELECT/UPDATE/DELETE）改用 ORM。

### 2. 测试辅助函数位置

创建 `packages/server/tests/helpers/test-db.ts`，封装常用测试数据操作。

### 3. 迁移策略

- **API 路由测试**：使用测试辅助函数准备测试数据
- **Schema 验证测试**：表存在性检查保留原生 SQL，数据操作改用 ORM
- **不涉及数据库的测试**：无需迁移（如 `oauth.test.ts`, `templates.test.ts`, `channels.test.ts`）

## 测试辅助函数设计

### 文件位置

`packages/server/tests/helpers/test-db.ts`

### 函数列表

#### 数据创建函数

```typescript
// 用户
createTestUser(db: ReturnType<typeof getDb>, options?: Partial<InsertUser>): Promise<SelectUser>

// 组织
createTestOrganization(db: ReturnType<typeof getDb>, userId: number, options?: Partial<InsertOrganization>): Promise<SelectOrganization>
createTestOrganizationMember(db: ReturnType<typeof getDb>, orgId: number, userId: number, role: 'owner' | 'developer' | 'member', invitedBy: number): Promise<SelectOrganizationMember>

// 项目
createTestProject(db: ReturnType<typeof getDb>, userId: number, orgId: number, options?: Partial<InsertProject>): Promise<SelectProject>

// Draft
createTestDraft(db: ReturnType<typeof getDb>, userId: number, projectId: number, options?: Partial<InsertDraft>): Promise<SelectDraft>
createTestDraftMember(db: ReturnType<typeof getDb>, draftId: number, userId: number, role: 'owner' | 'participant'): Promise<SelectDraftMember>
createTestDraftMessage(db: ReturnType<typeof getDb>, draftId: number, userId: number, options?: Partial<InsertDraftMessage>): Promise<SelectDraftMessage>

// Token
createTestToken(db: ReturnType<typeof getDb>, userId: number, provider: 'github' | 'gitlab', options?: Partial<InsertProjectToken>): Promise<SelectProjectToken>

// Repo
createTestRepo(db: ReturnType<typeof getDb>, projectId: number, options?: Partial<InsertProjectRepo>): Promise<SelectProjectRepo>

// Claude Config
createTestClaudeConfig(db: ReturnType<typeof getDb>, userId: number, config: string): Promise<SelectUserClaudeConfig>

// Build
createTestBuild(db: ReturnType<typeof getDb>, projectId: number, options?: Partial<InsertBuild>): Promise<SelectBuild>
```

#### 数据查询函数

```typescript
// 用于验证测试结果
findUserByEmail(db: ReturnType<typeof getDb>, email: string): Promise<SelectUser | undefined>
findProjectById(db: ReturnType<typeof getDb>, id: number): Promise<SelectProject | undefined>
findDraftMembers(db: ReturnType<typeof getDb>, draftId: number): Promise<SelectDraftMember[]>
findTokensByUserId(db: ReturnType<typeof getDb>, userId: number): Promise<SelectProjectToken[]>
findReposByProjectId(db: ReturnType<typeof getDb>, projectId: number): Promise<SelectProjectRepo[]>
```

## 测试文件迁移清单

| 文件 | 原生 SQL 数量 | 迁移方式 |
|------|--------------|----------|
| `db.test.ts` | 28 | Schema 验证保留原生 SQL，数据操作改用 ORM |
| `tokens-schema.test.ts` | 34 | Schema 验证保留原生 SQL，数据操作改用 ORM |
| `drafts.test.ts` | 11 | 使用测试辅助函数 |
| `repos.test.ts` | 11 | 使用测试辅助函数 |
| `builds.test.ts` | 9 | 使用测试辅助函数 |
| `containers.test.ts` | 3 | 使用测试辅助函数 |
| `projects.test.ts` | 2 | 使用测试辅助函数 |
| `claude-config.test.ts` | 3 | 使用测试辅助函数 |
| `repo-manager.test.ts` | 4 | 使用测试辅助函数 |
| `build-manager.test.ts` | 4 | 使用测试辅助函数 |
| `token-manager.test.ts` | 1 | 使用测试辅助函数 |

**无需迁移的文件：**
- `oauth.test.ts` - 不涉及数据库
- `templates.test.ts` - 不涉及数据库
- `channels.test.ts` - 不涉及数据库

## 数据库初始化模式

所有测试统一使用以下模式：

```typescript
import { getDb, closeDb } from '../src/db/index.js';

beforeEach(() => {
  closeDb();
  getDb(':memory:');
});

afterEach(() => {
  closeDb();
});
```

## 代码风格

- 使用 Drizzle ORM 的链式 API：`db.insert().values().returning().get()`
- 使用 `eq`, `and`, `or` 等条件构建器
- 使用 schema 导出的类型：`InsertUser`, `SelectUser` 等

## 验证标准

- 所有测试通过
- 无 `db.prepare()` 调用（Schema 验证测试中的表存在性检查除外）
- 测试逻辑与迁移前一致
