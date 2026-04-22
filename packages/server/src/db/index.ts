// Database Connection (DI)
export { DatabaseConnection, sql } from './connection.js';

// Database utilities (for scripts outside DI container)
export { createSqliteDb, createDrizzleDb, getDefaultDbPath } from './drizzle.js';

// Schema definitions
export * from './schema/index.js';

// Default admin initialization
export { initDefaultAdmin } from './init.js';

// Migration runner (replaces initSchema + ad-hoc migrations)
export { runMigrations } from './migrate-runner.js';
