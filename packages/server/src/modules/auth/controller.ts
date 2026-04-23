import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { AuthService } from './service.js';
import { success, NotFoundError } from '../../core/errors/index.js';

@singleton()
export class AuthController {
  constructor(
    @inject(AuthService) private readonly service: AuthService
  ) {}

  async register(req: Request, res: Response): Promise<void> {
    const result = await this.service.register(req.body);
    res.status(201).json(success(result));
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await this.service.login(req.body);
    res.json(success(result));
  }

  async me(req: Request, res: Response): Promise<void> {
    const user = await this.service.getUser(req.userId!);
    if (!user) throw new NotFoundError('用户');
    res.json(success(user));
  }
}