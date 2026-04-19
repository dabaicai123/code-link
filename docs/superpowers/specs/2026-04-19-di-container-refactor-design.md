# 后端架构重构：使用 TSyringe DI 容器

## 背景

当前后端架构存在以下问题：

1. **依赖管理混乱**：每个 Service/Repository 方法内部创建依赖实例
2. **实例重复创建**：`new UserRepository()` 在多处重复调用
3. **测试困难**：无法注入 mock 依赖，单元测试必须依赖真实数据库
4. **权限逻辑重复**：`ROLE_HIERARCHY` 在 auth.ts 和 PermissionService 中重复定义
5. **数据库连接分散**：connection.ts 和 drizzle.ts 都有单例管理逻辑
6. **错误处理不一致**：部分路由使用 `handleRouteError`，部分使用字符串匹配

## 设计目标

- 统一依赖管理，支持依赖注入
- 简化测试，支持 mock 替换
- 统一错误处理和权限逻辑
- 使用 TSyringe 轻量 DI 库，减少手写代码

## 技术选型：TSyringe

选择 TSyringe 的原因：
- 微软官方维护，轻量级
- 使用装饰器语法，代码简洁
- 支持 `@singleton()` 自动管理单例
- 测试友好，`container.reset()` + 注册 mock
- 与 TypeScript 完美集成

## 架构设计

### 1. 安装依赖

```bash
npm install tsyringe reflect-metadata
```

### 2. TypeScript 配置

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    // 其他配置...
  }
}
```

### 3. 应用入口导入 reflect-metadata

```typescript
// src/index.ts（最顶部）
import "reflect-metadata";
```

### 4. Repository 改造

使用 `@singleton()` 装饰器，数据库连接保持 getDb() 单例：

```typescript
// repositories/user.repository.ts
import { singleton } from "tsyringe";
import { getDb } from "../db/index.js";
import { users } from "../db/schema/index.js";
import type { InsertUser, SelectUser } from "../db/schema/index.js";

@singleton()
export class UserRepository {
  async findByEmail(email: string): Promise<SelectUser | undefined> {
    return getDb().select().from(users).where(eq(users.email, email)).get();
  }

  async findById(id: number): Promise<SelectUser | undefined> {
    return getDb().select().from(users).where(eq(users.id, id)).get();
  }

  async create(data: InsertUser): Promise<SelectUser> {
    return getDb().insert(users).values(data).returning().get();
  }
}
```

### 5. Service 改造

使用 `@singleton()` + 构造函数注入：

```typescript
// services/auth.service.ts
import { singleton, inject } from "tsyringe";
import { UserRepository } from "../repositories/user.repository.js";

@singleton()
export class AuthService {
  constructor(
    @inject(UserRepository) private userRepo: UserRepository
  ) {}

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('该邮箱已被注册');
    }
    // ...
  }

  async login(data: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(data.email);
    // ...
  }
}
```

### 6. 路由层改造

使用 `container.resolve()` 获取 Service 实例：

```typescript
// routes/auth.ts
import "reflect-metadata";
import { container } from "tsyringe";
import { Router } from "express";
import { AuthService } from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { success, Errors, handleRouteError } from "../utils/response.js";
import { createLogger } from "../logger/index.js";

const logger = createLogger('auth');

export function createAuthRouter(): Router {
  const router = Router();
  const authService = container.resolve(AuthService);

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(success(result));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '注册失败');
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const result = await authService.login(req.body);
      res.json(success(result));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '登录失败');
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
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取用户信息失败');
    }
  });

  return router;
}
```

### 7. Middleware 改造

```typescript
// middleware/auth.ts
import "reflect-metadata";
import { container } from "tsyringe";
import { UserRepository, OrganizationRepository, ProjectRepository } from "../repositories/index.js";
import { PermissionService } from "../services/permission.service.js";

// 单例实例通过容器获取
const userRepo = container.resolve(UserRepository);
const orgRepo = container.resolve(OrganizationRepository);
const permService = container.resolve(PermissionService);

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // ... 现有逻辑不变，使用 userRepo/permService
}

export function createOrgMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 使用 permService 检查权限
    await permService.checkOrgRole(userId, orgId, minRole);
    next();
  };
}
```

### 8. 统一权限层级

移除 auth.ts 中的 `ROLE_HIERARCHY`，提取为公共常量：

```typescript
// utils/roles.ts
import type { OrgRole } from "../db/schema/index.js";

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};

export function hasRole(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
```

PermissionService 和 middleware 都使用这个常量。

### 9. 统一错误处理

所有路由统一使用 `handleRouteError`，移除字符串匹配方式。

drafts.ts 改造示例：

```typescript
// routes/drafts.ts（改造后）
router.post('/', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const draft = await draftService.create(userId, req.body);
    res.status(201).json(success({ draft }));
  } catch (error: unknown) {
    handleRouteError(res, error, logger, '创建 Draft 失败');
  }
});
```

### 10. 数据库连接统一

合并 connection.ts 和 drizzle.ts：

```typescript
// db/drizzle.ts（保留，删除 connection.ts）
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema/index.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");

let defaultSqliteDb: Database.Database | null = null;
let defaultDb: ReturnType<typeof drizzle> | null = null;

