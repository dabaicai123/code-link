// packages/server/tests/logger-middleware.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requestLoggingMiddleware } from '../src/logger/middleware.ts';
import { setLogLevel } from '../src/logger/logger.ts';

describe('请求日志中间件', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setLogLevel('DEBUG');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应为每个请求生成 reqId 并设置响应头', async () => {
    const app = express();
    app.use(requestLoggingMiddleware);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toHaveLength(8);
  });

  it('应记录请求开始和结束', async () => {
    const app = express();
    app.use(requestLoggingMiddleware);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    await request(app).get('/test');

    const calls = consoleSpy.mock.calls.map(c => c[0]);
    expect(calls.some(c => c.includes('--> GET /test'))).toBe(true);
    expect(calls.some(c => c.includes('<-- 200'))).toBe(true);
  });

  it('不同请求应有不同 reqId', async () => {
    const app = express();
    app.use(requestLoggingMiddleware);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const res1 = await request(app).get('/test');
    const res2 = await request(app).get('/test');

    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });
});