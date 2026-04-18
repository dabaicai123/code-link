// packages/server/tests/claude-config.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setEncryptionKey } from '../src/crypto/aes.js';
import { getSqliteDb, closeDb } from '../src/db/index.js';
import { initSchema } from '../src/db/schema.js';
import { getDb } from '../src/db/index.js';
import { userClaudeConfigs } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { encrypt, decrypt } from '../src/crypto/aes.js';
import { createLogger } from '../src/logger/index.js';
import { success, Errors } from '../src/utils/response.js';
import {
  createTestUser,
  findClaudeConfigByUserId,
  deleteTestClaudeConfig,
} from './helpers/test-db.js';
import type Database from 'better-sqlite3';

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
function createTestClaudeConfigRouter(): Router {
  const router = Router();
  const db = getDb();

  // 获取用户配置
  router.get('/', (req, res) => {
    const userId = (req as any).userId;

    const row = findClaudeConfigByUserId(userId);

    if (!row) {
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
  router.post('/', (req, res) => {
    const userId = (req as any).userId;
    const { config } = req.body;

    if (!config) {
      res.status(400).json(Errors.paramMissing('config'));
      return;
    }

    if (!config.env || typeof config.env !== 'object') {
      res.status(400).json(Errors.paramInvalid('config.env', '必须是对象'));
      return;
    }

    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      res.status(400).json(Errors.paramMissing('ANTHROPIC_AUTH_TOKEN'));
      return;
    }

    try {
      const encryptedConfig = encrypt(JSON.stringify(config));

      // 使用 ORM 进行 upsert 操作
      const existing = findClaudeConfigByUserId(userId);
      if (existing) {
        db.update(userClaudeConfigs)
          .set({ config: encryptedConfig })
          .where(eq(userClaudeConfigs.userId, userId))
          .run();
      } else {
        db.insert(userClaudeConfigs)
          .values({ userId, config: encryptedConfig })
          .run();
      }

      res.json(success({ success: true }));
    } catch (error) {
      logger.error('Failed to save user config', error);
      res.status(500).json(Errors.internal('保存配置失败'));
    }
  });

  // 删除用户配置
  router.delete('/', (req, res) => {
    const userId = (req as any).userId;
    deleteTestClaudeConfig(userId);
    res.json(success({ success: true }));
  });

  return router;
}

describe('Claude Config API', () => {
  const testKey = 'test-encryption-key-32-bytes!!!!!';
  let app: express.Application;
  let db: Database.Database;

  beforeAll(() => {
    setEncryptionKey(testKey);
    closeDb();
    db = getSqliteDb(':memory:');
    initSchema(db);

    // 创建测试用户
    createTestUser({ name: 'test', email: 'test@test.com', passwordHash: 'hash' });

    app = express();
    app.use(express.json());

    // Mock auth middleware - 设置 userId
    app.use((req, res, next) => {
      (req as any).userId = 1;
      next();
    });

    app.use('/api/claude-config', createTestClaudeConfigRouter());
  });

  afterAll(() => {
    // 清理测试数据
    deleteTestClaudeConfig(1);
    closeDb();
  });

  it('should return default config when not configured', async () => {
    const res = await request(app).get('/api/claude-config');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.hasConfig).toBe(false);
    expect(res.body.data.config.env).toBeDefined();
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
    expect(saveRes.body.code).toBe(0);
    expect(saveRes.body.data.success).toBe(true);

    const getRes = await request(app).get('/api/claude-config');
    expect(getRes.status).toBe(200);
    expect(getRes.body.code).toBe(0);
    expect(getRes.body.data.hasConfig).toBe(true);
    expect(getRes.body.data.config.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test');
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
    expect(res.body.code).toBe(20001);
    expect(res.body.error).toContain('ANTHROPIC_AUTH_TOKEN');
  });

  it('should reject missing config', async () => {
    const res = await request(app)
      .post('/api/claude-config')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(20001);
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
    expect(res.body.code).toBe(20002);
    expect(res.body.error).toContain('对象');
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
    expect(deleteRes.body.code).toBe(0);
    expect(deleteRes.body.data.success).toBe(true);

    // 验证已删除
    const getRes = await request(app).get('/api/claude-config');
    expect(getRes.body.code).toBe(0);
    expect(getRes.body.data.hasConfig).toBe(false);
  });
});
