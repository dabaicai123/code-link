import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../../middleware/validation.js';
import { registerSchema, loginSchema } from './schemas.js';
import { AuthController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

const noopMiddleware: RequestHandler = (_req, _res, next) => next();

function createLimiter(max: number, message: string): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    message: { code: 'RATE_LIMIT', message },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export interface RateLimiterOptions {
  authLimiter?: RequestHandler;
  loginLimiter?: RequestHandler;
}

export function createAuthRoutes(
  controller: AuthController,
  options?: RateLimiterOptions
): Router {
  const authLimiter = options?.authLimiter ?? (
    process.env.NODE_ENV === 'test' ? noopMiddleware : createLimiter(10, '请求过于频繁，请稍后再试')
  );
  const loginLimiter = options?.loginLimiter ?? (
    process.env.NODE_ENV === 'test' ? noopMiddleware : createLimiter(5, '登录尝试过于频繁，请稍后再试')
  );

  const router = Router();

  router.post(
    '/register',
    authLimiter,
    validateBody(registerSchema),
    asyncHandler((req, res) => controller.register(req, res))
  );

  router.post(
    '/login',
    loginLimiter,
    validateBody(loginSchema),
    asyncHandler((req, res) => controller.login(req, res))
  );

  router.get(
    '/me',
    authMiddleware,
    asyncHandler((req, res) => controller.me(req, res))
  );

  return router;
}
