# 后端架构重构实施计划 - Phase 1: 基础设施

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立核心基础设施层，包括数据库连接、日志服务、错误处理、验证中间件和配置管理。

**Architecture:** 创建 `core/` 目录，实现 DatabaseConnection、LoggerService、AppError 体系、Zod 验证中间件和 Config 服务，所有服务使用 TSyringe @singleton() 装饰器。

**Tech Stack:** TypeScript, TSyringe, Drizzle ORM, SQLite, Zod, Pino

---

## 文件结构

```
packages/server/src/
├── core/
│   ├── config.ts                 # 配置加载
│   ├── database/
│   │   ├── connection.ts         # 数据库连接服务
│   │   └── base.repository.ts    # Repository 基类
│   ├── logger/
│   │   ├── logger.ts             # 日志服务
│   │   └── types.ts              # 日志类型定义
│   └── errors/
│       ├── errors.ts             # 错误类定义
│       ├── handler.ts            # 错误处理中间件
│       └── response.ts           # 响应格式化工具
├── middleware/
│   ├── validation.ts             # Zod 验证中间件
│   └── request-id.ts             # 请求 ID 中间件
└── types/
    └── express.d.ts              # Express 类型扩展
```

---

### Task 1: 配置服务

**Files:**
- Create: `packages/server/src/core/config.ts`
- Create: `packages/server/tests/core/config.test.ts`

- [ ] **Step 1: 安装 pino 依赖**

```bash
cd /root/my/code-link/packages/server && pnpm add pino pino-pretty
```

- [ ] **Step 2: 编写配置服务测试**

```typescript
// tests/core/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, Config } from '../../src/core/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load config with defaults', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    const config = loadConfig();
    expect(config.port).toBe(4000);
    expect(config.dbPath).toBe('data/code-link.db');
    expect(config.corsOrigin).toBe('http://localhost:3000');
    expect(config.logLevel).toBe('info');
  });

  it('should throw if JWT_SECRET is too short', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => loadConfig()).toThrow();
  });

  it('should use environment variables when set', () => {
    process.env.PORT = '5000';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.DB_PATH = '/custom/path.db';
    process.env.LOG_LEVEL = 'debug';

    const config = loadConfig();
    expect(config.port).toBe(5000);
    expect(config.dbPath).toBe('/custom/path.db');
    expect(config.logLevel).toBe('debug');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/config.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 4: 实现配置服务**

```typescript
// src/core/config.ts
import { z } from 'zod';

const configSchema = z.object({
  port: z.number().int().positive().default(4000),
  dbPath: z.string().default('data/code-link.db'),
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  corsOrigin: z.string().default('http://localhost:3000'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  anthropicApiKey: z.string().optional(),
  claudeConfigEncryptionKey: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    dbPath: process.env.DB_PATH,
    jwtSecret: process.env.JWT_SECRET || 'code-link-dev-secret-key-min-32-chars',
    corsOrigin: process.env.CORS_ORIGIN,
    logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    claudeConfigEncryptionKey: process.env.CLAUDE_CONFIG_ENCRYPTION_KEY,
  });
}

// 全局配置实例
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/config.test.ts
```
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git -C /root/my/code-link add packages/server/src/core/config.ts packages/server/tests/core/config.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add config service with Zod validation

- Type-safe configuration loading
- Environment variable support
- Default values for optional config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 日志服务

**Files:**
- Create: `packages/server/src/core/logger/logger.ts`
- Create: `packages/server/src/core/logger/types.ts`
- Create: `packages/server/src/core/logger/index.ts`
- Create: `packages/server/tests/core/logger.test.ts`

- [ ] **Step 1: 编写日志服务测试**

```typescript
// tests/core/logger.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoggerService } from '../../src/core/logger/logger.js';

