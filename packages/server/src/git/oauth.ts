// src/git/oauth.ts
export interface OAuthConfig {
  githubClientId: string;
  githubClientSecret: string;
  gitlabClientId: string;
  gitlabClientSecret: string;
  gitlabBaseUrl: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export function getGitHubOAuthUrl(config: OAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: `${config.redirectUri}/github`,
    scope: 'repo',
    state: Math.random().toString(36).substring(7),
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export function getGitLabOAuthUrl(config: OAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.gitlabClientId,
    redirect_uri: `${config.redirectUri}/gitlab`,
    response_type: 'code',
    scope: 'api',
    state: Math.random().toString(36).substring(7),
  });

  return `${config.gitlabBaseUrl}/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode(
  config: OAuthConfig,
  code: string
): Promise<TokenResponse> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: `${config.redirectUri}/github`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange GitHub code');
  }

  return response.json();
}

export async function exchangeGitLabCode(
  config: OAuthConfig,
  code: string
): Promise<TokenResponse> {
  const response = await fetch(`${config.gitlabBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.gitlabClientId,
      client_secret: config.gitlabClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${config.redirectUri}/gitlab`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange GitLab code');
  }

  return response.json();
}

// 从环境变量获取配置
export function getOAuthConfig(): OAuthConfig {
  return {
    githubClientId: process.env.GITHUB_CLIENT_ID || '',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    gitlabClientId: process.env.GITLAB_CLIENT_ID || '',
    gitlabClientSecret: process.env.GITLAB_CLIENT_SECRET || '',
    gitlabBaseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3001/oauth/callback',
  };
}