# 后端架构重构设计文档

## 概述

对 `packages/server` 进行一次性重构，解决依赖注入不一致、引用不存在模块、全局单例混乱、缺少输入验证等问题。项目未投产，不考虑数据兼容性。

**Why:** 当前架构存在多处设计问题，影响代码质量和可维护性。
**How to apply:** 按此设计文档执行重构，统一架构风格。

---

## 目标架构

### 技术选型
- **数据库**: SQLite + Drizzle ORM
- **HTTP框架**: Express
- **验证**: Zod 中间件
- **依赖注入**: TSyringe
- **WebSocket**: Socket.IO
- **目录结构**: 模块化

### 核心原则
1. 所有服务类使用 TSyringe `@singleton()` 装饰器
2. 所有依赖通过构造函数注入
3. 统一的请求验证中间件
4. 统一的错误处理机制
5. 统一的日志格式

---

## 目录结构

```
packages/server/src/
├── core/                    # 核心基础设施
│   ├── di/                  # 依赖注入配置
│   │   ├── container.ts     # TSyringe 容器配置
│   │   └── types.ts         # 依赖注入接口类型
│   ├── database/
│   │   ├── connection.ts    # 数据库连接管理
│   │   ├── transaction.ts   # 事务支持
│   │   └── schema.ts        # Schema 导出
│   ├── logger/
│   │   ├── logger.ts        # 日志实现
│   │   ├── context.ts       # 请求上下文
│   │   └── middleware.ts    # 日志中间件
│   ├── crypto/
│   │   └── aes.ts           # 加密服务
│   └── errors/
│       ├── errors.ts        # 错误类定义
│       ├── handler.ts       # 错误处理中间件
│       └── codes.ts         # 错误码定义
│
├── modules/                 # 业务模块（模块化结构）
│   ├── auth/
│   │   ├── auth.module.ts   # 模块导出
│   │   ├── routes.ts        # HTTP 路由
│   │   ├── controller.ts    # 控制器
│   │   ├── service.ts       # 业务逻辑
│   │   ├── repository.ts    # 数据访问
│   │   ├── schemas.ts       # Zod 验证 schema
│   │   └── types.ts         # 类型定义
│   ├── organization/
│   │   ├── organization.module.ts
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   ├── project/
│   │   ├── project.module.ts
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   ├── draft/
│   │   ├── draft.module.ts
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   ├── build/
│   │   ├── build.module.ts
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── schemas.ts
│   │   └── types.ts
│   ├── terminal/
│   │   ├── terminal.module.ts
│   │   ├── manager.ts        # 终端会话管理
│   │   ├── types.ts
│   │   └── docker-exec.ts    # Docker exec 封装
│   ├── git/
│   │   ├── git.module.ts
│   │   ├── routes.ts
│   │   ├── github-client.ts
│   │   ├── gitlab-client.ts
│   │   ├── oauth.ts
│   │   ├── token-manager.ts  # 服务类
│   │   └── repo-manager.ts   # 服务类
│   ├── claude-config/
│   │   ├── claude-config.module.ts
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   └ects schemas.ts
│   └── container/
│       ├── container.module.ts
│       ├── routes.ts
│       ├── service.ts
│       ├── docker-client.ts
│       ├── container-manager.ts
│       ├── volume-manager.ts
│       ├── templates.ts
│       └ects schemas.ts
│
├── websocket/               # WebSocket 处理（独立模块）
│   ├── server.ts            # Socket.IO 服务
│   ├── middleware/
│   │   └ auth.ts            # WebSocket 认证
│   ├── namespaces/
│   │   ├── project.ts
│   │   ├── draft.ts
│   │   └ects terminal.ts
│   └ects types.ts
│
├── middleware/              # 全局中间件
│   ├── auth.ts              # HTTP 认证中间件
│   ├── validation.ts        # Zod 验证中间件
│   ├── permission.ts        # 权限检查中间件
│   └ects request-id.ts      # 请求 ID
│
├── db/                      # 数据库 Schema（保持分离）
│   ├── schema/
│   │   ├── users.ts
│   │   ├── organizations.ts
│   │   ├── projects.ts
│   │   ├── drafts.ts
│   │   ├── builds.ts
│   │   ├── tokens.ts
│   │   ├── repos.ts
│   │   └ects claude-configs.ts
│   ├── schema.ts
│   ├── init.ts
│   └ects migrate.ts
│
├── ai/                      # AI 服务（独立模块）
│   ├── client.ts            # Anthropic 客户端服务
│   ├── prompts.ts
│   ├── commands.ts
│   └ects context.ts
│
├── app.ts                   # Express 应用配置
├── server.ts                # 服务器启动入口
├── index.ts                 # 导出入口
└ects types.ts               # 全局类型定义
```