export function getSqliteDb(dbPath?: string): Database.Database {
  if (dbPath) {
    if (defaultSqliteDb) {
      defaultSqliteDb.close();
      defaultSqliteDb = null;
      defaultDb = null;
    }
    defaultSqliteDb = new Database(dbPath);
    defaultSqliteDb.pragma("journal_mode = WAL");
    defaultSqliteDb.pragma("foreign_keys = ON");
    return defaultSqliteDb;
  }
  if (!defaultSqliteDb) {
    const dbPath = process.env.DB_PATH || path.join(DATA_DIR, "code-link.db");
    defaultSqliteDb = new Database(dbPath);
    defaultSqliteDb.pragma("journal_mode = WAL");
    defaultSqliteDb.pragma("foreign_keys = ON");
  }
  return defaultSqliteDb;
}

export function getDb(dbPath?: string): ReturnType<typeof drizzle> {
  if (dbPath) {
    if (defaultSqliteDb) {
      defaultSqliteDb.close();
      defaultSqliteDb = null;
      defaultDb = null;
    }
    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");
    defaultSqliteDb = sqliteDb;
    defaultDb = drizzle(sqliteDb, { schema });
    return defaultDb;
  }
  if (!defaultDb) {
    defaultDb = drizzle(getSqliteDb(), { schema });
  }
  return defaultDb;
}

export function closeDb(): void {
  if (defaultSqliteDb) {
    defaultSqliteDb.close();
    defaultSqliteDb = null;
    defaultDb = null;
  }
}

export { getSqliteDb as getNativeDb };
```

```typescript
// db/index.ts
export { getDb, getSqliteDb, getNativeDb, closeDb } from "./drizzle.js";
export * from "./schema/index.js";
export { initSchema, initDefaultAdmin } from "./init.js";
// 删除 connection.ts 导出
```

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 添加 tsyringe、reflect-metadata 依赖 |
| `tsconfig.json` | 修改 | 启用 experimentalDecorators、emitDecoratorMetadata |
| `src/index.ts` | 修改 | 顶部导入 reflect-metadata |
| `src/utils/roles.ts` | 新增 | 统一角色层级常量 |
| `src/db/connection.ts` | 删除 | 功能合并到 drizzle.ts |
| `src/db/drizzle.ts` | 修改 | 保持现有，删除 connection.ts 依赖 |
| `src/db/index.ts` | 修改 | 移除 connection.ts 导出 |
| `repositories/*.ts` | 修改 | 添加 @singleton() 装饰器 |
| `services/*.ts` | 修改 | 添加 @singleton() + 构造函数注入 |
| `middleware/auth.ts` | 修改 | 使用容器获取实例、统一角色层级 |
| `routes/*.ts` | 修改 | 使用 container.resolve()、统一错误处理 |
| `tests/*.test.ts` | 修改 | 使用 container.reset() + mock 注入 |

## 测试改进

使用 TSyringe 的 mock 功能：

```typescript
// tests/auth.service.test.ts
import "reflect-metadata";
import { container } from "tsyringe";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../src/services/auth.service.js";
import { UserRepository } from "../src/repositories/user.repository.js";

describe("AuthService", () => {
  beforeEach(() => {
    container.reset();
  });

  it("should register new user", async () => {
    // 创建 mock
    const mockUserRepo = {
      findByEmail: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: 1, email: "test@test.com", name: "Test" }),
    };

    // 注册 mock 替换真实实例
    container.registerInstance(UserRepository, mockUserRepo as any);

    const authService = container.resolve(AuthService);
    const result = await authService.register({
      email: "test@test.com",
      password: "password123",
      name: "Test",
    });

    expect(result.user.email).toBe("test@test.com");
    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith("test@test.com");
  });
});
```

## 实施顺序

1. 安装 tsyringe + reflect-metadata 依赖
2. 更新 tsconfig.json 配置
3. 创建统一角色层级常量 `utils/roles.ts`
4. 在 src/index.ts 顶部导入 reflect-metadata
5. 改造 Repository 层（添加 @singleton()）
6. 改造 Service 层（添加 @singleton() + 构造函数注入）
7. 改造 middleware/auth.ts（使用容器、统一角色层级）
8. 改造路由层（使用 container.resolve()、统一错误处理）
9. 删除 db/connection.ts，清理 db/index.ts
10. 更新测试代码使用 container.reset() + mock

## 风险与对策

| 风险 | 对策 |
|------|------|
| 装饰器是实验性特性 | TypeScript 已稳定支持多年，主流框架都在用 |
| 改动范围大 | 分阶段实施，每阶段确保测试通过 |
| 破坏现有功能 | 保持 API 接口不变，只改内部实现 |
| 测试覆盖不足 | 先写测试再重构，确保行为不变 |
| reflect-metadata 导入顺序 | 必须在所有文件顶部导入，否则装饰器元数据失效 |

## 预期收益

1. **代码简洁**：装饰器语法，无需手写 Container 类
2. **单例自动管理**：`@singleton()` 装饰器自动管理生命周期
3. **测试友好**：轻松注入 mock，无需真实数据库
4. **依赖清晰**：构造函数注入，依赖关系一目了然
5. **错误处理统一**：所有路由使用 handleRouteError
6. **权限逻辑统一**：ROLE_HIERARCHY 集中管理