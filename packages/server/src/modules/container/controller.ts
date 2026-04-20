import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { ContainerService } from './service.js';
import { success } from '../../core/errors/index.js';

@singleton()
export class ContainerController {
  constructor(
    @inject(ContainerService) private readonly service: ContainerService
  ) {}

  async start(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.id as string, 10);
    const result = await this.service.start(req.userId!, projectId);
    res.json(success(result));
  }

  async stop(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.id as string, 10);
    const result = await this.service.stop(req.userId!, projectId);
    res.json(success(result));
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.id as string, 10);
    const result = await this.service.getStatus(req.userId!, projectId);
    res.json(success(result));
  }

  async remove(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.id as string, 10);
    await this.service.remove(req.userId!, projectId);
    res.status(204).send();
  }
}
