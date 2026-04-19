import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { ClaudeConfigService } from './service.js';
import { success } from '../../core/errors/index.js';
import type { ClaudeConfig } from './schemas.js';

@singleton()
export class ClaudeConfigController {
  constructor(
    @inject(ClaudeConfigService) private readonly service: ClaudeConfigService
  ) {}

  async get(req: Request, res: Response): Promise<void> {
    const result = await this.service.getConfig(req.userId!);
    res.json(success(result));
  }

  async save(req: Request, res: Response): Promise<void> {
    const { config } = req.body as { config: ClaudeConfig };
    await this.service.saveConfig(req.userId!, config);
    res.json(success({ success: true }));
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.service.deleteConfig(req.userId!);
    res.json(success({ success: true }));
  }
}
