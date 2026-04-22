import { singleton, inject } from 'tsyringe';
import type { Request, Response } from 'express';
import { CodeService } from './service.js';
import { success } from '../../core/errors/index.js';

@singleton()
export class CodeController {
  constructor(@inject(CodeService) private readonly service: CodeService) {}

  async startCodeServer(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.startCodeServer(req.userId!, projectId);
    res.json(success(result));
  }

  async stopCodeServer(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.stopCodeServer(req.userId!, projectId);
    res.json(success(result));
  }

  async getCodeServerStatus(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.getCodeServerStatus(req.userId!, projectId);
    res.json(success(result));
  }
}