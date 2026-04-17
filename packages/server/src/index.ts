import express from 'express';
import cors from 'cors';
import type Database from 'better-sqlite3';
import { getDb } from './db/connection.ts';
import { initSchema } from './db/schema.ts';
import { createAuthRouter } from './routes/auth.ts';
import { createProjectsRouter } from './routes/projects.ts';

export function createApp(db: Database.Database): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/projects', createProjectsRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const db = getDb();
  initSchema(db);
  const app = createApp(db);
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}