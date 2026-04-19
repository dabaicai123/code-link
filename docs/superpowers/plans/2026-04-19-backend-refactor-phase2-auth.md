# 后端架构重构实施计划 - Phase 2: Auth 模块迁移

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Auth 模块迁移到新的模块化结构，使用 TSyringe 依赖注入、Zod 验证中间件和 Controller 层。

**Architecture:** 创建 `modules/auth/` 目录，实现 AuthRepository、AuthService、AuthController、schemas 和 routes，使用 BaseRepository 和统一错误处理。

**Tech Stack:** TypeScript, TSyringe, Drizzle ORM, Zod, Express

---

## 文件结构

```
packages/server/src/
├── modules/
│   └── auth/
│       ├── auth.module.ts       # 模块注册
│       ├── repository.ts        # 数据访问
│       ├── service.ts           # 业务逻辑
│       ├── controller.ts        # HTTP 处理
│       ├── routes.ts            # 路由定义
│       ├── schemas.ts           # Zod schema
│       └── types.ts             # 类型定义
├── middleware/
│   └── auth.ts                  # 认证中间件（重构）
└── tests/
    └── modules/
        └── auth/
            ├── repository.test.ts
            ├── service.test.ts
            └── controller.test.ts
```

---

### Task 1: Auth Schemas 定义

**Files:**
- Create: `packages/server/src/modules/auth/schemas.ts`
- Create: `packages/server/src/modules/auth/types.ts`

- [ ] **Step 1: 创建 Auth Schemas**

```typescript
// src/modules/auth/schemas.ts
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50个字符'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
});

export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

```typescript
// src/modules/auth/types.ts
import type { SelectUser } from '../../db/schema/index.js';

export interface AuthResult {
  token: string;
  user: Omit<SelectUser, 'passwordHash'>;
}

export interface UserWithoutPassword extends Omit<SelectUser, 'passwordHash'> {}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/modules/auth/ && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add Auth module schemas and types

- registerSchema, loginSchema with validation
- Type definitions for AuthResult

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Auth Repository

**Files:**
- Create: `packages/server/src/modules/auth/repository.ts`
- Create: `packages/server/tests/modules/auth/repository.test.ts`

- [ ] **Step 1: 编写 Repository 测试**

```typescript
// tests/modules/auth/repository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-auth-repo.db');

describe('AuthRepository', () => {
  let repo: AuthRepository;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';
    
    db = new DatabaseConnection(TEST_DB_PATH);
    container.registerInstance(DatabaseConnection, db);
    repo = new AuthRepository(db);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  it('should create user', async () => {
    const user = await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    expect(user.id).toBeDefined();
    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
  });

  it('should find user by email', async () => {
    await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    const found = await repo.findByEmail('test@example.com');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Test User');
  });

  it('should find user by id', async () => {
    const created = await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    const found = await repo.findById(created.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });

  it('should return undefined for non-existent email', async () => {
    const found = await repo.findByEmail('nonexistent@example.com');
    expect(found).toBeUndefined();
  });

  it('should find email by id', async () => {
    const created = await repo.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
    });

    const email = await repo.findEmailById(created.id);
    expect(email).toBe('test@example.com');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/modules/auth/repository.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现 Auth Repository**

```typescript
// src/modules/auth/repository.ts
import { singleton } from 'tsyringe';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../core/database/connection.js';
import type { InsertUser, SelectUser } from '../../db/schema/index.js';

@singleton()
export class AuthRepository extends BaseRepository {
  constructor(db: DatabaseConnection) {
    super(db);
  }

  async findByEmail(email: string): Promise<SelectUser | undefined> {
    return this.db.select().from(users).where(eq(users.email, email)).get();
  }

  async findById(id: number): Promise<SelectUser | undefined> {
    return this.db.select().from(users).where(eq(users.id, id)).get();
  }

  async create(data: InsertUser): Promise<SelectUser> {
    return this.db.insert(users).values(data).returning().get();
  }

