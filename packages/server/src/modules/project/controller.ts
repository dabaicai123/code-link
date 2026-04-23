import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { ProjectService } from './service.js';
import { success } from '../../core/errors/index.js';
import { projectPaginationSchema } from '../../core/database/pagination.js';
import { parseIdParam } from '../../utils/params.js';

@singleton()
export class ProjectController {
  constructor(
    @inject(ProjectService) private readonly service: ProjectService
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const result = await this.service.create(req.userId!, req.body);
    res.status(201).json(success(result));
  }

  async list(req: Request, res: Response): Promise<void> {
    const { organizationId, page, limit } = projectPaginationSchema.parse(req.query);
    const result = await this.service.findByUserId(req.userId!, organizationId, page, limit);
    res.json(success(result));
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id: projectId } = req.validatedParams!;
    const result = await this.service.findById(req.userId!, projectId);
    res.json(success(result));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id: projectId } = req.validatedParams!;
    await this.service.delete(req.userId!, projectId);
    res.status(204).send();
  }

  async listRepos(req: Request, res: Response): Promise<void> {
    const { id: projectId } = req.validatedParams!;
    const repos = await this.service.findRepos(projectId, req.userId!);
    res.json(success(repos));
  }

  async addRepo(req: Request, res: Response): Promise<void> {
    const { id: projectId } = req.validatedParams!;
    const repo = await this.service.addRepo(projectId, req.userId!, req.body);
    res.status(201).json(success(repo));
  }

  async deleteRepo(req: Request, res: Response): Promise<void> {
    const { id: projectId, repoId } = req.validatedParams!;
    await this.service.deleteRepo(projectId, req.userId!, repoId);
    res.status(204).send();
  }
}