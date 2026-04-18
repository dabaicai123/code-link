// packages/server/src/logger/middleware.ts

import type { Request, Response, NextFunction } from 'express';
import { runWithLogContext } from './context.js';
import { createLogger } from './logger.js';
import { generateShortId } from './id.js';

const logger = createLogger('http');

/**
 * Express 请求日志中间件
 * 为每个请求生成唯一 reqId，记录请求开始和结束
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const reqId = generateShortId();
  const startTime = Date.now();

  // 设置响应头，方便前端追踪
  res.setHeader('X-Request-Id', reqId);

  // 在上下文中运行后续处理
  runWithLogContext(reqId, () => {
    // 记录请求开始
    logger.debug(`--> ${req.method} ${req.path}`);

    // 记录响应完成
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.debug(`<-- ${res.statusCode} (${duration}ms)`);
    });

    next();
  });
}