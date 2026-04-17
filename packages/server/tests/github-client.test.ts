// tests/github-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubClient } from '../src/git/github-client.ts';

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient('test_token');
    vi.restoreAllMocks();
  });

  it('should create client with access token', () => {
    expect(client).toBeDefined();
  });

  it('should get user repositories', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'test-repo', full_name: 'user/test-repo', html_url: 'https://github.com/user/test-repo' }
      ]),
    });

    const repos = await client.getUserRepos();
    expect(repos.length).toBeGreaterThan(0);
    expect(repos[0].name).toBe('test-repo');
  });

  it('should get repository info', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        default_branch: 'main',
      }),
    });

    const repo = await client.getRepo('user', 'test-repo');
    expect(repo.name).toBe('test-repo');
    expect(repo.default_branch).toBe('main');
  });

  it('should throw error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    try {
      await client.getRepo('user', 'nonexistent');
      expect.fail('Should throw error');
    } catch (error: any) {
      expect(error.message).toContain('404');
    }
  });

  it('should get repository branches', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { name: 'main' },
        { name: 'develop' },
      ]),
    });

    const branches = await client.getRepoBranches('user', 'test-repo');
    expect(branches.length).toBe(2);
    expect(branches[0].name).toBe('main');
    expect(branches[1].name).toBe('develop');
  });

  it('should create webhook', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        url: 'https://example.com/webhook',
      }),
    });

    await client.createWebhook('user', 'test-repo', 'https://example.com/webhook');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/user/test-repo/hooks',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('https://example.com/webhook'),
      })
    );
  });
});
