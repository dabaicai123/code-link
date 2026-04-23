import "reflect-metadata";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { container } from 'tsyringe';
import { getConfig } from './core/config.js';

// 数据库初始化
import { DatabaseConnection, initDefaultAdmin, createSqliteDb, runMigrations } from './db/index.js';

// 模块注册
import { registerCoreModule } from './core/core.module.js';
import { registerAuthModule, createAuthRoutes, AuthController, RateLimiterOptions } from './modules/auth/auth.module.js';
import { registerOrganizationModule, createOrganizationRoutes, createInvitationRoutes, OrganizationController } from './modules/organization/organization.module.js';
import { registerProjectModule, createProjectRoutes, ProjectController } from './modules/project/project.module.js';
import { registerDraftModule, createDraftRoutes, DraftController } from './modules/draft/draft.module.js';
import { registerBuildModule, createBuildRoutes, BuildController } from './modules/build/build.module.js';
import { registerGitProviderModule, createGitProviderRoutes, GitProviderController } from './modules/gitprovider/gitprovider.module.js';
import { registerClaudeConfigModule, createClaudeConfigRoutes, ClaudeConfigController } from './modules/claude-config/claude-config.module.js';
import { registerContainerModule, createContainerRoutes, ContainerController } from './modules/container/container.module.js';
import { registerCodeModule, createCodeRoutes, CodeController } from './modules/code/code.module.js';
import { registerSocketModule } from './socket/socket.module.js';

// 核心服务
import { LoggerService } from './core/logger/logger.js';
import { PermissionService } from './shared/permission.service.js';
import { createErrorHandler } from './core/errors/handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';

// WebSocket
import { createSocketServer } from './socket/index.js';
import { handleCodeServerWebSocketUpgrade } from './modules/code/proxy.js';
import { CodeServerManager } from './modules/code/code.module.js';

// 其他初始化
import { success, NotFoundError } from './core/errors/index.js';

const logger = new LoggerService();

export function createApp(authLimiterOptions?: RateLimiterOptions): express.Express {
  const app = express();

  // 注册核心模块（EncryptionService, LoggerService 等）
  registerCoreModule();

  // 注册 Socket 模块（SocketServerService）
  registerSocketModule();

  // 注册业务模块 — 顺序确保依赖的服务先注册：
  // Auth → Organization (depends on AuthService)
  // → Project (depends on PermissionService)
  // → ClaudeConfig → Build → Container (depends on ProjectService, ClaudeConfigService)
  // → Draft (depends on ProjectService, AuthService) → GitProvider
  registerAuthModule();
  registerOrganizationModule();
  registerProjectModule();
  registerClaudeConfigModule();
  registerBuildModule();
  registerContainerModule();
  registerCodeModule();
  registerDraftModule();
  registerGitProviderModule();

  // 获取配置
  const config = getConfig();

  // 中间件
  // Configure CORS with origin whitelist
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      const allowedOrigins = config.corsOrigins || [config.corsOrigin];
      // Allow requests with no origin (e.g., mobile apps, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(requestIdMiddleware);

  // Request-context logging — use module-level logger, not per-request container.resolve
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.log = logger.withContext({
      requestId: req.requestId,
      userId: req.userId ?? 'anonymous',
    });
    next();
  });

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json(success({ status: 'ok' }));
  });

  // 获取 Controller 实例
  const authController = container.resolve(AuthController);
  const orgController = container.resolve(OrganizationController);
  const projectController = container.resolve(ProjectController);
  const draftController = container.resolve(DraftController);
  const buildController = container.resolve(BuildController);
  const gitProviderController = container.resolve(GitProviderController);
  const claudeConfigController = container.resolve(ClaudeConfigController);
  const containerController = container.resolve(ContainerController);
  const codeController = container.resolve(CodeController);

  // 注册路由
  app.use('/api/auth', createAuthRoutes(authController, authLimiterOptions));
  app.use('/api/organizations', createOrganizationRoutes(orgController));
  app.use('/api/invitations', createInvitationRoutes(orgController));
  app.use('/api/projects', createProjectRoutes(projectController));
  app.use('/api/projects', createContainerRoutes(containerController));
  app.use('/api/projects', createCodeRoutes(codeController));
  app.use('/api/drafts', createDraftRoutes(draftController));
  app.use('/api/builds', createBuildRoutes(buildController));

  // GitProvider 返回两个路由器
  const { githubRouter, gitlabRouter } = createGitProviderRoutes(gitProviderController);
  app.use('/api/github', githubRouter);
  app.use('/api/gitlab', gitlabRouter);

  app.use('/api/claude-config', createClaudeConfigRoutes(claudeConfigController));

  // 404 处理
  app.use((_req, _res, next: express.NextFunction) => {
    next(new NotFoundError('接口'));
  });

  // 错误处理
  app.use(createErrorHandler(logger));

  return app;
}

export function startServer(port: number = 3001): void {
  const app = createApp();
  const server = createServer(app);

  // 初始化 Socket.IO 服务器
  createSocketServer(server);

  // 初始化 code-server WebSocket 反向代理
  const codeServerManager = container.resolve(CodeServerManager);
  handleCodeServerWebSocketUpgrade(codeServerManager, server);

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Socket.IO server ready on ws://localhost:${port}`);
  });
}

export interface E2EServerInstance {
  server: ReturnType<typeof createServer>;
  port: number;
  baseUrl: string;
  sqlite: import('better-sqlite3').Database;
  close: () => Promise<void>;
}

// Global E2E server instance for tests to access
let e2eServerInstance: E2EServerInstance | null = null;

export function getE2EServerInstance(): E2EServerInstance | null {
  return e2eServerInstance;
}

export async function startServerForE2E(options?: { port?: number }): Promise<E2EServerInstance> {
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = ':memory:';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret-key-minimum-32-chars-long';

  const { resetConfig } = await import('./core/config.js');
  resetConfig();

  const sqlite = createSqliteDb(':memory:');
  runMigrations(sqlite);

  // Register in-memory DatabaseConnection before DI resolves
  const { container } = await import('tsyringe');
  container.reset();
  const conn = DatabaseConnection.fromSqlite(sqlite);
  container.registerInstance(DatabaseConnection, conn);

  const app = createApp();
  const server = createServer(app);

  // 初始化 code-server WebSocket 反向代理
  const codeServerManager = container.resolve(CodeServerManager);
  handleCodeServerWebSocketUpgrade(codeServerManager, server);

  return new Promise((resolve, reject) => {
    server.listen(options?.port ?? 0, () => {
      const address = server.address() as import('net').AddressInfo;
      const instance: E2EServerInstance = {
        server,
        port: address.port,
        baseUrl: `http://localhost:${address.port}`,
        sqlite,
        close: () => new Promise<void>((res, rej) => {
          server.close((err) => {
            conn.close();
            e2eServerInstance = null;
            err ? rej(err) : res();
          });
        }),
      };
      e2eServerInstance = instance;
      resolve(instance);
    });
    server.on('error', reject);
  });
}

// 启动入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const sqlite = createSqliteDb();
  runMigrations(sqlite);

  // 注册 DatabaseConnection 到 DI 容器
  const dbConnection = DatabaseConnection.fromSqlite(sqlite);
  container.registerInstance(DatabaseConnection, dbConnection);

  await initDefaultAdmin(dbConnection);

  startServer(process.env.PORT ? parseInt(process.env.PORT) : 4000);
}
