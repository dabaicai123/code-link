import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { userClaudeConfigs } from '../db/schema/index.js';
import type { InsertUserClaudeConfig, SelectUserClaudeConfig } from '../db/schema/index.js';

export class ClaudeConfigRepository {
  /**
   * 根据用户 ID 查找配置
   */
  async findByUserId(userId: number): Promise<SelectUserClaudeConfig | undefined> {
    const db = getDb();
    return db.select().from(userClaudeConfigs).where(eq(userClaudeConfigs.userId, userId)).get();
  }

  /**
   * 创建或更新配置（UPSERT）
   */
  async upsert(userId: number, config: string): Promise<SelectUserClaudeConfig> {
    const db = getDb();
    const existing = await this.findByUserId(userId);

    if (existing) {
      return db.update(userClaudeConfigs)
        .set({ config, updatedAt: sql`datetime('now')` })
        .where(eq(userClaudeConfigs.userId, userId))
        .returning()
        .get();
    }

    return db.insert(userClaudeConfigs)
      .values({ userId, config })
      .returning()
      .get();
  }

  /**
   * 删除用户配置
   */
  async delete(userId: number): Promise<void> {
    const db = getDb();
    db.delete(userClaudeConfigs).where(eq(userClaudeConfigs.userId, userId)).run();
  }
}