import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { BuildService } from './service.js';
import { success } from '../../core/errors/index.js';
import type { CreateBuildInput } from './schemas.js';

@singleton()
export class BuildController {
  constructor(
    @inject(BuildService) private readonly service: BuildService
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateBuildInput;
    const result = await this.service.create(req.userId!, input);
    res.status(201).json(success(result));
  }

  async listByProject(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.projectId, 10);
    const builds = await this.service.findByProjectId(req.userId!, projectId);
    res.json(success(builds));
  }

  async get(req: Request, res: Response): Promise<void> {
    const buildId = parseInt(req.params.id, 10);
    const result = await this.service.findById(req.userId!, buildId);
    res.json(success(result));
  }

  async getPreview(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.projectId, 10);
    const preview = await this.service.getPreview(req.userId!, projectId);
    res.json(success(preview));
  }

  async stopPreview(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.projectId, 10);
    await this.service.stopPreview(req.userId!, projectId);
    res.status(204).send();
  }
}