describe('LoggerService', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService('debug');
  });

  it('should create logger instance', () => {
    expect(logger).toBeDefined();
  });

  it('should have info, warn, error, debug methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log messages without throwing', () => {
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.warn('warn message')).not.toThrow();
    expect(() => logger.error('error message')).not.toThrow();
    expect(() => logger.debug('debug message')).not.toThrow();
  });

  it('should log with context object', () => {
    expect(() => logger.info('test', { userId: 1, action: 'test' })).not.toThrow();
  });

  it('should create child logger with module name', () => {
    const childLogger = logger.child('auth');
    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/logger.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现日志服务**

```typescript
// src/core/logger/types.ts
export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  child(module: string): Logger;
}
```

```typescript
// src/core/logger/logger.ts
import { singleton } from 'tsyringe';
import pino, { Logger as PinoLogger } from 'pino';
import type { Logger, LogContext } from './types.js';

@singleton()
export class LoggerService implements Logger {
  private logger: PinoLogger;
  private moduleName?: string;

  constructor(level: string = 'info') {
    this.logger = pino({
      level,
      transport: process.env.NODE_ENV !== 'test'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          }
        : undefined,
    });
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(context || {}, this.formatMessage(message));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(context || {}, this.formatMessage(message));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? { ...context, error: error.message, stack: error.stack }
      : context;
    this.logger.error(errorContext || {}, this.formatMessage(message));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(context || {}, this.formatMessage(message));
  }

  child(module: string): Logger {
    const childLogger = new LoggerService();
    childLogger.logger = this.logger.child({ module });
    childLogger.moduleName = module;
    return childLogger;
  }

  private formatMessage(message: string): string {
    return this.moduleName ? `[${this.moduleName}] ${message}` : message;
  }
}

// 工厂函数，便于非 DI 场景使用
export function createLogger(module: string): Logger {
  const service = new LoggerService(process.env.LOG_LEVEL || 'info');
  return service.child(module);
}
```

```typescript
// src/core/logger/index.ts
export { LoggerService } from './logger.js';
export { createLogger } from './logger.js';
export type { Logger, LogContext } from './types.js';
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/logger.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/core/logger/ packages/server/tests/core/logger.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add LoggerService with Pino

- Singleton LoggerService with TSyringe
- Child logger support for module context
- Pretty print in development

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 错误类体系

**Files:**
- Create: `packages/server/src/core/errors/errors.ts`
- Create: `packages/server/src/core/errors/response.ts`
- Create: `packages/server/src/core/errors/index.ts`
- Create: `packages/server/tests/core/errors.test.ts`

- [ ] **Step 1: 编写错误类测试**

```typescript
// tests/core/errors.test.ts
import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  PermissionError,
  AuthError,
  ConflictError,
  isAppError,
  success,
  errorResponse,
} from '../../src/core/errors/index.js';

describe('Errors', () => {
  describe('AppError', () => {
    it('should create AppError with all properties', () => {
      const err = new AppError('Test error', 'TEST_ERROR', 400, ['detail1']);
      expect(err.message).toBe('Test error');
      expect(err.code).toBe('TEST_ERROR');
      expect(err.httpStatus).toBe(400);
      expect(err.details).toEqual(['detail1']);
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError', () => {
      const err = new ValidationError(['field is required', 'invalid format']);
      expect(err.message).toBe('参数验证失败');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.httpStatus).toBe(400);
      expect(err.details).toEqual(['field is required', 'invalid format']);
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError', () => {
      const err = new NotFoundError('项目');
      expect(err.message).toBe('项目不存在');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.httpStatus).toBe(404);
    });
  });

  describe('PermissionError', () => {
    it('should create PermissionError with default message', () => {
      const err = new PermissionError();
      expect(err.message).toBe('权限不足');
      expect(err.code).toBe('FORBIDDEN');
      expect(err.httpStatus).toBe(403);
    });

    it('should create PermissionError with custom message', () => {
      const err = new PermissionError('只有管理员可以操作');
      expect(err.message).toBe('只有管理员可以操作');
    });
  });

  describe('AuthError', () => {
    it('should create AuthError', () => {
      const err = new AuthError();
      expect(err.message).toBe('请先登录');
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.httpStatus).toBe(401);
    });
  });

  describe('ConflictError', () => {
    it('should create ConflictError', () => {
      const err = new ConflictError('资源已存在');
      expect(err.message).toBe('资源已存在');
      expect(err.code).toBe('CONFLICT');
      expect(err.httpStatus).toBe(409);
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new NotFoundError('项目'))).toBe(true);
      expect(isAppError(new Error('test'))).toBe(false);
    });
  });

  describe('response helpers', () => {
    it('should create success response', () => {
      const res = success({ id: 1, name: 'test' });
      expect(res).toEqual({ success: true, data: { id: 1, name: 'test' } });
    });

    it('should create error response', () => {
      const res = errorResponse('NOT_FOUND', '资源不存在', 404);
      expect(res).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: '资源不存在' },
      });
    });

    it('should create error response with details', () => {
      const res = errorResponse('VALIDATION_ERROR', '验证失败', 400, ['field required']);
      expect(res).toEqual({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '验证失败', details: ['field required'] },
      });
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/errors.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现错误类**

```typescript
// src/core/errors/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(details: string[]) {
    super('参数验证失败', 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}不存在`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'PermissionError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = '请先登录') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'AuthError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class ParamError extends AppError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST', 400);
    this.name = 'ParamError';
  }
}

