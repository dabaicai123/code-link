// src/modules/gitprovider/controller.ts
import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { GitProviderService } from './service.js';
import { success } from '../../core/errors/index.js';
import type { OAuthCallbackInput, WebhookCreateInput } from './schemas.js';

@singleton()
export class GitProviderController {
  constructor(
    @inject(GitProviderService) private readonly service: GitProviderService
  ) {}

  // GitHub OAuth
  async getGitHubOAuthUrl(req: Request, res: Response): Promise<void> {
    const url = this.service.getOAuthUrl('github');
    res.json(success({ url }));
  }

  async handleGitHubCallback(req: Request, res: Response): Promise<void> {
    const { code, userId } = req.body as OAuthCallbackInput;
    await this.service.handleOAuthCallback('github', code, userId);
    res.json(success({ success: true }));
  }

  async getGitHubRepos(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const repos = await this.service.getGitHubRepos(userId);
    res.json(success(repos));
  }

  async getGitHubRepo(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const { owner, repo } = req.params;
    const repoInfo = await this.service.getGitHubRepo(userId, owner, repo);
    res.json(success(repoInfo));
  }

  async getGitHubBranches(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const { owner, repo } = req.params;
    const branches = await this.service.getGitHubBranches(userId, owner, repo);
    res.json(success(branches));
  }

  async createGitHubWebhook(req: Request, res: Response): Promise<void> {
    const { userId, owner, repo, webhookUrl } = req.body as WebhookCreateInput;
    const webhook = await this.service.createGitHubWebhook(userId, owner, repo, webhookUrl);
    res.status(201).json(success(webhook));
  }

  async revokeGitHubToken(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    await this.service.revokeAuthorization(userId, 'github');
    res.status(204).send();
  }

  async getGitHubStatus(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const hasToken = await this.service.getAuthorizationStatus(userId);
    res.json(success({ authorized: hasToken.github.authorized }));
  }

  // GitLab OAuth
  async getGitLabOAuthUrl(req: Request, res: Response): Promise<void> {
    const url = this.service.getOAuthUrl('gitlab');
    res.json(success({ url }));
  }

  async handleGitLabCallback(req: Request, res: Response): Promise<void> {
    const { code, userId } = req.body as OAuthCallbackInput;
    await this.service.handleOAuthCallback('gitlab', code, userId);
    res.json(success({ success: true }));
  }

  async getGitLabProjects(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const projects = await this.service.getGitLabProjects(userId);
    res.json(success(projects));
  }

  async getGitLabProject(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const projectId = parseInt(req.params.id, 10);
    const project = await this.service.getGitLabProject(userId, projectId);
    res.json(success(project));
  }

  async getGitLabBranches(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const projectId = parseInt(req.params.id, 10);
    const branches = await this.service.getGitLabBranches(userId, projectId);
    res.json(success(branches));
  }

  async revokeGitLabToken(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    await this.service.revokeAuthorization(userId, 'gitlab');
    res.status(204).send();
  }

  async getGitLabStatus(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const hasToken = await this.service.getAuthorizationStatus(userId);
    res.json(success({ authorized: hasToken.gitlab.authorized }));
  }

  // Combined status
  async getAuthorizationStatus(req: Request, res: Response): Promise<void> {
    const userId = parseInt(req.query.userId as string, 10);
    const status = await this.service.getAuthorizationStatus(userId);
    res.json(success(status));
  }
}
