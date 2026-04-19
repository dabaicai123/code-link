import "reflect-metadata";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { getSqliteDb, initSchema, initDefaultAdmin } from './db/index.js';
import { createAuthRouter } from './routes/auth.js';
import { createProjectsRouter } from './routes/projects.js';
import { createContainersRouter } from './routes/containers.js';
import { createGitHubRouter } from './routes/github.js';
import { createGitLabRouter } from './routes/gitlab.js';
import { createReposRouter } from './routes/repos.js';
import { createBuildsRouter } from './routes/builds.js';
import { createClaudeConfigRouter } from './routes/claude-config.js';
import { createDraftsRouter } from './routes/drafts.js';
import { createOrganizationsRouter } from './routes/organizations.js';
import { createInvitationsRouter } from './routes/invitations.js';
import { createWebSocketServer } from './websocket/server.js';
import { requestLoggingMiddleware, createLogger } from './logger/index.js';
import { setEncryptionKey } from './crypto/aes.js';
import { initAIClient } from './ai/client.js';
import { success, Errors } from './utils/response.js';
import type Database from 'better-sqlite3';

const logger = createLogger('server');

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLoggingMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json(success({ status: 'ok' }));
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/projects', createProjectsRouter());
  app.use('/api/projects', createContainersRouter());
  app.use('/api/github', createGitHubRouter());
  app.use('/api/gitlab', createGitLabRouter());
  app.use('/api/projects/:projectId/repos', createReposRouter());
  app.use('/api/builds', createBuildsRouter());
  app.use('/api/claude-config', createClaudeConfigRouter());
  app.use('/api/organizations', createOrganizationsRouter());
  app.use('/api/invitations', createInvitationsRouter());
  app.use('/api/drafts', createDraftsRouter());

  app.use((_req, res) => {
    res.status(404).json(Errors.notFound('接口'));
  });

  return app;
}

export function startServer(port: number = 3001): void {
  const app = createApp();
  const server = createServer(app);

  // 初始化 WebSocket 服务器
  createWebSocketServer(server);

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`WebSocket server ready on ws://localhost:${port}`);
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