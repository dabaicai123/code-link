import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === '该邮箱已被注册') {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: '邮箱和密码为必填项' });
      return;
    }
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  router.get('/me', authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    try {
      const user = await authService.getUser(userId);
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}