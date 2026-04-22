import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, sql } from 'drizzle-orm';
import { userClaudeConfigs } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../db/connection.js';
import type { SelectUserClaudeConfig } from '../../db/schema/index.js';

@singleton()
export class ClaudeConfigRepository extends BaseRepository {
  constructor(@inject(DatabaseConnection) db: DatabaseConnection) {
    super(db);
  }

  async findByUserId(userId: number): Promise<SelectUserClaudeConfig | undefined> {
    return this.db.select()
      .from(userClaudeConfigs)
      .where(eq(userClaudeConfigs.userId, userId))
      .get();
  }

  async upsert(userId: number, config: string): Promise<SelectUserClaudeConfig> {
    return this.db.insert(userClaudeConfigs)
      .values({ userId, config })
      .onConflictDoUpdate({
        target: userClaudeConfigs.userId,
        set: { config, updatedAt: sql`datetime('now')` },
      })
      .returning()
      .get();
  }

  async delete(userId: number): Promise<void> {
    this.db.delete(userClaudeConfigs)
      .where(eq(userClaudeConfigs.userId, userId))
      .run();
  }

  async hasConfig(userId: number): Promise<boolean> {
    const result = await this.db.select({ exists: sql`1` })
      .from(userClaudeConfigs)
      .where(eq(userClaudeConfigs.userId, userId))
      .limit(1)
      .get();
    return result !== undefined;
  }
}
