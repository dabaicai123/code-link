import "reflect-metadata";
import { container } from "tsyringe";
import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, Errors, handleRouteError } from '../utils/response.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('auth');

export function createAuthRouter(): Router {
  const router = Router();
  const authService = container.resolve(AuthService);

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(success(result));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '注册失败');
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json(Errors.paramMissing('邮箱或密码'));
      return;
    }
    try {
      const result = await authService.login(req.body);
      res.json(success(result));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '登录失败');
    }
  });

  router.get('/me', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const user = await authService.getUser(userId);
      if (!user) {
        res.status(404).json(Errors.notFound('用户'));
        return;
      }
      res.json(success(user));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '获取用户信息失败');
    }
  });

  return router;
}