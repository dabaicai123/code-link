// Drizzle ORM 客户端
export { getDb, getSqliteDb, getNativeDb, closeDb } from './drizzle.js';

// Schema 定义
export * from './schema/index.js';

// 初始化
export { initSchema, initDefaultAdmin } from './init.js';

// 迁移函数（保持兼容）
export {
  runOrganizationMigration,
  runProjectOrganizationMigration,
  runRepoClonedMigration,
} from './migration.js';