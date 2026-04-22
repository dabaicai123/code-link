import { singleton, inject } from 'tsyringe';
import type { Request, Response } from 'express';
import { CodeService } from './service.js';
import { success } from '../../core/errors/index.js';

@singleton()
export class CodeController {
  constructor(@inject(CodeService) private readonly service: CodeService) {}

  async getFileTree(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getFileTree(req.userId!, projectId, repoName);
    res.json(success(result));
  }

  async getFileContent(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const path = req.query.path as string;
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getFileContent(req.userId!, projectId, path, repoName);
    res.json(success(result));
  }

  async getGitStatus(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.getGitStatus(req.userId!, projectId);
    res.json(success(result));
  }

  async getGitLog(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getGitLog(req.userId!, projectId, repoName);
    res.json(success(result));
  }

  async getBranches(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getBranches(req.userId!, projectId, repoName);
    res.json(success(result));
  }

  async getCommitDiff(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const hash = req.query.hash as string;
    const repoName = req.query.repoName as string | undefined;
    const result = await this.service.getCommitDiff(req.userId!, projectId, hash, repoName);
    res.json(success({ diff: result }));
  }

  async commit(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.commit(req.userId!, projectId, req.body.message, req.body.repoName);
    res.json(success(result));
  }

  async push(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.push(req.userId!, projectId, req.body.repoName);
    res.json(success(result));
  }

  async pull(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.pull(req.userId!, projectId, req.body.repoName);
    res.json(success(result));
  }

  async stage(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.stage(req.userId!, projectId, req.body.repoName, req.body.paths);
    res.json(success(result));
  }

  async discard(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    const result = await this.service.discard(req.userId!, projectId, req.body.repoName, req.body.paths);
    res.json(success(result));
  }
}