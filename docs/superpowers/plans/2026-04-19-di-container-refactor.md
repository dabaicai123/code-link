# 后端 DI 容器重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 TSyringe 重构后端依赖管理，实现依赖注入、统一错误处理和角色层级。

**Architecture:** 使用 `@singleton()` 装饰器管理 Repository/Service 单例，构造函数注入依赖，路由通过 `container.resolve()` 获取 Service 实例。

**Tech Stack:** Express, TSyringe, reflect-metadata, Drizzle ORM, TypeScript

---

## 文件结构

```
packages/server/src/
├── index.ts                    # 修改：导入 reflect-metadata
├── utils/
│   └── roles.ts                # 新增：统一角色层级常量
├── db/
│   ├── drizzle.ts              # 保留：数据库单例
│   ├── connection.ts           # 删除：功能已合并
│   └── index.ts                # 修改：移除 connection 导出
├── repositories/
│   ├── user.repository.ts      # 修改：添加 @singleton()
│   ├── organization.repository.ts
│   ├── project.repository.ts
│   ├── draft.repository.ts
│   ├── token.repository.ts
│   ├── build.repository.ts
│   ├── claude-config.repository.ts
│   └── index.ts                # 修改：导出方式不变
├── services/
│   ├── auth.service.ts         # 修改：@singleton() + 构造函数注入
│   ├── permission.service.ts
│   ├── organization.service.ts
│   ├── project.service.ts
│   ├── draft.service.ts
│   └── index.ts
├── middleware/
│   └── auth.ts                 # 修改：使用容器 + 统一角色层级
├── routes/
│   ├── auth.ts                 # 修改：container.resolve() + handleRouteError
│   ├── organizations.ts
│   ├── projects.ts
│   ├── drafts.ts
│   ├── containers.ts
│   ├── invitations.ts
│   ├── repos.ts
│   ├── builds.ts
│   ├── claude-config.ts
│   ├── github.ts
│   ├── gitlab.ts
│   ├── terminal.ts
│   └── oauth-factory.ts
└── tests/
    └── *.test.ts               # 修改：使用 container.reset() + mock
```

---

## Task 1: 安装依赖和配置 TypeScript

**Files:**
- Modify: `packages/server/package.json`
- Modify: `packages/server/tsconfig.json`

- [ ] **Step 1: 安装 TSyringe 和 reflect-metadata**

```bash
cd /root/my/code-link/packages/server && npm install tsyringe reflect-metadata
```

- [ ] **Step 2: 更新 tsconfig.json 启用装饰器**

修改 `packages/server/tsconfig.json`，在 `compilerOptions` 中添加：

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 3: 验证配置生效**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 4: 提交**

```bash
git -C /root/my/code-link add packages/server/package.json packages/server/package-lock.json packages/server/tsconfig.json
git -C /root/my/code-link commit -m "chore: 安装 tsyringe 和 reflect-metadata，启用装饰器配置

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 创建统一角色层级常量

**Files:**
- Create: `packages/server/src/utils/roles.ts`

- [ ] **Step 1: 创建角色层级常量文件**

创建 `packages/server/src/utils/roles.ts`：

```typescript
import type { OrgRole } from "../db/schema/index.js";

/**
 * 角色层级定义
 * 数值越大权限越高
 */
export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};

/**
 * 检查用户角色是否满足要求
 */