  async findEmailById(id: number): Promise<string | undefined> {
    const result = this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .get();
    return result?.email;
  }

  async updateAvatar(id: number, avatar: string): Promise<SelectUser> {
    return this.db.update(users).set({ avatar }).where(eq(users.id, id)).returning().get();
  }

  async delete(id: number): Promise<void> {
    this.db.delete(users).where(eq(users.id, id)).run();
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/modules/auth/repository.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/modules/auth/repository.ts packages/server/tests/modules/auth/repository.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add AuthRepository with DI pattern

- Extends BaseRepository
- findByEmail, findById, create methods
- Unit tests with test database

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Auth Service

**Files:**
- Create: `packages/server/src/modules/auth/service.ts`
- Create: `packages/server/tests/modules/auth/service.test.ts`

- [ ] **Step 1: 编写 Service 测试**

```typescript
// tests/modules/auth/service.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { container } from 'tsyringe';
import { AuthService } from '../../../src/modules/auth/service.js';
import { AuthRepository } from '../../../src/modules/auth/repository.js';
import { DatabaseConnection } from '../../../src/core/database/connection.js';
import { resetConfig } from '../../../src/core/config.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-auth-service.db');

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hashSync: vi.fn((password: string) => `hashed_${password}`),
    compareSync: vi.fn((password: string, hash: string) => hash === `hashed_${password}`),
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let db: DatabaseConnection;

  beforeEach(() => {
    container.reset();
    resetConfig();
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = 'test-secret-key-must-be-32-characters!';

    db = new DatabaseConnection(TEST_DB_PATH);
    container.registerInstance(DatabaseConnection, db);
    container.registerSingleton(AuthRepository);
    container.registerSingleton(AuthService);
    
    service = container.resolve(AuthService);
  });

  afterEach(() => {
    db.close();
    container.reset();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('register', () => {
    it('should register new user', async () => {
      const result = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBeDefined();
      expect(result.user.name).toBe('Test User');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictError for duplicate email', async () => {
      await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await expect(service.register({
        name: 'Another User',
        email: 'test@example.com',
        password: 'password456',
      })).rejects.toThrow('该邮箱已被注册');
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw AuthError for wrong password', async () => {
      await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      await expect(service.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      })).rejects.toThrow('邮箱或密码错误');
    });

    it('should throw AuthError for non-existent user', async () => {
      await expect(service.login({
        email: 'nonexistent@example.com',
        password: 'password123',
      })).rejects.toThrow('邮箱或密码错误');
    });
  });

  describe('getUser', () => {
    it('should return user without password', async () => {
      const { user: created } = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const user = await service.getUser(created.id);
      expect(user).toBeDefined();
      expect(user?.name).toBe('Test User');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('should return null for non-existent user', async () => {
      const user = await service.getUser(99999);
      expect(user).toBeNull();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const { token, user: created } = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const userId = await service.verifyToken(token);
      expect(userId).toBe(created.id);
    });

    it('should throw for invalid token', async () => {
      await expect(service.verifyToken('invalid-token')).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/modules/auth/service.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现 Auth Service**

```typescript
// src/modules/auth/service.ts
import { singleton, inject } from 'tsyringe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './repository.js';
import { ConflictError, AuthError } from '../../core/errors/index.js';
import { getConfig } from '../../core/config.js';
import type { SelectUser } from '../../db/schema/index.js';
import type { RegisterInput, LoginInput } from './schemas.js';
import type { AuthResult, UserWithoutPassword } from './types.js';

@singleton()
export class AuthService {
  constructor(
    @inject(AuthRepository) private readonly repo: AuthRepository
  ) {}

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const user = await this.repo.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });

