// packages/server/tests/claude-config.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { setEncryptionKey } from '../src/crypto/aes.js';
import { initSchema } from '../src/db/schema.js';
import { Router } from 'express';
import { encrypt, decrypt, isEncryptionKeySet } from '../src/crypto/aes.js';
import { createLogger } from '../src/logger/index.js';

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

// 创建测试用的路由（不带 authMiddleware）
function createTestClaudeConfigRouter(db: Database.Database): Router {
  const router = Router();

  // 获取用户配置
  router.get('/', (req, res) => {
    const userId = (req as any).userId;

    const row = db
      .prepare('SELECT config FROM user_claude_configs WHERE user_id = ?')
      .get(userId) as { config: string } | undefined;

    if (!row) {
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
  router.post('/', (req, res) => {
    const userId = (req as any).userId;
    const { config } = req.body;

    if (!config) {
      res.status(400).json({ error: '缺少 config 字段' });
      return;
    }

    if (!config.env || typeof config.env !== 'object') {
      res.status(400).json({ error: 'config.env 必须是对象' });
      return;
    }

    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      res.status(400).json({ error: 'ANTHROPIC_AUTH_TOKEN 不能为空' });
      return;
    }

    try {
      const encryptedConfig = encrypt(JSON.stringify(config));
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
  router.delete('/', (req, res) => {
    const userId = (req as any).userId;
    db.prepare('DELETE FROM user_claude_configs WHERE user_id = ?').run(userId);
    res.json({ success: true });
  });

  return router;
}

describe('Claude Config API', () => {
  const testKey = 'test-encryption-key-32-bytes!!!!!';
  let app: express.Application;
  let db: Database.Database;

  beforeAll(() => {
    setEncryptionKey(testKey);
    db = new Database(':memory:');
    initSchema(db);

    // 创建测试用户
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('test', 'test@test.com', 'hash');

    app = express();
    app.use(express.json());

    // Mock auth middleware - 设置 userId
    app.use((req, res, next) => {
      (req as any).userId = 1;
      next();
    });

    app.use('/api/claude-config', createTestClaudeConfigRouter(db));
  });

  afterAll(() => {
    db.close();
  });

  it('should return default config when not configured', async () => {
    const res = await request(app).get('/api/claude-config');
    expect(res.status).toBe(200);
    expect(res.body.hasConfig).toBe(false);
    expect(res.body.config.env).toBeDefined();
  });

  it('should save and retrieve config', async () => {
    const config = {
      env: {
        ANTHROPIC_BASE_URL: 'https://test.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-test',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5',
      },
      skipDangerousModePermissionPrompt: true,
    };

    const saveRes = await request(app)
      .post('/api/claude-config')
      .send({ config });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);

    const getRes = await request(app).get('/api/claude-config');
    expect(getRes.status).toBe(200);
    expect(getRes.body.hasConfig).toBe(true);
    expect(getRes.body.config.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test');
  });

  it('should reject empty auth_token', async () => {
    const res = await request(app)
      .post('/api/claude-config')
      .send({
        config: {
          env: { ANTHROPIC_AUTH_TOKEN: '' },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('ANTHROPIC_AUTH_TOKEN');
  });

  it('should reject missing config', async () => {
    const res = await request(app)
      .post('/api/claude-config')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('config');
  });

  it('should reject invalid env structure', async () => {
    const res = await request(app)
      .post('/api/claude-config')
      .send({
        config: {
          env: 'not-an-object',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('env');
  });

  it('should delete config', async () => {
    // 先保存配置
    await request(app)
      .post('/api/claude-config')
      .send({
        config: {
          env: { ANTHROPIC_AUTH_TOKEN: 'sk-to-delete' },
        },
      });

    // 删除配置
    const deleteRes = await request(app).delete('/api/claude-config');
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 验证已删除
    const getRes = await request(app).get('/api/claude-config');
    expect(getRes.body.hasConfig).toBe(false);
  });
});