export function hasRole(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * 获取角色的层级值
 */
export function getRoleLevel(role: OrgRole): number {
  return ROLE_HIERARCHY[role];
}
```

- [ ] **Step 2: 验证文件可编译**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit src/utils/roles.ts
```

Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/utils/roles.ts
git -C /root/my/code-link commit -m "feat: 添加统一角色层级常量

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: 在应用入口导入 reflect-metadata

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 在文件顶部添加 reflect-metadata 导入**

修改 `packages/server/src/index.ts`，在最顶部添加：

```typescript
import "reflect-metadata";
import 'dotenv/config';
// ... 其余导入保持不变
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/index.ts
git -C /root/my/code-link commit -m "feat: 在应用入口导入 reflect-metadata

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: 删除冗余的 db/connection.ts

**Files:**
- Delete: `packages/server/src/db/connection.ts`
- Modify: `packages/server/src/db/index.ts`

- [ ] **Step 1: 删除 connection.ts**

```bash
rm /root/my/code-link/packages/server/src/db/connection.ts
```

- [ ] **Step 2: 更新 db/index.ts 移除 connection 导出**

修改 `packages/server/src/db/index.ts`：

```typescript
// Drizzle ORM 客户端
export { getDb, getSqliteDb, getNativeDb, closeDb } from './drizzle.js';

// Schema 定义
export * from './schema/index.js';

// 初始化
export { initSchema, initDefaultAdmin } from './init.js';

// 迁移函数（保持兼容）
export {
  runOrganizationMigration,
  runProjectOrganizationMigration,
  runRepoClonedMigration,
} from './migration.js';
```

- [ ] **Step 3: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 4: 提交**

```bash
git -C /root/my/code-link add packages/server/src/db/
git -C /root/my/code-link commit -m "refactor: 删除冗余的 connection.ts，统一数据库连接管理

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: 改造 UserRepository

**Files:**
- Modify: `packages/server/src/repositories/user.repository.ts`

- [ ] **Step 1: 添加 @singleton() 装饰器**

修改 `packages/server/src/repositories/user.repository.ts`：

```typescript
import "reflect-metadata";
import { singleton } from "tsyringe";
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema/index.js';
import type { InsertUser, SelectUser } from '../db/schema/index.js';

@singleton()
export class UserRepository {
  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<SelectUser | undefined> {
    const db = getDb();
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: number): Promise<SelectUser | undefined> {
    const db = getDb();
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  /**
   * 创建用户
   */
  async create(data: InsertUser): Promise<SelectUser> {
    const db = getDb();
    return db.insert(users).values(data).returning().get();
  }

  /**
   * 更新用户头像
   */
  async updateAvatar(id: number, avatar: string): Promise<SelectUser> {
    const db = getDb();
    return db.update(users).set({ avatar }).where(eq(users.id, id)).returning().get();
  }

  /**
   * 更新用户信息
   */
  async update(id: number, data: Partial<Pick<InsertUser, 'name' | 'avatar'>>): Promise<SelectUser> {
    const db = getDb();
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  /**
   * 删除用户
   */
  async delete(id: number): Promise<void> {
    const db = getDb();
    db.delete(users).where(eq(users.id, id)).run();
  }

  /**
   * 根据用户 ID 获取邮箱
   */
  async findEmailById(id: number): Promise<string | undefined> {
    const db = getDb();
    const result = db.select({ email: users.email }).from(users).where(eq(users.id, id)).get();
    return result?.email;
  }
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 运行相关测试**

```bash
cd /root/my/code-link/packages/server && npm test -- --grep "UserRepository\|user"
```

- [ ] **Step 4: 提交**

```bash
git -C /root/my/code-link add packages/server/src/repositories/user.repository.ts
git -C /root/my/code-link commit -m "refactor: UserRepository 添加 @singleton() 装饰器

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: 改造 OrganizationRepository

**Files:**
- Modify: `packages/server/src/repositories/organization.repository.ts`

- [ ] **Step 1: 添加 @singleton() 装饰器**

在文件顶部添加：

```typescript
import "reflect-metadata";
import { singleton } from "tsyringe";
```

在类定义前添加装饰器：

```typescript
@singleton()
export class OrganizationRepository {
  // ... 现有代码保持不变
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 运行相关测试**

```bash
cd /root/my/code-link/packages/server && npm test -- --grep "Organization"
```

- [ ] **Step 4: 提交**

```bash
git -C /root/my/code-link add packages/server/src/repositories/organization.repository.ts
git -C /root/my/code-link commit -m "refactor: OrganizationRepository 添加 @singleton() 装饰器

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: 改造 ProjectRepository

**Files:**
- Modify: `packages/server/src/repositories/project.repository.ts`

- [ ] **Step 1: 添加 @singleton() 装饰器**

```typescript
import "reflect-metadata";
import { singleton } from "tsyringe";
// ... 其他导入

@singleton()
export class ProjectRepository {
  // ... 现有代码保持不变
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/repositories/project.repository.ts
git -C /root/my/code-link commit -m "refactor: ProjectRepository 添加 @singleton() 装饰器

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: 改造 DraftRepository

**Files:**
- Modify: `packages/server/src/repositories/draft.repository.ts`

- [ ] **Step 1: 添加 @singleton() 装饰器**

```typescript
import "reflect-metadata";
import { singleton } from "tsyringe";
// ... 其他导入

@singleton()
export class DraftRepository {
  // ... 现有代码保持不变
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/repositories/draft.repository.ts
git -C /root/my/code-link commit -m "refactor: DraftRepository 添加 @singleton() 装饰器

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: 改造其他 Repository

**Files:**
- Modify: `packages/server/src/repositories/token.repository.ts`
- Modify: `packages/server/src/repositories/build.repository.ts`
- Modify: `packages/server/src/repositories/claude-config.repository.ts`

- [ ] **Step 1: 改造 TokenRepository**

在 `token.repository.ts` 添加：

```typescript
import "reflect-metadata";
import { singleton } from "tsyringe";

@singleton()
export class TokenRepository {
  // ... 现有代码
}
```

- [ ] **Step 2: 改造 BuildRepository**

在 `build.repository.ts` 添加：

```typescript
import "reflect-metadata";
import { singleton } from "tsyringe";

@singleton()
export class BuildRepository {
  // ... 现有代码
}
```

- [ ] **Step 3: 改造 ClaudeConfigRepository**

在 `claude-config.repository.ts` 添加：

```typescript
import "reflect-metadata";
import { singleton } from "tsyringe";

@singleton()
export class ClaudeConfigRepository {
  // ... 现有代码
}
```

- [ ] **Step 4: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/repositories/
git -C /root/my/code-link commit -m "refactor: 其他 Repository 添加 @singleton() 装饰器

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: 改造 PermissionService

**Files:**
- Modify: `packages/server/src/services/permission.service.ts`

- [ ] **Step 1: 添加装饰器和构造函数注入**

修改 `packages/server/src/services/permission.service.ts`：

```typescript
import "reflect-metadata";
import { singleton, inject } from "tsyringe";
import { UserRepository } from '../repositories/user.repository.js';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { PermissionError, NotFoundError } from '../utils/errors.js';
import { ROLE_HIERARCHY } from '../utils/roles.js';
import type { SelectOrganizationMember } from '../db/schema/index.js';
import type { SelectProject } from '../db/schema/index.js';

type OrgRole = 'owner' | 'developer' | 'member';

@singleton()
export class PermissionService {
  constructor(
    @inject(UserRepository) private userRepo: UserRepository,
    @inject(OrganizationRepository) private orgRepo: OrganizationRepository,
    @inject(ProjectRepository) private projectRepo: ProjectRepository
  ) {}

  /**
   * 检查用户是否是超级管理员
   */
  async isSuperAdmin(userId: number): Promise<boolean> {
    const email = await this.userRepo.findEmailById(userId);
    return email ? isSuperAdmin(email) : false;
  }

  /**
   * 检查用户在组织中的角色
   */
  async checkOrgRole(userId: number, orgId: number, minRole: OrgRole): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership) {
      throw new PermissionError('您不是该组织的成员');
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      throw new PermissionError(`需要 ${minRole} 或更高权限`);
    }
  }

  /**
   * 检查用户是否有项目访问权限
   */
  async checkProjectAccess(userId: number, projectId: number): Promise<SelectProject> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    if (await this.isSuperAdmin(userId)) {
      return project;
    }

    const membership = await this.orgRepo.findUserMembership(project.organizationId, userId);
    if (!membership) {
      throw new PermissionError('您没有权限访问该项目');
    }

    return project;
  }

  /**
   * 检查用户是否是组织的 owner
   */
  async checkOrgOwner(userId: number, orgId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有组织 owner 可以执行此操作');
    }
  }

  /**
   * 检查用户是否可以创建组织
   */
  async checkCanCreateOrg(userId: number): Promise<void> {
    if (await this.isSuperAdmin(userId)) {
      return;
    }

    const isOwner = await this.orgRepo.isOwnerOfAny(userId);
    if (!isOwner) {
      throw new PermissionError('只有组织 owner 或超级管理员可以创建组织');
    }
  }

  /**
   * 获取用户在组织中的角色
   */
  async getOrgRole(userId: number, orgId: number): Promise<OrgRole | null> {
    if (await this.isSuperAdmin(userId)) {
      return 'owner';
    }

    const membership = await this.orgRepo.findUserMembership(orgId, userId);
    return membership?.role ?? null;
  }
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/services/permission.service.ts
git -C /root/my/code-link commit -m "refactor: PermissionService 使用 TSyringe DI 和统一角色层级

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: 改造 AuthService

**Files:**
- Modify: `packages/server/src/services/auth.service.ts`

- [ ] **Step 1: 添加装饰器和构造函数注入**

修改 `packages/server/src/services/auth.service.ts`：

```typescript
import "reflect-metadata";
import { singleton, inject } from "tsyringe";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { AuthError, ConflictError } from '../utils/errors.js';
import type { SelectUser } from '../db/schema/index.js';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: Omit<SelectUser, 'passwordHash'>;
}

@singleton()
export class AuthService {
  constructor(
    @inject(UserRepository) private userRepo: UserRepository
  ) {}

  /**
   * 用户注册
   */
  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 用户登录
   */
  async login(data: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(data.email);

    if (!user || !bcrypt.compareSync(data.password, user.passwordHash)) {
      throw new AuthError('邮箱或密码错误');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 获取用户信息
   */
  async getUser(userId: number): Promise<Omit<SelectUser, 'passwordHash'> | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      return null;
    }
    return this.sanitizeUser(user);
  }

  /**
   * 移除敏感字段
   */
  private sanitizeUser(user: SelectUser): Omit<SelectUser, 'passwordHash'> {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/services/auth.service.ts
git -C /root/my/code-link commit -m "refactor: AuthService 使用 TSyringe DI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: 改造 OrganizationService

**Files:**
- Modify: `packages/server/src/services/organization.service.ts`

- [ ] **Step 1: 添加装饰器和构造函数注入**

在文件顶部添加：

```typescript
import "reflect-metadata";
import { singleton, inject } from "tsyringe";
```

修改类定义：

```typescript
@singleton()
export class OrganizationService {
  constructor(
    @inject(OrganizationRepository) private orgRepo: OrganizationRepository,
    @inject(UserRepository) private userRepo: UserRepository,
    @inject(PermissionService) private permService: PermissionService
  ) {}
  // ... 现有方法保持不变，移除私有属性声明
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/services/organization.service.ts
git -C /root/my/code-link commit -m "refactor: OrganizationService 使用 TSyringe DI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: 改造 ProjectService

**Files:**
- Modify: `packages/server/src/services/project.service.ts`

- [ ] **Step 1: 添加装饰器和构造函数注入**

```typescript
import "reflect-metadata";
import { singleton, inject } from "tsyringe";
// ... 其他导入

@singleton()
export class ProjectService {
  constructor(
    @inject(ProjectRepository) private projectRepo: ProjectRepository,
    @inject(PermissionService) private permService: PermissionService
  ) {}
  // ... 现有方法保持不变
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/services/project.service.ts
git -C /root/my/code-link commit -m "refactor: ProjectService 使用 TSyringe DI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: 改造 DraftService

**Files:**
- Modify: `packages/server/src/services/draft.service.ts`

- [ ] **Step 1: 添加装饰器和构造函数注入**

```typescript
import "reflect-metadata";
import { singleton, inject } from "tsyringe";
// ... 其他导入

@singleton()
export class DraftService {
  constructor(
    @inject(DraftRepository) private draftRepo: DraftRepository,
    @inject(ProjectRepository) private projectRepo: ProjectRepository,
    @inject(PermissionService) private permService: PermissionService
  ) {}
  // ... 现有方法保持不变
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/services/draft.service.ts
git -C /root/my/code-link commit -m "refactor: DraftService 使用 TSyringe DI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: 改造 middleware/auth.ts

**Files:**
- Modify: `packages/server/src/middleware/auth.ts`

- [ ] **Step 1: 重构 auth.ts 使用容器和统一角色层级**

修改 `packages/server/src/middleware/auth.ts`：

```typescript
import "reflect-metadata";
import { container } from "tsyringe";
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../logger/index.js';
import { isSuperAdmin } from '../utils/super-admin.js';
import { ROLE_HIERARCHY } from '../utils/roles.js';
import { UserRepository, OrganizationRepository, ProjectRepository } from '../repositories/index.js';
import { Errors } from '../utils/response.js';
import type { OrgRole } from '../types.js';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      orgRole?: OrgRole;
    }
  }
}

const logger = createLogger('auth');

const DEFAULT_SECRET = 'code-link-dev-secret';

if (!process.env.JWT_SECRET) {
  logger.warn('Using default JWT_SECRET. Set JWT_SECRET in production!');
}

export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

// 单例 Repository 实例通过容器获取
const userRepo = container.resolve(UserRepository);
const orgRepo = container.resolve(OrganizationRepository);
const projectRepo = container.resolve(ProjectRepository);

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logger.debug('No auth token provided');
    res.status(401).json(Errors.unauthorized());
    return;
  }

  const token = header.slice(7);
  if (!token) {
    logger.debug('Empty auth token');
    res.status(401).json(Errors.unauthorized());
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload !== 'object' || payload === null || typeof payload.userId !== 'number') {
      logger.warn('Invalid token payload structure');
      res.status(401).json(Errors.unauthorized());
      return;
    }
    logger.debug(`Token verified for userId=${payload.userId}`);
    (req as any).userId = payload.userId;
    next();
  } catch (err) {
    logger.warn('Token verification failed', err);
    res.status(401).json(Errors.unauthorized());
  }
}

