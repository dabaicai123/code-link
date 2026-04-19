import 'reflect-metadata';
import { container } from 'tsyringe';
import { GitProviderRepository } from './repository.js';
import { GitProviderService } from './service.js';
import { GitProviderController } from './controller.js';

export function registerGitProviderModule(): void {
  container.registerSingleton(GitProviderRepository);
  container.registerSingleton(GitProviderService);
  container.registerSingleton(GitProviderController);
}

export { GitProviderRepository } from './repository.js';
export { GitProviderService } from './service.js';
export { GitProviderController } from './controller.js';
export { createGitProviderRoutes } from './routes.js';
export { GitHubClient } from './github-client.js';
export { GitLabClient } from './gitlab-client.js';
export {
  getOAuthConfig,
  getGitHubOAuthUrl,
  getGitLabOAuthUrl,
  exchangeGitHubCode,
  exchangeGitLabCode,
} from './oauth.js';
export {
  oauthCallbackSchema,
  repoQuerySchema,
  webhookCreateSchema,
} from './schemas.js';
export type {
  GitProvider,
  OAuthConfig,
  TokenResponse,
  ProviderStatus,
  GitHubRepo,
  GitLabProject,
} from './types.js';
