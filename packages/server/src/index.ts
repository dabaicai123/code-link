import "reflect-metadata";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { container } from 'tsyringe';
import { getConfig } from './core/config.js';

// 数据库初始化
import { DatabaseConnection, initSchema, initDefaultAdmin, createSqliteDb } from './db/index.js';

// 模块注册
import { registerAuthModule, createAuthRoutes, AuthController } from './modules/auth/auth.module.js';
import { registerOrganizationModule, createOrganizationRoutes, createInvitationRoutes, OrganizationController } from './modules/organization/organization.module.js';
import { registerProjectModule, createProjectRoutes, ProjectController } from './modules/project/project.module.js';
import { registerDraftModule, createDraftRoutes, DraftController } from './modules/draft/draft.module.js';
import { registerBuildModule, createBuildRoutes, BuildController } from './modules/build/build.module.js';
import { registerGitProviderModule, createGitProviderRoutes, GitProviderController } from './modules/gitprovider/gitprovider.module.js';
import { registerClaudeConfigModule, createClaudeConfigRoutes, ClaudeConfigController } from './modules/claude-config/claude-config.module.js';
import { registerContainerModule, createContainerRoutes, ContainerController } from './modules/container/container.module.js';
import { registerCodeModule, createCodeRoutes, CodeController } from './modules/code/code.module.js';
import { DockerService } from './modules/container/lib/docker.service.js';

// 核心服务
import { LoggerService } from './core/logger/logger.js';
import { PermissionService } from './shared/permission.service.js';
import { createErrorHandler } from './core/errors/handler.js';

// WebSocket
import { createSocketServer } from './socket/index.js';

// 其他初始化
import { setEncryptionKey } from './crypto/aes.js';
import { initAIClient } from './modules/draft/lib/client.js';
import { success, Errors } from './core/errors/index.js';

const logger = new LoggerService();

export function createApp(dbConnection?: DatabaseConnection): express.Express {
  // Register DatabaseConnection BEFORE module registration to prevent
  // @singleton() from creating a second empty :memory: instance
  if (dbConnection) {
    container.registerInstance(DatabaseConnection, dbConnection);
  }

  const app = express();

  // 注册所有模块（@singleton() 装饰器会自动处理 DI）
  registerAuthModule();
  registerOrganizationModule();
  registerProjectModule();
  registerDraftModule();
  registerBuildModule();
  registerGitProviderModule();
  registerClaudeConfigModule();
  registerContainerModule();
  registerCodeModule();

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

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json(success({ status: 'ok' }));
  });

  // Test-only database reset endpoint (only available in test env)
  if (getConfig().nodeEnv === 'test') {
    app.post('/api/test/reset', (_req, res) => {
      const conn = container.resolve(DatabaseConnection);
      const sqlite = conn.getSqlite();
      sqlite.exec('PRAGMA foreign_keys = OFF');
      const tables = sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all() as { name: string }[];
      for (const { name } of tables) {
        sqlite.exec(`DELETE FROM ${name}`);
      }
      sqlite.exec('PRAGMA foreign_keys = ON');
      res.json(success({ reset: true }));
    });

    app.post('/api/test/cleanup-containers', async (_req, res) => {
      const dockerService = container.resolve(DockerService);
      await dockerService.cleanupTestContainers();
      res.json(success({ cleanup: true }));
    });
  }

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
  app.use('/api/auth', createAuthRoutes(authController));
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
  app.use((_req, res) => {
    res.status(404).json(Errors.notFound('接口'));
  });

  // 错误处理
  app.use(createErrorHandler(logger));

  return app;
}

export function startServer(port: number = 3001): void {
  const sqlite = createSqliteDb();
  initSchema(sqlite);
  const dbConnection = DatabaseConnection.fromSqlite(sqlite);

  const app = createApp(dbConnection);
  const server = createServer(app);

  // 初始化 Socket.IO 服务器
  createSocketServer(server);

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
  initSchema(sqlite);

  const conn = DatabaseConnection.fromSqlite(sqlite);
  // createApp(conn) registers the connection BEFORE module registration
  const app = createApp(conn);
  const server = createServer(app);

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
  // 设置加密密钥
  const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }
  setEncryptionKey(encryptionKey);

  // 初始化 AI 客户端
  initAIClient();

  // startServer handles db init + schema + DI registration
  startServer(process.env.PORT ? parseInt(process.env.PORT) : 4000);

  // Create default admin after server starts (needs DI-registered DatabaseConnection)
  await initDefaultAdmin();
}
