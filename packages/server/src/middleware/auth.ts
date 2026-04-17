import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = 'code-link-dev-secret';

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET in production!');
}

export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  const token = header.slice(7);
  if (!token) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload !== 'object' || payload === null || typeof payload.userId !== 'number') {
      res.status(401).json({ error: '无效的认证令牌' });
      return;
    }
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: '无效的认证令牌' });
  }
}