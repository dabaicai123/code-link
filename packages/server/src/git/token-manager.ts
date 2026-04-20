import "reflect-metadata";
import { container } from "tsyringe";
import { GitProviderRepository } from '../modules/gitprovider/repository.js';
import type { SelectProjectToken } from '../db/schema/index.js';

export class TokenManager {
  private tokenRepo: GitProviderRepository;

  constructor() {
    this.tokenRepo = container.resolve(GitProviderRepository);
  }

  async saveToken(
    userId: number,
    provider: 'github' | 'gitlab',
    accessToken: string,
    refreshToken?: string,
    expiresAt?: string
  ): Promise<void> {
    await this.tokenRepo.upsert({
      userId,
      provider,
      accessToken,
      refreshToken,
      expiresAt,
    });
  }

  async getToken(userId: number, provider: 'github' | 'gitlab'): Promise<SelectProjectToken | null> {
    const result = await this.tokenRepo.findByUserAndProvider(userId, provider);
    return result ?? null;
  }

  async deleteToken(userId: number, provider: 'github' | 'gitlab'): Promise<void> {
    await this.tokenRepo.delete(userId, provider);
  }

  async hasToken(userId: number, provider: 'github' | 'gitlab'): Promise<boolean> {
    const token = await this.tokenRepo.findByUserAndProvider(userId, provider);
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