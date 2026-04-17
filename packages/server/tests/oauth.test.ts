// tests/oauth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getGitHubOAuthUrl,
  getGitLabOAuthUrl,
  exchangeGitHubCode,
  exchangeGitLabCode,
} from '../src/git/oauth.ts';

describe('OAuth', () => {
  const config = {
    githubClientId: 'gh_client_id',
    githubClientSecret: 'gh_client_secret',
    gitlabClientId: 'gl_client_id',
    gitlabClientSecret: 'gl_client_secret',
    gitlabBaseUrl: 'https://gitlab.com',
    redirectUri: 'http://localhost:3001/oauth/callback',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate GitHub OAuth URL', () => {
    const url = getGitHubOAuthUrl(config);
    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=gh_client_id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('scope=repo');
  });

  it('should generate GitLab OAuth URL', () => {
    const url = getGitLabOAuthUrl(config);
    expect(url).toContain('https://gitlab.com/oauth/authorize');
    expect(url).toContain('client_id=gl_client_id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('scope=api');
  });

  it('should exchange GitHub code for token', async () => {
    // Mock fetch for token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'gh_access_token',
        refresh_token: 'gh_refresh_token',
        expires_in: 3600,
      }),
    });

    const result = await exchangeGitHubCode(config, 'test_code');
    expect(result.access_token).toBe('gh_access_token');
  });

  it('should exchange GitLab code for token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'gl_access_token',
        refresh_token: 'gl_refresh_token',
        expires_in: 3600,
      }),
    });

    const result = await exchangeGitLabCode(config, 'test_code');
    expect(result.access_token).toBe('gl_access_token');
  });

  it('should throw error when GitHub exchange fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });

    try {
      await exchangeGitHubCode(config, 'invalid_code');
      expect.fail('Should throw error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to exchange GitHub code');
    }
  });

  it('should throw error when GitLab exchange fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });

    try {
      await exchangeGitLabCode(config, 'invalid_code');
      expect.fail('Should throw error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to exchange GitLab code');
    }
  });

  it('should use custom GitLab base URL', () => {
    const customConfig = {
      ...config,
      gitlabBaseUrl: 'https://gitlab.example.com',
    };

    const url = getGitLabOAuthUrl(customConfig);
    expect(url).toContain('https://gitlab.example.com/oauth/authorize');
  });
});