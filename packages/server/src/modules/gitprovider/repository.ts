// src/modules/gitprovider/repository.ts
import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
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
    const existing = await this.findByUserAndProvider(data.userId as number, data.provider as GitProvider);

    if (existing) {
      return this.db.update(projectTokens)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        })
        .where(and(
          eq(projectTokens.userId, data.userId as number),
          eq(projectTokens.provider, data.provider as GitProvider)
        ))
        .returning()
        .get();
    }

    return this.db.insert(projectTokens)
      .values(data)
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
    const token = await this.findByUserAndProvider(userId, provider);
    return token !== undefined;
  }

  isTokenExpired(token: SelectProjectToken): boolean {
    if (!token.expiresAt) return false;

    const expiresAt = new Date(token.expiresAt);
    const now = new Date();

    // 提前 5 分钟视为过期
    return now.getTime() >= expiresAt.getTime() - 5 * 60 * 1000;
  }
}