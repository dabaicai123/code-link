import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { encrypt, decrypt, isEncryptionKeySet } from '../crypto/aes.js';
import { createLogger } from '../logger/index.js';
import { ClaudeConfigRepository } from '../repositories/index.js';
import { success, Errors } from '../utils/response.js';

const logger = createLogger('claude-config');

const DEFAULT_CONFIG = {
  env: {
    ANTHROPIC_BASE_URL: '',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  },
  skipDangerousModePermissionPrompt: true,
};

export function createClaudeConfigRouter(): Router {
  const router = Router();
  const claudeConfigRepo = new ClaudeConfigRepository();

  // 检查加密密钥是否设置
  if (!isEncryptionKeySet()) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }

  // 获取用户配置
  router.get('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;

    const row = await claudeConfigRepo.findByUserId(userId);

    if (!row) {
      // 返回默认模板
      res.json(success({ config: DEFAULT_CONFIG, hasConfig: false }));
      return;
    }

    try {
      const config = JSON.parse(decrypt(row.config));
      res.json(success({ config, hasConfig: true }));
    } catch (error) {
      logger.error('Failed to decrypt user config', error);
      res.status(500).json(Errors.internal('配置解密失败'));
    }
  });

  // 保存用户配置
  router.post('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const { config } = req.body;

    if (!config) {
      res.status(400).json(Errors.paramMissing('config'));
      return;
    }

    // 验证 JSON 结构
    if (!config.env || typeof config.env !== 'object') {
      res.status(400).json(Errors.paramInvalid('config.env', '必须是对象'));
      return;
    }

    // 检查必填字段
    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      res.status(400).json(Errors.paramMissing('ANTHROPIC_AUTH_TOKEN'));
      return;
    }

    try {
      const encryptedConfig = encrypt(JSON.stringify(config));
      await claudeConfigRepo.upsert(userId, encryptedConfig);
      res.json(success({ success: true }));
    } catch (error) {
      logger.error('Failed to save user config', error);
      res.status(500).json(Errors.internal('保存配置失败'));
    }
  });

  // 删除用户配置
  router.delete('/', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    await claudeConfigRepo.delete(userId);
    res.json(success({ success: true }));
  });

  return router;
}