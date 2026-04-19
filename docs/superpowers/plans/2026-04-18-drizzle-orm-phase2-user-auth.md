# Drizzle ORM 数据库重构 - Phase 2: User/Authentication 模块

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 User 和 Authentication 模块，使用 Drizzle ORM 替代原生 SQL，创建 Repository 和 Service 层。

**Architecture:** 三层架构 - Repository（数据访问）、Service（业务逻辑）、Routes（HTTP 处理）。类型安全的数据库操作。

**Tech Stack:** Drizzle ORM, bcryptjs, jsonwebtoken, Express

---

## 前置条件

- Phase 1 基础设施已完成
- Schema 定义在 `packages/server/src/db/schema/`
- Drizzle 数据库客户端在 `packages/server/src/db/drizzle.ts`

---

### Task 1: 创建 User Repository

**Files:**
- Create: `packages/server/src/repositories/user.repository.ts`
- Create: `packages/server/src/repositories/index.ts`

- [ ] **Step 1: 创建 User Repository**

```typescript
// packages/server/src/repositories/user.repository.ts
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema/index.js';
import type { InsertUser, SelectUser } from '../db/schema/index.js';

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
}
```

- [ ] **Step 2: 创建 Repositories 导出文件**

```typescript
// packages/server/src/repositories/index.ts
export { UserRepository } from './user.repository.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 2: 创建 Auth Service

**Files:**
- Create: `packages/server/src/services/auth.service.ts`
- Create: `packages/server/src/services/index.ts`

- [ ] **Step 1: 创建 Auth Service**

```typescript
// packages/server/src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';
import { JWT_SECRET } from '../middleware/auth.js';
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

export class AuthService {
  private userRepo = new UserRepository();

  /**
   * 用户注册
   */
  async register(data: RegisterInput): Promise<AuthResult> {
    // 检查邮箱是否已存在
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error('该邮箱已被注册');
    }

    // 创建用户
    const passwordHash = bcrypt.hashSync(data.password, 10);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });

    // 生成 JWT
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
      throw new Error('邮箱或密码错误');
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

- [ ] **Step 2: 创建 Services 导出文件**

```typescript
// packages/server/src/services/index.ts
export { AuthService } from './auth.service.js';
export type { RegisterInput, LoginInput, AuthResult } from './auth.service.js';
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 3: 重构 Auth Routes

**Files:**
- Modify: `packages/server/src/routes/auth.ts`

- [ ] **Step 1: 重构 Auth Routes 使用 Service**

```typescript
// packages/server/src/routes/auth.ts
import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === '该邮箱已被注册') {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  router.get('/me', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const user = await authService.getUser(userId);
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
```

---

### Task 4: 更新主入口文件

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 更新 Auth Router 导入和注册**

修改 `packages/server/src/index.ts`：

1. 移除 `db` 参数从 `createAuthRouter` 调用：

```typescript
// 修改前
app.use('/api/auth', createAuthRouter(db));

// 修改后
app.use('/api/auth', createAuthRouter());
```

2. 更新导入：

```typescript
// 修改导入
import { createAuthRouter } from './routes/auth.js';
// 移除 Database 类型导入（如果只用于 auth）
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: 无类型错误

---

### Task 5: 验证功能

**Files:**
- Modify: 无需修改文件

- [ ] **Step 1: 运行现有测试（如果有）**

```bash
cd packages/server && npm test
```

Expected: 测试通过或无测试文件

- [ ] **Step 2: 启动服务器验证**

```bash
cd packages/server && npm run dev
```

Expected: 服务器启动成功，无错误

- [ ] **Step 3: 提交更改**

```bash
git add packages/server/src/repositories/ packages/server/src/services/ packages/server/src/routes/auth.ts packages/server/src/index.ts
git commit -m "$(cat <<'EOF'
feat(server): refactor auth module with Drizzle ORM

- Add UserRepository for data access
- Add AuthService for business logic
- Refactor auth routes to use service layer
- Remove db parameter from auth router

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成标准

1. UserRepository 已创建并通过编译
2. AuthService 已创建并通过编译
3. Auth Routes 已重构并使用 Service
4. 主入口文件已更新
5. 服务器能正常启动
6. 提交已创建

## 后续阶段

完成此阶段后，进入 Phase 3: Organization 模块重构。