/**
 * 创建组织权限检查中间件
 */
export function createOrgMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const orgIdParam = req.params.orgId || req.params.id || req.body.organization_id;
    const orgId = parseInt(Array.isArray(orgIdParam) ? orgIdParam[0] : orgIdParam || '', 10);

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    if (isNaN(orgId)) {
      res.status(400).json(Errors.paramInvalid('组织 ID'));
      return;
    }

    const userEmail = await userRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      (req as any).orgRole = 'owner';
      next();
      return;
    }

    const membership = await orgRepo.findUserMembership(orgId, userId);

    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    (req as any).orgRole = membership.role;
    next();
  };
}

/**
 * 创建项目权限检查中间件
 */
export function createProjectMemberMiddleware(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const projectIdParam = req.params.id || req.params.projectId;
    const projectId = parseInt(Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam || '', 10);

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json(Errors.paramInvalid('项目 ID'));
      return;
    }

    const userEmail = await userRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      next();
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json(Errors.notFound('项目'));
      return;
    }

    const membership = await orgRepo.findUserMembership(project.organizationId, userId);

    if (!membership) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    next();
  };
}

/**
 * 检查用户是否有权创建组织
 */
export function createCanCreateOrgMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json(Errors.unauthorized());
      return;
    }

    const userEmail = await userRepo.findEmailById(userId);
    if (userEmail && isSuperAdmin(userEmail)) {
      next();
      return;
    }

    const isOwner = await orgRepo.isOwnerOfAny(userId);
    if (!isOwner) {
      res.status(403).json(Errors.forbidden());
      return;
    }

    next();
  };
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/middleware/auth.ts
git -C /root/my/code-link commit -m "refactor: middleware/auth.ts 使用 TSyringe 容器和统一角色层级

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: 改造 routes/auth.ts

