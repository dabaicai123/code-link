import 'dotenv/config';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { initSchema } from './db/index.js';
import {
  runOrganizationMigration,
  runRepoClonedMigration,
  runProjectOrganizationMigration,
} from './db/migration.js';
import { createLogger } from './core/logger/index.js';
import { DatabaseConnection } from './db/connection.js';
import { getConfig, resetConfig } from './core/config.js';

const logger = createLogger('migrate');

// 初始化配置
resetConfig();
const config = getConfig();

// 创建数据库连接并注册到 DI 容器
const dbConnection = new DatabaseConnection();
container.registerInstance(DatabaseConnection, dbConnection);

// 获取原生 SQLite 实例用于迁移
const db = dbConnection.getSqlite();

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
