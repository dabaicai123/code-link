import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index.js';
import { singleton } from 'tsyringe';
import { getConfig } from '../core/config.js';

@singleton()
export class DatabaseConnection {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;

  constructor() {
    const config = getConfig();
    this.sqlite = new Database(config.dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzle(this.sqlite, { schema });
  }

  static fromSqlite(sqlite: Database.Database): DatabaseConnection {
    const conn = Object.create(DatabaseConnection.prototype) as DatabaseConnection;
    conn.sqlite = sqlite;
    conn.db = drizzle(sqlite, { schema });
    return conn;
  }

  getDb(): ReturnType<typeof drizzle> {
    return this.db;
  }

  getSqlite(): Database.Database {
    return this.sqlite;
  }

  transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn)() as T;
  }

  close(): void {
    this.sqlite.close();
  }
}

export { sql } from 'drizzle-orm';
