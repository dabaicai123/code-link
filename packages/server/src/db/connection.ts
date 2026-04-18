import Database from 'better-sqlite3';
import path from 'path';

let defaultDb: Database.Database | null = null;

const DATA_DIR = path.resolve(process.cwd(), 'data');

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