// Type guards
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
```

```typescript
// src/core/errors/response.ts
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function errorResponse(
  code: string,
  message: string,
  httpStatus: number,
  details?: string[]
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
  };
}

// 便捷方法
export const Errors = {
  notFound: (resource: string): ErrorResponse =>
    errorResponse('NOT_FOUND', `${resource}不存在`, 404),

  forbidden: (message: string = '权限不足'): ErrorResponse =>
    errorResponse('FORBIDDEN', message, 403),

  unauthorized: (message: string = '请先登录'): ErrorResponse =>
    errorResponse('UNAUTHORIZED', message, 401),

  badRequest: (message: string, details?: string[]): ErrorResponse =>
    errorResponse('BAD_REQUEST', message, 400, details),

  validationError: (details: string[]): ErrorResponse =>
    errorResponse('VALIDATION_ERROR', '参数验证失败', 400, details),

  conflict: (message: string): ErrorResponse =>
    errorResponse('CONFLICT', message, 409),

  internal: (message: string = '服务器内部错误'): ErrorResponse =>
    errorResponse('INTERNAL_ERROR', message, 500),
};
```

```typescript
// src/core/errors/index.ts
export {
  AppError,
  ValidationError,
  NotFoundError,
  PermissionError,
  AuthError,
  ConflictError,
  ParamError,
  isAppError,
  isNotFoundError,
  isPermissionError,
  isValidationError,
} from './errors.js';

export {
  success,
  errorResponse,
  Errors,
  type SuccessResponse,
  type ErrorResponse,
  type ApiResponse,
} from './response.js';
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/errors.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/core/errors/ packages/server/tests/core/errors.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add unified error classes and response helpers

- AppError base class with code, httpStatus, details
- Specialized error classes: NotFoundError, PermissionError, etc.
- Type guards for error checking
- Response helpers: success(), errorResponse(), Errors

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 错误处理中间件

**Files:**
- Create: `packages/server/src/core/errors/handler.ts`
- Create: `packages/server/tests/core/error-handler.test.ts`

- [ ] **Step 1: 编写错误处理中间件测试**

```typescript
// tests/core/error-handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { createErrorHandler } from '../../src/core/errors/handler.js';
import { NotFoundError, ValidationError, AppError } from '../../src/core/errors/index.js';
import { LoggerService } from '../../src/core/logger/logger.js';

describe('createErrorHandler', () => {
  let handler: ReturnType<typeof createErrorHandler>;
  let mockLogger: LoggerService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    handler = createErrorHandler(mockLogger as LoggerService);

    mockReq = { requestId: 'test-request-id' };
    mockNext = vi.fn();

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  it('should handle AppError correctly', () => {
    const err = new NotFoundError('项目');
    handler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: '项目不存在' },
    });
  });

  it('should handle ValidationError with details', () => {
    const err = new ValidationError(['field is required', 'invalid format']);
    handler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数验证失败',
        details: ['field is required', 'invalid format'],
      },
    });
  });

  it('should handle unknown errors as internal error', () => {
    const err = new Error('Unexpected error');
    handler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should log AppError with warn level', () => {
    const err = new NotFoundError('项目');
    handler(err, mockReq as Request, mockRes as Response, mockNext);
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/error-handler.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现错误处理中间件**

```typescript
// src/core/errors/handler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError, errorResponse } from './errors.js';
import { LoggerService } from '../logger/logger.js';

export function createErrorHandler(logger: LoggerService) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = (req as any).requestId || 'unknown';

    if (isAppError(err)) {
      logger.warn(`[${requestId}] ${err.code}: ${err.message}`);
      res.status(err.httpStatus).json(
        errorResponse(err.code, err.message, err.httpStatus, err.details)
      );
      return;
    }

    logger.error(`[${requestId}] Unexpected error:`, err);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', '服务器内部错误', 500)
    );
  };
}

// 异步路由包装器
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

- [ ] **Step 4: 更新错误索引导出**

```typescript
// src/core/errors/index.ts (追加)
export { createErrorHandler, asyncHandler } from './handler.js';
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/error-handler.test.ts
```
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git -C /root/my/code-link add packages/server/src/core/errors/ packages/server/tests/core/error-handler.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add error handler middleware and asyncHandler

