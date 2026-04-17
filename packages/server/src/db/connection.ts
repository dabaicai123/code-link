import Database from 'better-sqlite3';

let defaultDb: Database.Database | null = null;

export function getDb(path?: string): Database.Database {
  if (path) {
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return db;
  }
  if (!defaultDb) {
    defaultDb = new Database(process.env.DB_PATH || 'code-link.db');
    defaultDb.pragma('journal_mode = WAL');
    defaultDb.pragma('foreign_keys = ON');
  }
  return defaultDb;
}