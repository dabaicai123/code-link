import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, and, sql } from 'drizzle-orm';
import { projectTokens } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/database/base.repository.js';
import { DatabaseConnection } from '../../db/connection.js';
import type { InsertProjectToken, SelectProjectToken } from '../../db/schema/index.js';
import type { GitProvider } from './types.js';

@singleton()
export class GitProviderRepository extends BaseRepository {
  constructor(@inject(DatabaseConnection) db: DatabaseConnection) {
    super(db);
  }

  async findByUserAndProvider(userId: number, provider: GitProvider): Promise<SelectProjectToken | undefined> {
    return this.db.select()
      .from(projectTokens)
      .where(and(
        eq(projectTokens.userId, userId),
        eq(projectTokens.provider, provider)
      ))
      .get();
  }

  async upsert(data: InsertProjectToken): Promise<SelectProjectToken> {
    return this.db.insert(projectTokens)
      .values(data)
      .onConflictDoUpdate({
        target: [projectTokens.userId, projectTokens.provider],
        set: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        },
      })
      .returning()
      .get();
  }

  async delete(userId: number, provider: GitProvider): Promise<void> {
    this.db.delete(projectTokens)
      .where(and(
        eq(projectTokens.userId, userId),
        eq(projectTokens.provider, provider)
      ))
      .run();
  }

  async hasToken(userId: number, provider: GitProvider): Promise<boolean> {
    const result = await this.db.select({ exists: sql`1` })
      .from(projectTokens)
      .where(and(
        eq(projectTokens.userId, userId),
        eq(projectTokens.provider, provider)
      ))
      .limit(1)
      .get();
    return result !== undefined;
  }

  isTokenExpired(token: SelectProjectToken): boolean {
    if (!token.expiresAt) return false;

    const expiresAt = new Date(token.expiresAt);
    const now = new Date();

    return now.getTime() >= expiresAt.getTime() - 5 * 60 * 1000;
  }
}