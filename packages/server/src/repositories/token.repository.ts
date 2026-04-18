import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projectTokens } from '../db/schema/index.js';
import type { InsertProjectToken, SelectProjectToken } from '../db/schema/index.js';

export class TokenRepository {
  /**
   * 查找用户的 token
   */
  async findByUserAndProvider(userId: number, provider: 'github' | 'gitlab'): Promise<SelectProjectToken | undefined> {
    const db = getDb();
    return db.select()
      .from(projectTokens)
      .where(and(
        eq(projectTokens.userId, userId),
        eq(projectTokens.provider, provider)
      ))
      .get();
  }

  /**
   * 创建或更新 token（UPSERT）
   */
  async upsert(data: InsertProjectToken): Promise<SelectProjectToken> {
    const db = getDb();
    const existing = await this.findByUserAndProvider(data.userId, data.provider);

    if (existing) {
      return db.update(projectTokens)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        })
        .where(and(
          eq(projectTokens.userId, data.userId),
          eq(projectTokens.provider, data.provider)
        ))
        .returning()
        .get();
    }

    return db.insert(projectTokens)
      .values(data)
      .returning()
      .get();
  }

  /**
   * 删除 token
   */
  async delete(userId: number, provider: 'github' | 'gitlab'): Promise<void> {
    const db = getDb();
    db.delete(projectTokens)
      .where(and(
        eq(projectTokens.userId, userId),
        eq(projectTokens.provider, provider)
      ))
      .run();
  }
}