import bcrypt from 'bcryptjs';
import { users } from './schema/index.js';
import { eq } from 'drizzle-orm';
import { createLogger } from '../core/logger/index.js';
import { getConfig } from '../core/config.js';
import { DatabaseConnection } from './connection.js';

const logger = createLogger('db-init');

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';

/**
 * 初始化默认超级管理员账号
 * ADMIN_PASSWORD 必须通过环境变量配置（生产环境强制要求）
 */
export async function initDefaultAdmin(dbConnection?: DatabaseConnection): Promise<void> {
  const config = getConfig();
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

  // Require password from config or environment - no default fallback
  const adminPassword = config.adminPassword || process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    logger.warn('No ADMIN_PASSWORD set. Skipping default admin creation.');
    return;
  }

  // 使用传入的 dbConnection 或从 DI 容器获取
  const { container } = await import('tsyringe');
  const conn = dbConnection || container.resolve(DatabaseConnection);
  const db = conn.getDb();

  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).get();

  if (!existingAdmin) {
    // Use async bcrypt.hash for better performance
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.insert(users).values({
      name: 'Admin',
      email: adminEmail,
      passwordHash,
    }).returning().get();
    logger.info(`Default admin created: ${adminEmail}`);
  }
}