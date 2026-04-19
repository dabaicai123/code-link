import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { OrganizationService } from './service.js';
import { success } from '../../core/errors/index.js';

@singleton()
export class OrganizationController {
  constructor(
    @inject(OrganizationService) private readonly service: OrganizationService
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const result = await this.service.create(req.userId!, req.body);
    res.status(201).json(success(result));
  }

  async list(req: Request, res: Response): Promise<void> {
    const organizations = await this.service.findByUserId(req.userId!);
    res.json(success(organizations));
  }

  async get(req: Request, res: Response): Promise<void> {
    const orgId = parseInt(req.params.id, 10);
    const result = await this.service.findById(orgId, req.userId!);
    res.json(success(result));
  }

  async update(req: Request, res: Response): Promise<void> {
    const orgId = parseInt(req.params.id, 10);
    const result = await this.service.updateName(orgId, req.userId!, req.body);
    res.json(success(result));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const orgId = parseInt(req.params.id, 10);
    await this.service.delete(orgId, req.userId!);
    res.status(204).send();
  }
}
