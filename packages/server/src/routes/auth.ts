import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type Database from 'better-sqlite3';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.ts';
import type { User } from '../types.ts';

export function createAuthRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: '缺少必填字段：name, email, password' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: '该邮箱已被注册' });
      return;
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, password_hash);

    const user = db.prepare('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as Omit<User, 'password_hash'>;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: '缺少必填字段：email, password' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  router.get('/me', authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const user = db
      .prepare('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?')
      .get(userId) as Omit<User, 'password_hash'> | undefined;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json(user);
  });

  return router;
}