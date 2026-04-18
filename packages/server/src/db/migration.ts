import type Database from 'better-sqlite3';
import { createLogger } from '../logger/index.js';

const logger = createLogger('migration');

/**
 * 检查表是否存在
 */
function tableExists(db: Database.Database, tableName: string): boolean {
  const result = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName);
  return !!result;
}

/**
 * 运行组织管理迁移
 * 创建新表（如果不存在）
 */
export function runOrganizationMigration(db: Database.Database): void {
  logger.info('Running organization migration...');

  // 检查 organizations 表是否已存在
  if (tableExists(db, 'organizations')) {
    logger.info('Organizations tables already exist, skipping migration');
    return;
  }

  // 创建 organizations 表
  db.exec(`
    CREATE TABLE organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  logger.info('Created organizations table');

  // 创建 organization_members 表
  db.exec(`
    CREATE TABLE organization_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
  `);
  logger.info('Created organization_members table');

  // 创建 organization_invitations 表
  db.exec(`
    CREATE TABLE organization_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'developer', 'member')),
      invited_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(organization_id, email)
    );

    CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
  `);
  logger.info('Created organization_invitations table');

  logger.info('Organization migration completed');
}

/**
 * 运行项目组织关联迁移
 * 为 projects 表添加 organization_id 字段
 */
export function runProjectOrganizationMigration(db: Database.Database): void {
  logger.info('Running project organization migration...');

  // 检查 organization_id 列是否已存在
  const columns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const hasOrgId = columns.some(col => col.name === 'organization_id');

  if (hasOrgId) {
    logger.info('projects.organization_id already exists, skipping migration');
    return;
  }

  // 添加 organization_id 列
  db.exec('ALTER TABLE projects ADD COLUMN organization_id INTEGER REFERENCES organizations(id)');
  logger.info('Added organization_id column to projects table');

  logger.info('Project organization migration completed');
}

/**
 * 运行仓库克隆状态迁移
 * 在 project_repos 表添加 cloned 字段
 */
export function runRepoClonedMigration(db: Database.Database): void {
  logger.info('Running repo cloned migration...');

  // 检查 cloned 列是否已存在
  const columns = db.prepare("PRAGMA table_info(project_repos)").all() as { name: string }[];
  const hasClonedColumn = columns.some(col => col.name === 'cloned');

  if (hasClonedColumn) {
    logger.info('cloned column already exists, skipping migration');
    return;
  }

  // 添加 cloned 列
  db.exec(`ALTER TABLE project_repos ADD COLUMN cloned INTEGER NOT NULL DEFAULT 0`);
  logger.info('Added cloned column to project_repos table');

  logger.info('Repo cloned migration completed');
}
