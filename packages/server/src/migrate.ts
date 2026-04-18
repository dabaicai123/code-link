import 'dotenv/config';
import { getSqliteDb, initSchema } from './db/index.js';
import {
  runOrganizationMigration,
  runRepoClonedMigration,
  runProjectOrganizationMigration,
} from './db/migration.js';
import { createLogger } from './logger/index.js';

const logger = createLogger('migrate');

const db = getSqliteDb();

// 初始化基础 schema
initSchema(db);

// 运行组织迁移
runOrganizationMigration(db);

// 运行项目组织关联迁移
runProjectOrganizationMigration(db);

// 运行仓库克隆状态迁移
runRepoClonedMigration(db);

logger.info('All migrations completed');

db.close();
