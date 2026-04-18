import { Router } from 'express';
import type Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth.js';
import { encrypt, decrypt, isEncryptionKeySet } from '../crypto/aes.js';
import { createLogger } from '../logger/index.js';

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

export function createClaudeConfigRouter(db: Database.Database): Router {
  const router = Router();

  // 检查加密密钥是否设置
  if (!isEncryptionKeySet()) {
    logger.warn('CLAUDE_CONFIG_ENCRYPTION_KEY not set. User config encryption disabled.');
  }

  // 获取用户配置
  router.get('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    const row = db
      .prepare('SELECT config FROM user_claude_configs WHERE user_id = ?')
      .get(userId) as { config: string } | undefined;

    if (!row) {
      // 返回默认模板
      res.json({ config: DEFAULT_CONFIG, hasConfig: false });
      return;
    }

    try {
      const config = JSON.parse(decrypt(row.config));
      res.json({ config, hasConfig: true });
    } catch (error) {
      logger.error('Failed to decrypt user config', error);
      res.status(500).json({ error: '配置解密失败' });
    }
  });

  // 保存用户配置
  router.post('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const { config } = req.body;

    if (!config) {
      res.status(400).json({ error: '缺少 config 字段' });
      return;
    }

    // 验证 JSON 结构
    if (!config.env || typeof config.env !== 'object') {
      res.status(400).json({ error: 'config.env 必须是对象' });
      return;
    }

    // 检查必填字段
    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      res.status(400).json({ error: 'ANTHROPIC_AUTH_TOKEN 不能为空' });
      return;
    }

    try {
      const encryptedConfig = encrypt(JSON.stringify(config));

      // 使用 UPSERT
      db.prepare(`
        INSERT INTO user_claude_configs (user_id, config, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          config = excluded.config,
          updated_at = datetime('now')
      `).run(userId, encryptedConfig);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to save user config', error);
      res.status(500).json({ error: '保存配置失败' });
    }
  });

  // 删除用户配置
  router.delete('/', authMiddleware, (req, res) => {
    const userId = (req as any).userId;

    db.prepare('DELETE FROM user_claude_configs WHERE user_id = ?').run(userId);
    res.json({ success: true });
  });

  return router;
}