**Files:**
- Modify: `packages/server/src/routes/auth.ts`

- [ ] **Step 1: 重构 auth.ts 路由使用容器和统一错误处理**

修改 `packages/server/src/routes/auth.ts`：

```typescript
import "reflect-metadata";
import { container } from "tsyringe";
import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, Errors, handleRouteError } from '../utils/response.js';
import { createLogger } from '../logger/index.js';

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
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json(Errors.paramMissing('邮箱或密码'));
      return;
    }
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

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/routes/auth.ts
git -C /root/my/code-link commit -m "refactor: routes/auth.ts 使用 TSyringe 容器和统一错误处理

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 17: 改造 routes/organizations.ts

**Files:**
- Modify: `packages/server/src/routes/organizations.ts`

- [ ] **Step 1: 重构 organizations.ts 路由**

在文件顶部添加：

```typescript
import "reflect-metadata";
import { container } from "tsyringe";
```

修改路由创建函数：

```typescript
export function createOrganizationsRouter(): Router {
  const router = Router();
  const orgService = container.resolve(OrganizationService);

  // ... 现有路由逻辑保持不变，错误处理改用 handleRouteError
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/routes/organizations.ts
git -C /root/my/code-link commit -m "refactor: routes/organizations.ts 使用 TSyringe 容器

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 18: 改造 routes/projects.ts

**Files:**
- Modify: `packages/server/src/routes/projects.ts`

- [ ] **Step 1: 重构 projects.ts 路由**

```typescript
import "reflect-metadata";
import { container } from "tsyringe";
// ...
const projectService = container.resolve(ProjectService);
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/routes/projects.ts
git -C /root/my/code-link commit -m "refactor: routes/projects.ts 使用 TSyringe 容器

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 19: 改造 routes/drafts.ts

**Files:**
- Modify: `packages/server/src/routes/drafts.ts`

- [ ] **Step 1: 重构 drafts.ts 路由**

修改文件顶部：

```typescript
import "reflect-metadata";
import { container } from "tsyringe";
import { Router } from 'express';
import { DraftService } from '../services/draft.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { getWebSocketServer } from '../websocket/server.js';
import {
  createDraftMessageEvent,
  createDraftStatusChangedEvent,
  createDraftMessageConfirmedEvent,
  createDraftAIResponseEvent,
} from '../websocket/types.js';
import { createLogger } from '../logger/index.js';
import { success, Errors, handleRouteError } from '../utils/response.js';

const logger = createLogger('drafts');

export function createDraftsRouter(): Router {
  const router = Router();
  const draftService = container.resolve(DraftService);

  // 所有路由改用 handleRouteError
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const draft = await draftService.create(userId, req.body);
      res.status(201).json(success({ draft }));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '创建 Draft 失败');
    }
  });

  // ... 其他路由同样改用 handleRouteError
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/routes/drafts.ts
git -C /root/my/code-link commit -m "refactor: routes/drafts.ts 使用 TSyringe 容器和统一错误处理

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 20: 改造其他路由文件