- createErrorHandler for unified error handling
- asyncHandler wrapper for async routes
- Proper logging for different error types

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 数据库连接服务

**Files:**
- Create: `packages/server/src/core/database/connection.ts`
- Create: `packages/server/src/core/database/base.repository.ts`
- Create: `packages/server/src/core/database/index.ts`
- Create: `packages/server/tests/core/database.test.ts`

- [ ] **Step 1: 编写数据库连接测试**

```typescript
// tests/core/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../../src/core/database/connection.js';
import { BaseRepository } from '../../src/core/database/base.repository.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-db-phase1.db');

describe('DatabaseConnection', () => {
  let db: DatabaseConnection;

  beforeEach(() => {
    db = new DatabaseConnection(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-shm`);
    }
  });

  it('should create database connection', () => {
    expect(db).toBeDefined();
    expect(db.getDb()).toBeDefined();
  });

  it('should execute queries', () => {
    const drizzle = db.getDb();
    drizzle.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
    drizzle.run(sql`INSERT INTO test (name) VALUES ('test')`);
    const result = drizzle.all(sql`SELECT * FROM test`);
    expect(result).toHaveLength(1);
  });

  it('should support transactions', () => {
    const drizzle = db.getDb();
    drizzle.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);

    db.transaction(() => {
      drizzle.run(sql`INSERT INTO test (name) VALUES ('test1')`);
      drizzle.run(sql`INSERT INTO test (name) VALUES ('test2')`);
    });

    const result = drizzle.all(sql`SELECT * FROM test`);
    expect(result).toHaveLength(2);
  });

  it('should rollback on error in transaction', () => {
    const drizzle = db.getDb();
    drizzle.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);

    try {
      db.transaction(() => {
        drizzle.run(sql`INSERT INTO test (name) VALUES ('test1')`);
        throw new Error('rollback test');
      });
    } catch (e) {
      // expected
    }

    const result = drizzle.all(sql`SELECT * FROM test`);
    expect(result).toHaveLength(0);
  });
});

