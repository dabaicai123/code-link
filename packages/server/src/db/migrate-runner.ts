import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('migration-runner');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(__dirname, 'migrations');

export function runMigrations(db: Database.Database): void {
  // Temporarily disable foreign keys during migration execution
  // (Drizzle Kit generates SQL with table creation order that may reference
  // tables not yet created, e.g. builds references projects before projects exists)
  const fkWasOn = db.pragma('foreign_keys', { simple: true }) as number;
  if (fkWasOn) {
    db.pragma('foreign_keys = OFF');
  }

  try {
    // Create migrations journal table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Read and execute migration files in order
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const hash = file; // Use filename as hash for simplicity

      // Check if already applied
      const applied = db.prepare('SELECT id FROM __drizzle_migrations WHERE hash = ?').get(hash);
      if (applied) {
        logger.info(`Migration ${file} already applied, skipping`);
        continue;
      }

      logger.info(`Applying migration: ${file}`);

      // Drizzle-kit generates SQL with `--> statement-breakpoint` delimiters
      // Split into individual statements and execute each one separately
      const statements = sql
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        db.exec(stmt);
      }

      db.prepare('INSERT INTO __drizzle_migrations (hash) VALUES (?)').run(hash);
      logger.info(`Migration ${file} applied successfully`);
    }
  } finally {
    // Re-enable foreign keys if they were on before
    if (fkWasOn) {
      db.pragma('foreign_keys = ON');
    }
  }
}