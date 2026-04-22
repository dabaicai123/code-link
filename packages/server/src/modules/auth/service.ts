import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './repository.js';
import { ConflictError, AuthError } from '../../core/errors/index.js';
import { getConfig } from '../../core/config.js';
import type { SelectUser } from '../../db/schema/index.js';
import type { RegisterInput, LoginInput } from './schemas.js';
import type { AuthResult, UserWithoutPassword } from './types.js';

@singleton()
export class AuthService {
  constructor(
    @inject(AuthRepository) private readonly repo: AuthRepository
  ) {}

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.repo.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });

    const token = this.generateToken(user.id);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async login(data: LoginInput): Promise<AuthResult> {
    const user = await this.repo.findByEmail(data.email);

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new AuthError('邮箱或密码错误');
    }

    const token = this.generateToken(user.id);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async getUser(userId: number): Promise<UserWithoutPassword | null> {
    const user = await this.repo.findById(userId);
    if (!user) {
      return null;
    }
    return this.sanitizeUser(user);
  }

  private generateToken(userId: number): string {
    const config = getConfig();
    return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
  }

  private sanitizeUser(user: SelectUser): UserWithoutPassword {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