**Files:**
- Modify: `packages/server/src/routes/containers.ts`
- Modify: `packages/server/src/routes/invitations.ts`
- Modify: `packages/server/src/routes/repos.ts`
- Modify: `packages/server/src/routes/builds.ts`
- Modify: `packages/server/src/routes/claude-config.ts`
- Modify: `packages/server/src/routes/github.ts`
- Modify: `packages/server/src/routes/gitlab.ts`
- Modify: `packages/server/src/routes/terminal.ts`

- [ ] **Step 1: 批量改造路由文件**

对每个路由文件：
1. 添加 `import "reflect-metadata";`
2. 添加 `import { container } from "tsyringe";`
3. 将 `new XxxService()` 改为 `container.resolve(XxxService)`
4. 将字符串匹配的错误处理改为 `handleRouteError`

- [ ] **Step 2: 验证编译通过**

```bash
cd /root/my/code-link/packages/server && npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git -C /root/my/code-link add packages/server/src/routes/
git -C /root/my/code-link commit -m "refactor: 其他路由使用 TSyringe 容器和统一错误处理

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 21: 运行完整测试套件

**Files:**
- None

- [ ] **Step 1: 运行所有单元测试**

```bash
cd /root/my/code-link/packages/server && npm test
```

Expected: 所有测试通过

- [ ] **Step 2: 修复失败的测试**

如有测试失败，根据错误信息修复。

- [ ] **Step 3: 验证服务启动**

```bash
cd /root/my/code-link/packages/server && npm run dev &
sleep 3
curl http://localhost:4000/api/health
```

Expected: 返回 `{"code":0,"data":{"status":"ok"}}`

- [ ] **Step 4: 停止服务并提交**

```bash
pkill -f "tsx watch"
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "test: 验证 DI 重构后测试通过

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 22: 更新测试文件使用 TSyringe mock

