import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { AuthService } from './service.js';
import { success, Errors } from '../../core/errors/index.js';

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
    const userId = req.userId!;
    const user = await this.service.getUser(userId);

    if (!user) {
      res.status(404).json(Errors.notFound('用户'));
      return;
    }

    res.json(success(user));
  }
}
