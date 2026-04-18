# 后端日志系统设计

## 目标

为 packages/server 添加全链路日志追踪能力，支持通过请求 ID 追踪一个请求从 HTTP 进入到 WebSocket、Docker 操作的完整生命周期。

## 核心需求

- 四个日志级别：DEBUG、INFO、WARN、ERROR
- 文本格式输出，人类可读
- 全链路追踪：HTTP → 中间件 → 路由 → WebSocket → Docker
- 通过环境变量控制日志级别

## 架构设计

### 组件结构

```
src/logger/
├── index.ts          # 导出 Logger 和中间件
├── logger.ts         # Logger 类实现
├── context.ts        # AsyncLocalStorage 上下文管理
└── middleware.ts     # Express 请求日志中间件
```

### 依赖关系

```
Express Request → middleware.ts (生成 reqId, 存入 context)
                  ↓
              context.ts (AsyncLocalStorage 存储)
                  ↓
              logger.ts (自动获取 reqId, 格式化输出)
                  ↓
              各模块调用 logger.info/debug/warn/error
```

## 详细设计

### 1. AsyncLocalStorage 上下文 (context.ts)

使用 Node.js 原生 `AsyncLocalStorage` API：

```typescript
import { AsyncLocalStorage } from 'async_hooks';

interface LogContext {
  reqId: string;
}

const logContextStorage = new AsyncLocalStorage<LogContext>();

// 获取当前上下文
function getContext(): LogContext | undefined {
  return logContextStorage.getStore();
}

// 在上下文中运行
function runWithContext<T>(reqId: string, fn: () => T): T {
  return logContextStorage.run({ reqId }, fn);
}
```

### 2. Logger 类 (logger.ts)

```typescript
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private module: string;
  private level: LogLevel;

  constructor(module: string);

  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error | unknown): void;

  // 格式化输出
  private format(level: LogLevel, message: string): string;
  // 获取当前 reqId
  private getReqId(): string | undefined;
}

// 为每个模块创建 logger 实例
function createLogger(module: string): Logger;
```

### 3. 日志格式

```
[YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [req:xxx] [module] message
```

示例：
```
[2026-04-18 14:30:45.123] [INFO] [req:a1b2c3] [server] Server running on http://localhost:4000
[2026-04-18 14:30:46.789] [DEBUG] [req:d4e5f6] [auth] Verifying JWT token
[2026-04-18 14:30:47.001] [ERROR] [req:d4e5f6] [containers] Failed to start container: Docker not running
```

无 reqId 时（如启动日志）：
```
[2026-04-18 14:30:45.000] [INFO] [server] Server initialized
```

### 4. Express 中间件 (middleware.ts)

```typescript
import { runWithContext } from './context.js';

function requestLoggingMiddleware(req, res, next): void {
  // 生成短格式 UUID (8字符)
  const reqId = generateShortId();

  // 记录请求开始
  logger.debug(`--> ${req.method} ${req.path}`);

  // 在上下文中运行后续处理
  runWithContext(reqId, () => {
    // 设置响应头，方便前端追踪
    res.setHeader('X-Request-Id', reqId);

    // 记录响应完成
    res.on('finish', () => {
      logger.debug(`<-- ${res.statusCode} (${Date.now() - startTime}ms)`);
    });

    next();
  });
}
```

### 5. WebSocket 适配

在 `websocket/server.ts` 的连接处理中：

```typescript
// terminal 连接
if (urlObj.pathname === '/terminal') {
  const reqId = generateShortId();
  runWithContext(reqId, () => {
    logger.info(`Terminal WebSocket connected: projectId=${projectId}, userId=${userId}`);
    handleTerminalConnection(ws, projectId, userId, db);
  });
  return;
}

// 实时同步连接
ws.on('connection', (ws) => {
  const reqId = generateShortId();
  // 存储到 ws 对象上，后续消息处理时恢复上下文
  (ws as any)._reqId = reqId;
  runWithContext(reqId, () => {
    logger.info('WebSocket client connected');
  });
});
```

### 6. 环境配置

```typescript
// 默认级别
const DEFAULT_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';

// 通过环境变量覆盖
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || DEFAULT_LEVEL;

// 级别优先级
const LEVEL_PRIORITY = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};
```

## 改动范围

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/logger/index.ts` | 导出入口 |
| `src/logger/context.ts` | AsyncLocalStorage 上下文 |
| `src/logger/logger.ts` | Logger 类 |
| `src/logger/middleware.ts` | Express 中间件 |
| `src/logger/id.ts` | reqId 生成函数 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/index.ts` | 添加请求日志中间件，替换 console.log |
| `src/middleware/auth.ts` | 替换 console.warn，添加认证日志 |
| `src/routes/*.ts` | 替换所有 console.error，使用 logger |
| `src/websocket/server.ts` | WebSocket 连接添加 reqId 上下文 |
| `src/terminal/terminal-manager.ts` | 替换 console.error/warn |
| `src/build/preview-container.ts` | 替换 console.error |
| `src/docker/*.ts` | 添加 Docker 操作日志（可选） |

## 实现顺序

1. 创建 logger 基础模块
2. 添加 Express 请求中间件
3. 替换现有 console 调用
4. 适配 WebSocket 连接
5. 添加 Docker 操作日志（可选增强）

## 不在范围内

- 日志文件写入（仅输出到 stdout）
- 外部日志系统集成（ELK 等）
- 性能指标采集
- 日志归档和清理