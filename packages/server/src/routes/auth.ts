import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, Errors } from '../utils/response.js';

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(success(result));
    } catch (error: any) {
      if (error.message === '该邮箱已被注册') {
        res.status(409).json(Errors.alreadyExists('该邮箱'));
      } else {
        res.status(400).json(Errors.paramInvalid('', error.message));
      }
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
    } catch (error: any) {
      res.status(401).json(Errors.unauthorized());
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
    } catch (error: any) {
      res.status(500).json(Errors.internal(error.message));
    }
  });

  return router;
}