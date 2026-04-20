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
    const existing = await this.findByUserId(userId);

    if (existing) {
      return this.db.update(userClaudeConfigs)
        .set({ config, updatedAt: sql`datetime('now')` })
        .where(eq(userClaudeConfigs.userId, userId))
        .returning()
        .get();
    }

    return this.db.insert(userClaudeConfigs)
      .values({ userId, config })
      .returning()
      .get();
  }

  async delete(userId: number): Promise<void> {
    this.db.delete(userClaudeConfigs)
      .where(eq(userClaudeConfigs.userId, userId))
      .run();
  }

  async hasConfig(userId: number): Promise<boolean> {
    const config = await this.findByUserId(userId);
    return config !== undefined;
  }
}
