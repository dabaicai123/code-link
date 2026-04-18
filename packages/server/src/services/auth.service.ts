import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';
import { JWT_SECRET } from '../middleware/auth.js';
import type { SelectUser } from '../db/schema/index.js';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: Omit<SelectUser, 'passwordHash'>;
}

export class AuthService {
  private userRepo = new UserRepository();

  /**
   * 用户注册
   */
  async register(data: RegisterInput): Promise<AuthResult> {
    // 检查邮箱是否已存在
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error('该邮箱已被注册');
    }

    // 创建用户
    const passwordHash = bcrypt.hashSync(data.password, 10);
    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });

    // 生成 JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 用户登录
   */
  async login(data: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(data.email);

    if (!user || !bcrypt.compareSync(data.password, user.passwordHash)) {
      throw new Error('邮箱或密码错误');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 获取用户信息
   */
  async getUser(userId: number): Promise<Omit<SelectUser, 'passwordHash'> | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      return null;
    }
    return this.sanitizeUser(user);
  }

  /**
   * 移除敏感字段
   */
  private sanitizeUser(user: SelectUser): Omit<SelectUser, 'passwordHash'> {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}