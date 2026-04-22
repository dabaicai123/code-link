import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

/**
 * 获取默认数据库路径
 */
export function getDefaultDbPath(): string {
  return process.env.DB_PATH || path.join(DATA_DIR, 'code-link.db');
}

/**
 * 创建 SQLite 数据库连接（用于 DI 容器外部场景）
 */
export function createSqliteDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || getDefaultDbPath();
  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const db = new Database(resolvedPath);
  if (resolvedPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * 创建 Drizzle 数据库实例（用于 DI 容器外部场景）
 */
export function createDrizzleDb(sqlite: Database.Database): ReturnType<typeof drizzle> {
  return drizzle(sqlite, { schema });
}