describe('BaseRepository', () => {
  let db: DatabaseConnection;

  beforeEach(() => {
    db = new DatabaseConnection(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('should provide access to query builder', () => {
    class TestRepo extends BaseRepository {
      test() {
        return this.getQuery();
      }
    }

    const repo = new TestRepo(db);
    expect(repo.test()).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/database.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现数据库连接服务**

```typescript
// src/core/database/connection.ts
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../db/schema/index.js';
import { singleton } from 'tsyringe';
import { getConfig } from '../config.js';

@singleton()
export class DatabaseConnection {
  private db: BetterSQLite3Database<typeof schema>;
  private sqlite: Database.Database;

  constructor(dbPath?: string) {
    const config = getConfig();
    const path = dbPath || config.dbPath;
    
    this.sqlite = new Database(path);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzle(this.sqlite, { schema });
  }

  getDb(): BetterSQLite3Database<typeof schema> {
    return this.db;
  }

  getSqlite(): Database.Database {
    return this.sqlite;
  }

  transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn)() as T;
  }

  close(): void {
    this.sqlite.close();
  }
}

// 导出 sql 标签用于原生查询
export { sql } from 'drizzle-orm';
```

```typescript
// src/core/database/base.repository.ts
import { inject } from 'tsyringe';
import { DatabaseConnection } from './connection.js';

export abstract class BaseRepository {
  constructor(
    @inject(DatabaseConnection) protected readonly dbConnection: DatabaseConnection
  ) {}

  protected get db() {
    return this.dbConnection.getDb();
  }

  protected transaction<T>(fn: () => T): T {
    return this.dbConnection.transaction(fn);
  }
}
```

```typescript
// src/core/database/index.ts
export { DatabaseConnection, sql } from './connection.js';
export { BaseRepository } from './base.repository.js';
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/core/database.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/core/database/ packages/server/tests/core/database.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add DatabaseConnection service with transaction support

- Singleton DatabaseConnection with TSyringe
- Transaction support with automatic rollback
- BaseRepository abstract class for DI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Zod 验证中间件

**Files:**
- Create: `packages/server/src/middleware/validation.ts`
- Create: `packages/server/tests/middleware/validation.test.ts`

- [ ] **Step 1: 编写验证中间件测试**

```typescript
// tests/middleware/validation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../src/middleware/validation.js';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('validateBody', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });

    it('should pass valid body', () => {
      mockReq.body = { name: 'test', age: 25 };
      validateBody(schema)(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({ name: 'test', age: 25 });
    });

    it('should reject invalid body', () => {
      mockReq.body = { name: '', age: -1 };
      validateBody(schema)(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should strip unknown properties with strict mode', () => {
      const strictSchema = z.object({ name: z.string() }).strict();
      mockReq.body = { name: 'test', unknown: 'field' };
      
      validateBody(strictSchema)(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().regex(/^\d+$/).transform(Number),
    });

    it('should pass valid params', () => {
      mockReq.params = { id: '123' };
      validateParams(schema)(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.params).toEqual({ id: 123 });
    });

    it('should reject invalid params', () => {
      mockReq.params = { id: 'abc' };
      validateParams(schema)(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.string().transform(Number).default('1'),
      limit: z.string().transform(Number).default('10'),
    });

    it('should pass valid query with defaults', () => {
      mockReq.query = {};
      validateQuery(schema)(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ page: 1, limit: 10 });
    });

    it('should use provided values', () => {
      mockReq.query = { page: '2', limit: '20' };
      validateQuery(schema)(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ page: 2, limit: 20 });
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/middleware/validation.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现验证中间件**

```typescript
// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { Errors } from '../core/errors/index.js';

function formatZodError(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
    }
    req.params = result.data as Record<string, string>;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
    }
    req.query = result.data as Record<string, any>;
    next();
  };
}

// 组合验证器
export function validate(schema: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        res.status(400).json(Errors.validationError(formatZodError(result.error)));
        return;
      }
      req.body = result.data;
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        res.status(400).json(Errors.validationError(formatZodError(result.error)));
        return;
      }
      req.params = result.data as Record<string, string>;
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        res.status(400).json(Errors.validationError(formatZodError(result.error)));
        return;
      }
      req.query = result.data as Record<string, any>;
    }

    next();
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/middleware/validation.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/middleware/validation.ts packages/server/tests/middleware/validation.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add Zod validation middleware

- validateBody, validateParams, validateQuery middleware
- Combined validate() function for multiple sources
- Proper error formatting with field paths

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 请求 ID 中间件

**Files:**
- Create: `packages/server/src/middleware/request-id.ts`
- Create: `packages/server/src/types/express.d.ts`
- Create: `packages/server/tests/middleware/request-id.test.ts`

- [ ] **Step 1: 编写请求 ID 中间件测试**

```typescript
// tests/middleware/request-id.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

describe('requestIdMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      setHeader: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should generate request ID if not provided', () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).requestId).toBeDefined();
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      (mockReq as any).requestId
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use provided request ID from header', () => {
    mockReq.headers = { 'x-request-id': 'provided-id' };
    
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).requestId).toBe('provided-id');
    expect(mockRes.setHeader).toHaveBeenCalledWith('x-request-id', 'provided-id');
  });

  it('should generate valid UUID format', () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const uuid = (mockReq as any).requestId;
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/middleware/request-id.test.ts
```
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现请求 ID 中间件**

```typescript
// src/middleware/request-id.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
```

```typescript
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: number;
      orgRole?: 'owner' | 'developer' | 'member';
    }
  }
}

export {};
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /root/my/code-link/packages/server && pnpm test tests/middleware/request-id.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /root/my/code-link add packages/server/src/middleware/request-id.ts packages/server/src/types/express.d.ts packages/server/tests/middleware/request-id.test.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add request ID middleware

- Generate or use existing x-request-id
- Set response header for tracing
- Express type extensions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Core 模块索引

**Files:**
- Create: `packages/server/src/core/index.ts`

- [ ] **Step 1: 创建 Core 模块索引**

```typescript
// src/core/index.ts
export * from './config.js';
export * from './database/index.js';
export * from './logger/index.js';
export * from './errors/index.js';
```

- [ ] **Step 2: 提交**

```bash
git -C /root/my/code-link add packages/server/src/core/index.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat(server): add core module index

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 运行所有测试验证

- [ ] **Step 1: 运行全部测试**

```bash
cd /root/my/code-link/packages/server && pnpm test
```
Expected: All tests PASS

- [ ] **Step 2: 修复任何失败的测试**

如果测试失败，逐一修复后再运行。

---

## 完成检查

- [ ] 所有 core 模块测试通过
- [ ] 所有中间件测试通过
- [ ] 无 TypeScript 编译错误
- [ ] 代码已提交到 main 分支

## 下一步

Phase 1 完成后，继续 Phase 2: 模块迁移（Auth 模块）
