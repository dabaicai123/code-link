import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../../middleware/validation.js';
import { registerSchema, loginSchema } from './schemas.js';
import { AuthController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';
import { authMiddleware } from '../../middleware/auth.js';

// Rate limiters for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per IP
  message: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  message: { code: 'RATE_LIMIT', message: '登录尝试过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

export function createAuthRoutes(controller: AuthController): Router {
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
