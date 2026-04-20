import "reflect-metadata";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { container } from 'tsyringe';

// 数据库初始化
import { getSqliteDb, initSchema, initDefaultAdmin } from './db/index.js';

// 模块注册
import { registerAuthModule, createAuthRoutes, AuthController } from './modules/auth/auth.module.js';
import { registerOrganizationModule, createOrganizationRoutes, OrganizationController } from './modules/organization/organization.module.js';
import { registerProjectModule, createProjectRoutes, ProjectController } from './modules/project/project.module.js';
import { registerDraftModule, createDraftRoutes, DraftController } from './modules/draft/draft.module.js';
import { registerBuildModule, createBuildRoutes, BuildController } from './modules/build/build.module.js';
import { registerGitProviderModule, createGitProviderRoutes, GitProviderController } from './modules/gitprovider/gitprovider.module.js';
import { registerClaudeConfigModule, createClaudeConfigRoutes, ClaudeConfigController } from './modules/claude-config/claude-config.module.js';
import { registerContainerModule, createContainerRoutes, ContainerController } from './modules/container/container.module.js';

// 核心服务
import { DatabaseConnection } from './core/database/connection.js';
import { LoggerService } from './core/logger/logger.js';
import { PermissionService } from './shared/permission.service.js';
import { createErrorHandler } from './core/errors/handler.js';

// WebSocket
import { createSocketServer } from './socket/index.js';

// 其他初始化
import { setEncryptionKey } from './crypto/aes.js';
import { initAIClient } from './ai/client.js';
import { success, Errors } from './core/errors/index.js';

const logger = new LoggerService();

export function createApp(): express.Express {
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

  // 中间件
  app.use(cors());
  app.use(express.json());

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

  // 注册路由
  app.use('/api/auth', createAuthRoutes(authController));
  app.use('/api/organizations', createOrganizationRoutes(orgController));
  app.use('/api/projects', createProjectRoutes(projectController));
  app.use('/api/projects', createContainerRoutes(containerController));
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
  const app = createApp();
  const server = createServer(app);

  // 初始化 Socket.IO 服务器
  createSocketServer(server);

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Socket.IO server ready on ws://localhost:${port}`);
  });
}

// 启动入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const db = getSqliteDb();
  initSchema(db);
  await initDefaultAdmin();

  // 设置加密密钥
  const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }
  setEncryptionKey(encryptionKey);

  // 初始化 AI 客户端
  initAIClient();

  startServer(process.env.PORT ? parseInt(process.env.PORT) : 4000);
}