**Files:**
- Modify: `packages/server/tests/*.test.ts`

- [ ] **Step 1: 更新测试文件示例**

选择一个测试文件作为示例，如 `logger.test.ts`，添加 TSyringe mock 支持：

```typescript
import "reflect-metadata";
import { container } from "tsyringe";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Logger", () => {
  beforeEach(() => {
    container.reset();
  });

  afterEach(() => {
    container.reset();
  });

  // ... 测试用例
});
```

- [ ] **Step 2: 提交测试更新**

```bash
git -C /root/my/code-link add packages/server/tests/
git -C /root/my/code-link commit -m "test: 更新测试使用 TSyringe container.reset()

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 最终提交

- [ ] **Step 1: 确认所有改动已提交**

```bash
git -C /root/my/code-link status
```

Expected: 无未提交的改动

- [ ] **Step 2: 创建汇总提交（如有遗漏）**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "refactor: 完成后端 TSyringe DI 重构

- 安装 tsyringe 和 reflect-metadata
- 所有 Repository/Service 使用 @singleton() 装饰器
- Service 构造函数注入依赖
- 路由使用 container.resolve() 获取实例
- 统一使用 handleRouteError 处理错误
- 统一使用 utils/roles.ts 角色层级常量
- 删除冗余的 db/connection.ts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