    const token = this.generateToken(user.id);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async login(data: LoginInput): Promise<AuthResult> {
    const user = await this.repo.findByEmail(data.email);

    if (!user || !bcrypt.compareSync(data.password, user.passwordHash)) {
      throw new AuthError('邮箱或密码错误');
    }

    const token = this.generateToken(user.id);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async getUser(userId: number): Promise<UserWithoutPassword | null> {
    const user = await this.repo.findById(userId);
    if (!user) {
      return null;
    }
    return this.sanitizeUser(user);
  }

  async verifyToken(token: string): Promise<number> {
    const config = getConfig();
    const payload = jwt.verify(token, config.jwtSecret);
    
    if (typeof payload !== 'object' || payload === null || typeof (payload as any).userId !== 'number') {
      throw new AuthError('无效的令牌');
    }
    
    return (payload as any).userId;
  }

  private generateToken(userId: number): string {
    const config = getConfig();
    return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
  }

  private sanitizeUser(user: SelectUser): UserWithoutPassword {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/modules/auth/service.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/modules/auth/service.ts packages/server/tests/modules/auth/service.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add AuthService with JWT authentication

- register, login, getUser, verifyToken methods
- Uses Config for JWT secret
- Proper error handling with custom errors

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Auth Controller

**Files:**
- Create: `packages/server/src/modules/auth/controller.ts`
- Create: `packages/server/tests/modules/auth/controller.test.ts`

- [ ] **Step 1: 编写 Controller 测试**

```typescript
// tests/modules/auth/controller.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { AuthController } from '../../../src/modules/auth/controller.js';
import { AuthService } from '../../../src/modules/auth/service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let mockService: Partial<AuthService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockService = {
      register: vi.fn(),
      login: vi.fn(),
      getUser: vi.fn(),
    };

    controller = new AuthController(mockService as AuthService);

    mockReq = {};
    const jsonMock = vi.fn().mockReturnThis();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('register', () => {
    it('should register user and return 201', async () => {
      mockReq.body = { name: 'Test', email: 'test@example.com', password: 'password' };
      (mockService.register as any).mockResolvedValue({
        token: 'test-token',
        user: { id: 1, name: 'Test', email: 'test@example.com' },
      });

      await controller.register(mockReq as Request, mockRes as Response);

      expect(mockService.register).toHaveBeenCalledWith({
        name: 'Test',
        email: 'test@example.com',
        password: 'password',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: 'test-token',
          user: { id: 1, name: 'Test', email: 'test@example.com' },
        },
      });
    });
  });

  describe('login', () => {
    it('should login user and return token', async () => {
      mockReq.body = { email: 'test@example.com', password: 'password' };
      (mockService.login as any).mockResolvedValue({
        token: 'test-token',
        user: { id: 1, name: 'Test', email: 'test@example.com' },
      });

      await controller.login(mockReq as Request, mockRes as Response);

      expect(mockService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: 'test-token',
          user: { id: 1, name: 'Test', email: 'test@example.com' },
        },
      });
    });
  });

  describe('me', () => {
    it('should return current user', async () => {
      mockReq.userId = 1;
      (mockService.getUser as any).mockResolvedValue({
        id: 1,
        name: 'Test',
        email: 'test@example.com',
      });

      await controller.me(mockReq as Request, mockRes as Response);

      expect(mockService.getUser).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, name: 'Test', email: 'test@example.com' },
      });
    });

    it('should return 404 for non-existent user', async () => {
      mockReq.userId = 999;
      (mockService.getUser as any).mockResolvedValue(null);

      await controller.me(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/modules/auth/controller.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现 Auth Controller**

```typescript
// src/modules/auth/controller.ts
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { AuthService } from './service.js';
import { success, Errors } from '../../core/errors/index.js';

@singleton()
export class AuthController {
  constructor(
    @inject(AuthService) private readonly service: AuthService
  ) {}

  async register(req: Request, res: Response): Promise<void> {
    const result = await this.service.register(req.body);
    res.status(201).json(success(result));
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await this.service.login(req.body);
    res.json(success(result));
  }

  async me(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const user = await this.service.getUser(userId);
    
    if (!user) {
      res.status(404).json(Errors.notFound('用户'));
      return;
    }
    
    res.json(success(user));
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/modules/auth/controller.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/modules/auth/controller.ts packages/server/tests/modules/auth/controller.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add AuthController

- register, login, me endpoints
- Clean separation from service layer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Auth Routes

**Files:**
- Create: `packages/server/src/modules/auth/routes.ts`

- [ ] **Step 1: 实现 Auth Routes**

```typescript
// src/modules/auth/routes.ts
import { Router } from 'express';
import { validateBody } from '../../middleware/validation.js';
import { registerSchema, loginSchema } from './schemas.js';
import { AuthController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post(
    '/register',
    validateBody(registerSchema),
    asyncHandler((req, res) => controller.register(req, res))
  );

  router.post(
    '/login',
    validateBody(loginSchema),
    asyncHandler((req, res) => controller.login(req, res))
  );

  router.get(
    '/me',
    authMiddleware,
    asyncHandler((req, res) => controller.me(req, res))
  );

  return router;
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/modules/auth/routes.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add Auth routes with Zod validation

- POST /register, POST /login with validation
- GET /me with auth middleware
- Uses asyncHandler for error handling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Auth Middleware 重构

**Files:**
- Modify: `packages/server/src/middleware/auth.ts`

- [ ] **Step 1: 重构 Auth Middleware**

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { AuthService } from '../modules/auth/service.js';
import { Errors } from '../core/errors/index.js';

let authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    authService = container.resolve(AuthService);
  }
  return authService;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json(Errors.unauthorized());
    return;
  }

  const token = header.slice(7);
  if (!token) {
    res.status(401).json(Errors.unauthorized());
    return;
  }

  getAuthService()
    .verifyToken(token)
    .then(userId => {
      req.userId = userId;
      next();
    })
    .catch(() => {
      res.status(401).json(Errors.unauthorized());
    });
}

// For testing
export function resetAuthService(): void {
  authService = null;
}
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/middleware/auth.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
refactor(server): use AuthService in auth middleware

- Uses DI container to get AuthService
- Token verification through service
- Cleaner error handling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Auth Module 注册

**Files:**
- Create: `packages/server/src/modules/auth/auth.module.ts`

- [ ] **Step 1: 创建 Auth 模块注册**

```typescript
// src/modules/auth/auth.module.ts
import { container } from 'tsyringe';
import { AuthRepository } from './repository.js';
import { AuthService } from './service.js';
import { AuthController } from './controller.js';

export function registerAuthModule(): void {
  container.registerSingleton(AuthRepository);
  container.registerSingleton(AuthService);
  container.registerSingleton(AuthController);
}

export { AuthRepository } from './repository.js';
export { AuthService } from './service.js';
export { AuthController } from './controller.js';
export { createAuthRoutes } from './routes.js';
export { registerSchema, loginSchema } from './schemas.js';
export type { RegisterInput, LoginInput } from './schemas.js';
export type { AuthResult, UserWithoutPassword } from './types.js';
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/modules/auth/auth.module.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add Auth module registration

- registerAuthModule function for DI setup
- Re-exports for convenient imports

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 运行所有 Auth 测试

- [ ] **Step 1: 运行 Auth 模块测试**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/modules/auth/
```
Expected: All tests PASS

- [ ] **Step 2: 运行全部测试确保无回归**

```bash
cd /root/my/code-link/packages/server && pnpm test
```
Expected: All tests PASS

---

## 完成检查

- [ ] Auth 模块所有测试通过
- [ ] Repository 继承 BaseRepository
- [ ] Service 使用 @singleton() 装饰器
- [ ] Controller 分离 HTTP 处理
- [ ] Routes 使用 Zod 验证中间件
- [ ] 无 TypeScript 编译错误

## 下一步

Phase 2 完成后，继续迁移 Organization 模块
