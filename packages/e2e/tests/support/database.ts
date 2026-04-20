// packages/e2e/tests/support/database.ts
import type Database from 'better-sqlite3';

const SNAPSHOT_TABLES = [
  'users',
  'organizations',
  'organization_members',
  'organization_invitations',
  'projects',
  'drafts',
  'draft_members',
  'draft_messages',
  'builds',
  'tokens',
  'claude_configs',
  'repos',
];

const CLEAN_ORDER = [
  'draft_messages',
  'draft_members',
  'drafts',
  'builds',
  'tokens',
  'claude_configs',
  'repos',
  'projects',
  'organization_invitations',
  'organization_members',
  'organizations',
  'users',
];

export class TestDatabase {
  private db: Database.Database;
  private snapshots: Map<string, string> = new Map();

  constructor(sqlite: Database.Database) {
    this.db = sqlite;
  }

  /**
   * Create a named snapshot of current database state
   */
  checkpoint(name: string = 'default'): void {
    const data: Record<string, unknown[]> = {};

    for (const table of SNAPSHOT_TABLES) {
      try {
        data[table] = this.db.prepare(`SELECT * FROM ${table}`).all() as unknown[];
      } catch {
        // Table might not exist in all schemas
        data[table] = [];
      }
    }

    this.snapshots.set(name, JSON.stringify(data));
  }

  /**
   * Rollback database to a named snapshot
   */
  rollback(name: string = 'default'): void {
    const dataJson = this.snapshots.get(name);
    if (!dataJson) {
      throw new Error(`Snapshot '${name}' not found`);
    }

    const data = JSON.parse(dataJson) as Record<string, unknown[]>;

    // Disable foreign keys for bulk operations
    this.db.exec('PRAGMA foreign_keys = OFF');

    try {
      for (const [table, rows] of Object.entries(data)) {
        // Clear table
        this.db.exec(`DELETE FROM ${table}`);

        // Restore rows
        if (rows.length > 0) {
          for (const row of rows as Record<string, unknown>[]) {
            const columns = Object.keys(row);
            const values = columns.map((c) => this.escapeValue(row[c]));
            this.db.exec(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`
            );
          }
        }
      }
    } finally {
      // Re-enable foreign keys
      this.db.exec('PRAGMA foreign_keys = ON');
    }
  }

  /**
   * Clear all tables (for clean state)
   */
  clean(): void {
    this.db.exec('PRAGMA foreign_keys = OFF');
    try {
      for (const table of CLEAN_ORDER) {
        try {
          this.db.exec(`DELETE FROM ${table}`);
        } catch {
          // Table might not exist
        }
      }
    } finally {
      this.db.exec('PRAGMA foreign_keys = ON');
    }
  }

  /**
   * Check if a snapshot exists
   */
  hasSnapshot(name: string): boolean {
    return this.snapshots.has(name);
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots.clear();
  }

  private escapeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    // Handle Date objects and other types
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
}