---

## 核心设计

### 1. 依赖注入统一

**问题**: 当前混合使用 TSyringe 容器和手动 new 实例化。

**解决方案**:

```typescript
// core/di/container.ts
import "reflect-metadata";
import { container } from "tsyringe";
import { DatabaseConnection } from "../database/connection.js";
import { LoggerService } from "../logger/logger.js";

// 注册基础设施服务
container.registerSingleton(DatabaseConnection);
container.registerSingleton(LoggerService);

// 注册业务服务（在每个模块中注册）
// modules/auth/auth.module.ts
import { container } from "tsyringe";
import { AuthService } from "./service.js";
import { AuthRepository } from "./repository.js";
import { AuthController } from "./controller.js";

container.registerSingleton(AuthRepository);
container.registerSingleton(AuthService);
container.registerSingleton(AuthController);

export function registerAuthModule() {
  // 模块注册函数
}
```

**所有服务类使用统一模式**:

```typescript
// modules/project/service.ts
import { singleton, inject } from "tsyringe";
import { ProjectRepository } from "./repository.js";
import { PermissionService } from "../permission/service.js";

@singleton()
export class ProjectService {
  constructor(
    @inject(ProjectRepository) private repo: ProjectRepository,
    @inject(PermissionService) private perm: PermissionService
  ) {}
}
```

**Why:** 统一的 DI 模式便于测试、维护和依赖管理。
**How to apply:** 所有服务类必须使用 @singleton() 装饰器，依赖通过 @inject 注入。

---

### 2. 数据库访问层优化

**问题**: 每个 Repository 方法都调用 getDb()，没有事务支持。

**解决方案**:

```typescript
// core/database/connection.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../db/schema/index.js";
import { singleton } from "tsyringe";

@singleton()
export class DatabaseConnection {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;

  constructor() {
    this.sqlite = new Database(process.env.DB_PATH || "data/code-link.db");
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("foreign_keys = ON");
    this.db = drizzle(this.sqlite, { schema });
  }

  getDb() {
    return this.db;
  }

  getSqlite() {
    return this.sqlite;
  }

  transaction<T>(fn: (tx: ReturnType<typeof drizzle>) => T): T {
    return this.sqlite.transaction(() => fn(this.db)) as T;
  }

  close() {
    this.sqlite.close();
  }
}
```

**Repository 基类**:

```typescript
// core/database/base.repository.ts
import { inject } from "tsyringe";
import { DatabaseConnection } from "./connection.js";

export abstract class BaseRepository {
  constructor(@inject(DatabaseConnection) protected db: DatabaseConnection) {}

  protected getQuery() {
    return this.db.getDb();
  }

  protected transaction<T>(fn: () => T): T {
    return this.db.transaction(fn);
  }
}
```

**Why:** 减少重复代码，支持事务，便于测试时注入 mock 数据库。
**How to apply:** 所有 Repository 继承 BaseRepository，不再直接调用 getDb()。

---

### 3. Zod 验证中间件

**问题**: HTTP 路由没有统一验证，Socket 层使用 Zod 但 HTTP 层没有。

**解决方案**:

```typescript
// middleware/validation.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { Errors } from "../core/errors/errors.js";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
    }
    req.params = result.data as any;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
    }
    req.query = result.data as any;
    next();
  };
}

function formatZodError(error: ZodError): string[] {
  return error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`);
}
```

**模块 Schema 定义**:

```typescript
// modules/project/schemas.ts
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  templateType: z.enum(["node", "node+java", "node+python"]),
  organizationId: z.number().int().positive(),
});

export const projectIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
```

**路由使用**:

```typescript
// modules/project/routes.ts
import { Router } from "express";
import { validateBody, validateParams } from "../../middleware/validation.js";
import { createProjectSchema, projectIdSchema } from "./schemas.js";
import { ProjectController } from "./controller.js";

