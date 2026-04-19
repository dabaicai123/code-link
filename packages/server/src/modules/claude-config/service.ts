import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { ClaudeConfigRepository } from './repository.js';
import { encrypt, decrypt, isEncryptionKeySet } from '../../crypto/aes.js';
import { createLogger } from '../../logger/index.js';
import { ParamError } from '../../core/errors/index.js';
import type { ClaudeConfig, ClaudeConfigResponse } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

const logger = createLogger('claude-config-service');

@singleton()
export class ClaudeConfigService {
  constructor(
    @inject(ClaudeConfigRepository) private readonly repo: ClaudeConfigRepository
  ) {
    if (!isEncryptionKeySet()) {
      logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
    }
  }

  async getConfig(userId: number): Promise<ClaudeConfigResponse> {
    const row = await this.repo.findByUserId(userId);

    if (!row) {
      return { config: DEFAULT_CONFIG, hasConfig: false };
    }

    try {
      const config = JSON.parse(decrypt(row.config));
      return { config, hasConfig: true };
    } catch (error) {
      logger.error('Failed to decrypt user config', error);
      throw new Error('配置解密失败');
    }
  }

  async saveConfig(userId: number, config: ClaudeConfig): Promise<void> {
    // 验证必填字段
    if (!config.env?.ANTHROPIC_AUTH_TOKEN) {
      throw new ParamError('ANTHROPIC_AUTH_TOKEN 不能为空');
    }

    try {
      const encryptedConfig = encrypt(JSON.stringify(config));
      await this.repo.upsert(userId, encryptedConfig);
    } catch (error) {
      logger.error('Failed to save user config', error);
      throw new Error('保存配置失败');
    }
  }

  async deleteConfig(userId: number): Promise<void> {
    await this.repo.delete(userId);
  }

  async hasConfig(userId: number): Promise<boolean> {
    return this.repo.hasConfig(userId);
  }

  isEncryptionAvailable(): boolean {
    return isEncryptionKeySet();
  }
}
