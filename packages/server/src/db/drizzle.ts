import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

let defaultSqliteDb: Database.Database | null = null;
let defaultDb: ReturnType<typeof drizzle> | null = null;

/**
 * 获取 SQLite 数据库连接
 * 当提供 dbPath 时，会重置单例并创建新的数据库连接
 */
export function getSqliteDb(dbPath?: string): Database.Database {
  if (dbPath) {
    // 如果有新路径，关闭旧连接并重置单例
    if (defaultSqliteDb) {
      defaultSqliteDb.close();
      defaultSqliteDb = null;
      defaultDb = null;
    }
    defaultSqliteDb = new Database(dbPath);
    defaultSqliteDb.pragma('journal_mode = WAL');
    defaultSqliteDb.pragma('foreign_keys = ON');
    return defaultSqliteDb;
  }
  if (!defaultSqliteDb) {
    const dbPath = process.env.DB_PATH || path.join(DATA_DIR, 'code-link.db');
    defaultSqliteDb = new Database(dbPath);
    defaultSqliteDb.pragma('journal_mode = WAL');
    defaultSqliteDb.pragma('foreign_keys = ON');
  }
  return defaultSqliteDb;
}

/**
 * 获取 Drizzle 数据库实例
 * 当提供 dbPath 时，会重置单例并创建新的 Drizzle 实例
 */
export function getDb(dbPath?: string): ReturnType<typeof drizzle> {
  if (dbPath) {
    // 重置现有单例
    if (defaultSqliteDb) {
      defaultSqliteDb.close();
      defaultSqliteDb = null;
      defaultDb = null;
    }
    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    defaultSqliteDb = sqliteDb;
    defaultDb = drizzle(sqliteDb, { schema });
    return defaultDb;
  }
  if (!defaultDb) {
    const sqliteDb = getSqliteDb();
    defaultDb = drizzle(sqliteDb, { schema });
  }
  return defaultDb;
}

/**
 * 关闭数据库连接
 */
export function closeDb(): void {
  if (defaultSqliteDb) {
    defaultSqliteDb.close();
    defaultSqliteDb = null;
    defaultDb = null;
  }
}

// 导出 SQLite 原生实例（用于需要原生 SQL 的场景，如迁移）
export { getSqliteDb as getNativeDb };