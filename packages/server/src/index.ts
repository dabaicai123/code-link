import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import type Database from 'better-sqlite3';
import { getDb } from './db/connection.js';
import { initSchema } from './db/schema.js';
import { createAuthRouter } from './routes/auth.js';
import { createProjectsRouter } from './routes/projects.js';
import { createContainersRouter } from './routes/containers.js';
import { createGitHubRouter } from './routes/github.js';
import { createGitLabRouter } from './routes/gitlab.js';
import { createReposRouter } from './routes/repos.js';
import { createBuildsRouter } from './routes/builds.js';
import { createClaudeConfigRouter } from './routes/claude-config.js';
import { createDraftsRouter } from './routes/drafts.js';
import { createWebSocketServer } from './websocket/server.js';
import { requestLoggingMiddleware, createLogger } from './logger/index.js';
import { setEncryptionKey } from './crypto/aes.js';
import { initAIClient } from './ai/client.js';

const logger = createLogger('server');

export function createApp(db: Database.Database): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLoggingMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/projects', createProjectsRouter(db));
  app.use('/api/projects', createContainersRouter(db));
  app.use('/api/github', createGitHubRouter(db));
  app.use('/api/gitlab', createGitLabRouter(db));
  app.use('/api/projects/:projectId/repos', createReposRouter(db));
  app.use('/api/builds', createBuildsRouter(db));
  app.use('/api/claude-config', createClaudeConfigRouter(db));
  app.use('/api/drafts', createDraftsRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

export function startServer(db: Database.Database, port: number = 3001): void {
  const app = createApp(db);
  const server = createServer(app);

  // 初始化 WebSocket 服务器，传入 db 用于终端 WebSocket 权限检查
  createWebSocketServer(server, db);

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`WebSocket server ready on ws://localhost:${port}`);
  });
}

// 启动入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const db = getDb();
  initSchema(db);

  // 设置加密密钥
  const encryptionKey = process.env.CLAUDE_CONFIG_ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }
  setEncryptionKey(encryptionKey);

  // 初始化 AI 客户端
  initAIClient();

  startServer(db, process.env.PORT ? parseInt(process.env.PORT) : 4000);
}