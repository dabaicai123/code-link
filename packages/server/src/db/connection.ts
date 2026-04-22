import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index.js';
import { singleton } from 'tsyringe';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('db-connection');

@singleton()
export class DatabaseConnection {
  private db: ReturnType<typeof drizzle> | null = null;
  private sqlite: Database.Database | null = null;

  /**
   * @singleton() constructor — does NOT create a connection automatically.
   * Connection must be injected via registerInstance(fromSqlite()) or
   * lazily initialized by calling init() with a path.
   */
  constructor() {
    // Intentionally empty — connection must be externally provided
  }

  /**
   * Lazy-initialize a file-based SQLite connection.
   * Only used when no instance was registered via registerInstance.
   */
  init(dbPath: string): void {
    if (this.sqlite) {
      logger.warn('DatabaseConnection already initialized, skipping');
      return;
    }
    this.sqlite = new Database(dbPath);
    if (dbPath !== ':memory:') {
      this.sqlite.pragma('journal_mode = WAL');
    }
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
    if (!this.db) {
      throw new Error('DatabaseConnection not initialized. Call init() or use registerInstance(fromSqlite())');
    }
    return this.db;
  }

  getSqlite(): Database.Database {
    if (!this.sqlite) {
      throw new Error('DatabaseConnection not initialized. Call init() or use registerInstance(fromSqlite())');
    }
    return this.sqlite;
  }

  transaction<T>(fn: () => T): T {
    return this.getSqlite().transaction(fn)() as T;
  }

  close(): void {
    if (this.sqlite) {
      this.sqlite.close();
    }
  }
}

export { sql } from 'drizzle-orm';