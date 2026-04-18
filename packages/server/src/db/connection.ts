import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

let defaultDb: Database.Database | null = null;

// 获取项目根目录 (monorepo root)
// connection.ts 位于 packages/server/src/db/connection.ts
// 需要往上 4 层才能到达项目根目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

export function getDb(dbPath?: string): Database.Database {
  if (dbPath) {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return db;
  }
  if (!defaultDb) {
    const dbPath = process.env.DB_PATH || path.join(DATA_DIR, 'code-link.db');
    defaultDb = new Database(dbPath);
    defaultDb.pragma('journal_mode = WAL');
    defaultDb.pragma('foreign_keys = ON');
  }
  return defaultDb;
}

export function closeDb(db: Database.Database): void {
  db.close();
  if (db === defaultDb) {
    defaultDb = null;
  }
}