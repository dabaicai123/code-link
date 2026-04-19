// src/modules/gitprovider/routes.ts
import { Router } from 'express';
import { validateBody, validateQuery } from '../../middleware/validation.js';
import { oauthCallbackSchema, repoQuerySchema, webhookCreateSchema } from './schemas.js';
import { GitProviderController } from './controller.js';
import { asyncHandler } from '../../core/errors/index.js';

export function createGitProviderRoutes(controller: GitProviderController): { githubRouter: Router; gitlabRouter: Router } {
  // GitHub routes
  const githubRouter = Router();

  githubRouter.get('/oauth', asyncHandler((req, res) => controller.getGitHubOAuthUrl(req, res)));
  githubRouter.post('/oauth/callback', validateBody(oauthCallbackSchema), asyncHandler((req, res) => controller.handleGitHubCallback(req, res)));
  githubRouter.get('/repos', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitHubRepos(req, res)));
  githubRouter.get('/repos/:owner/:repo', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitHubRepo(req, res)));
  githubRouter.get('/repos/:owner/:repo/branches', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitHubBranches(req, res)));
  githubRouter.post('/webhooks', validateBody(webhookCreateSchema), asyncHandler((req, res) => controller.createGitHubWebhook(req, res)));
  githubRouter.delete('/token', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.revokeGitHubToken(req, res)));
  githubRouter.get('/status', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitHubStatus(req, res)));

  // GitLab routes
  const gitlabRouter = Router();

  gitlabRouter.get('/oauth', asyncHandler((req, res) => controller.getGitLabOAuthUrl(req, res)));
  gitlabRouter.post('/oauth/callback', validateBody(oauthCallbackSchema), asyncHandler((req, res) => controller.handleGitLabCallback(req, res)));
  gitlabRouter.get('/projects', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitLabProjects(req, res)));
  gitlabRouter.get('/projects/:id', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitLabProject(req, res)));
  gitlabRouter.get('/projects/:id/branches', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitLabBranches(req, res)));
  gitlabRouter.delete('/token', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.revokeGitLabToken(req, res)));
  gitlabRouter.get('/status', validateQuery(repoQuerySchema), asyncHandler((req, res) => controller.getGitLabStatus(req, res)));

  return { githubRouter, gitlabRouter };
}
