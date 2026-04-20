import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { ProjectService } from './service.js';
import { success } from '../../core/errors/index.js';

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
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId as string, 10) : undefined;
    const projects = await this.service.findByUserId(req.userId!, organizationId);
    res.json(success(projects));
  }

  async get(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.id, 10);
    const result = await this.service.findById(req.userId!, projectId);
    res.json(success(result));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const projectId = parseInt(req.params.id, 10);
    await this.service.delete(req.userId!, projectId);
    res.status(204).send();
  }

  async listRepos(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id);

    const repos = await this.service.findRepos(projectId, userId);
    res.json(success(repos));
  }

  async addRepo(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.id);
    const input = req.body; // AddRepoInput

    const repo = await this.service.addRepo(projectId, userId, input);
    res.status(201).json(success(repo));
  }

  async deleteRepo(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const projectId = Number(req.params.projectId);
    const repoId = Number(req.params.repoId);

    await this.service.deleteRepo(projectId, userId, repoId);
    res.status(204).send();
  }
}