// Database Connection (DI)
export { DatabaseConnection, sql } from './connection.js';

// Database utilities (for scripts outside DI container)
export { createSqliteDb, createDrizzleDb, getDefaultDbPath } from './drizzle.js';

// Schema definitions
export * from './schema/index.js';

// Initialization
export { initSchema, initDefaultAdmin } from './init.js';

// Migration functions (kept for compatibility)
export {
  runOrganizationMigration,
  runProjectOrganizationMigration,
  runRepoClonedMigration,
} from './migration.js';