export function createProjectRoutes(controller: ProjectController): Router {
  const router = Router();

  router.post(
    "/",
    validateBody(createProjectSchema),
    controller.create
  );

  router.get(
    "/:id",
    validateParams(projectIdSchema),
    controller.findById
  );

  return router;
}
```

**Why:** 统一验证逻辑，减少重复代码，自动类型推导。
**How to apply:** 每个模块定义 schemas.ts，路由使用验证中间件。

---

### 4. Controller 层引入

**问题**: 路由函数直接处理请求响应，业务逻辑和 HTTP 处理耦合。

**解决方案**:

```typescript
// modules/project/controller.ts
import { singleton, inject } from "tsyringe";
import { Request, Response } from "express";
import { ProjectService } from "./service.js";
import { LoggerService } from "../../core/logger/logger.js";

@singleton()
export class ProjectController {
  constructor(
    @inject(ProjectService) private service: ProjectService,
    @inject(LoggerService) private logger: LoggerService
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const input = req.body; // 已经过 Zod 验证

    const project = await this.service.create(userId, input);
    res.status(201).json({ success: true, data: project });
  }

  async findById(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id); // 已经过 Zod 验证

    const project = await this.service.findById(userId, projectId);
    res.json({ success: true, data: project });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id);

    await this.service.delete(userId, projectId);
    res.status(204).send();
  }
}
```

**Why:** 分离 HTTP 处理和业务逻辑，便于测试 Controller。
**How to apply:** 路由只负责绑定 Controller 方法，Controller 处理请求响应。

---

### 5. 统一错误处理

**问题**: 错误处理分散，格式不统一。

**解决方案**:

```typescript
// core/errors/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus: number,
    public details?: string[]
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(details: string[]) {
    super("参数验证失败", "VALIDATION_ERROR", 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}不存在`, "NOT_FOUND", 404);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = "权限不足") {
    super(message, "FORBIDDEN", 403);
  }
}

export class AuthError extends AppError {
  constructor(message: string = "请先登录") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}
```

```typescript
// core/errors/handler.ts
import { Request, Response, NextFunction } from "express";
import { AppError, isAppError } from "./errors.js";
import { LoggerService } from "../logger/logger.js";

export function createErrorHandler(logger: LoggerService) {
  return (err: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.requestId || "unknown";

    if (isAppError(err)) {
      logger.warn(`[${requestId}] ${err.code}: ${err.message}`);
      res.status(err.httpStatus).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }

    logger.error(`[${requestId}] Unexpected error:`, err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误",
      },
    });
  };
}
```

**Why:** 统一错误格式，便于前端处理，便于日志追踪。
**How to apply:** 所有业务错误抛出 AppError 子类，Express 使用统一错误中间件。

---

### 6. 请求 ID 与日志追踪

**问题**: 没有请求追踪，日志难以关联。

**解决方案**:

```typescript
// middleware/request-id.ts
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"] as string || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
```

```typescript
// core/logger/logger.ts
import { singleton } from "tsyringe";
import pino from "pino";

@singleton()
export class LoggerService {
  private logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  });

  info(message: string, context?: Record<string, unknown>) {
    this.logger.info(context || {}, message);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.logger.warn(context || {}, message);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    this.logger.error({ ...context, error: error?.message, stack: error?.stack }, message);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.logger.debug(context || {}, message);
  }
}
```

**Why:** 便于追踪请求链路，便于调试和监控。
**How to apply:** 所有请求通过 request-id 中间件，日志服务使用 Pino。

---

### 7. WebSocket 重构

**问题**: 引用不存在的 websocket/server.ts，Socket 层直接实例化 Repository。

**解决方案**:

```typescript
// websocket/server.ts
import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { singleton, inject } from "tsyringe";
import { LoggerService } from "../core/logger/logger.js";
import { AuthService } from "../modules/auth/service.js";

@singleton()
export class WebSocketServer {
  private io: Server | null = null;

  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(AuthService) private authService: AuthService
  ) {}

  init(httpServer: HttpServer): Server {
    if (this.io) return this.io;

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        credentials: true,
      },
    });

    this.io.use(this.createAuthMiddleware());

    return this.io;
  }

  private createAuthMiddleware() {
    return async (socket: any, next: any) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Unauthorized"));
      }

      try {
        const userId = await this.authService.verifyToken(token);
        socket.data.userId = userId;
        next();
      } catch (err) {
        next(new Error("Unauthorized"));
      }
    };
  }

  getIO(): Server | null {
    return this.io;
  }

  close() {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }
}
```

**Namespace 使用依赖注入**:

```typescript
// websocket/namespaces/terminal.ts
import type { Namespace } from "socket.io";
import { container } from "tsyringe";
import { ProjectService } from "../../modules/project/service.js";
import { TerminalManager } from "../../modules/terminal/manager.js";
import { LoggerService } from "../../core/logger/logger.js";

export function setupTerminalNamespace(namespace: Namespace): void {
  const projectService = container.resolve(ProjectService);
  const terminalManager = container.resolve(TerminalManager);
  const logger = container.resolve(LoggerService);

  namespace.on("connection", async (socket) => {
    const userId = socket.data.userId;

    socket.on("start", async (data: unknown) => {
      // 使用注入的服务
      const project = await projectService.findById(userId, data.projectId);
      // ...
    });
  });
}
```

**Why:** 统一 WebSocket 架构，使用依赖注入，便于测试。
**How to apply:** WebSocketServer 使用 @singleton()，namespace 使用容器获取服务。

---

### 8. 删除废弃代码

**需要删除的文件/代码**:
1. `routes/drafts.ts` 中对 `../websocket/server.js` 的引用
2. `build-manager.ts` 中对 `../websocket/server.js` 的引用
3. 所有全局单例变量（如 `terminalManagerInstance`, `buildManagerInstance`）
4. 所有模块级别的 Repository 实例化

---

## 配置管理

**问题**: 配置分散，缺少类型安全。

**解决方案**:

```typescript
// core/config.ts
import { z } from "zod";

const configSchema = z.object({
  port: z.number().default(4000),
  dbPath: z.string().default("data/code-link.db"),
  jwtSecret: z.string().min(32),
  corsOrigin: z.string().default("http://localhost:3000"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  anthropicApiKey: z.string().optional(),
  claudeConfigEncryptionKey: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
    dbPath: process.env.DB_PATH,
    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: process.env.CORS_ORIGIN,
    logLevel: process.env.LOG_LEVEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    claudeConfigEncryptionKey: process.env.CLAUDE_CONFIG_ENCRYPTION_KEY,
  });
}
```

**Why:** 类型安全的配置，验证必需配置项。
**How to apply:** 启动时加载配置，注入到需要的服务中。

---

## 测试策略

每个模块应包含:
1. Repository 单元测试（使用 mock 数据库）
2. Service 单元测试（使用 mock Repository）
3. Controller 单元测试（使用 mock Service）
4. 集成测试（使用真实数据库）

```typescript
// tests/modules/project/service.test.ts
import { container } from "tsyringe";
import { ProjectService } from "../../../src/modules/project/service.js";
import { ProjectRepository } from "../../../src/modules/project/repository.js";
import { DatabaseConnection } from "../../../src/core/database/connection.js";

describe("ProjectService", () => {
  beforeAll(() => {
    // 注册测试数据库
    container.registerSingleton(DatabaseConnection);
    container.registerSingleton(ProjectRepository);
    container.registerSingleton(ProjectService);
  });

  afterAll(() => {
    container.reset();
  });

  it("should create project", async () => {
    const service = container.resolve(ProjectService);
    // ...
  });
});
```

---

## 实施顺序

1. **Phase 1: 基础设施**
   - 创建 core 目录结构
   - 实现 DatabaseConnection, LoggerService
   - 实现错误类和错误处理中间件
   - 实现 Zod 验证中间件

2. **Phase 2: 模块迁移**
   - 按顺序迁移: auth → organization → project → draft → build → terminal → git → claude-config → container
   - 每个模块创建完整的模块结构

3. **Phase 3: WebSocket 重构**
   - 实现 WebSocketServer 服务
   - 重构 namespace 使用依赖注入

4. **Phase 4: 清理**
   - 删除废弃代码
   - 删除全局单例变量
   - 统一 app.ts 和 server.ts

5. **Phase 5: 测试更新**
   - 更新现有测试适配新架构
   - 添加新测试覆盖