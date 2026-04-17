// tests/gitlab-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitLabClient } from '../src/git/gitlab-client.ts';

describe('GitLabClient', () => {
  let client: GitLabClient;

  beforeEach(() => {
    client = new GitLabClient('https://gitlab.com', 'test_token');
    vi.restoreAllMocks();
  });

  it('should create client with access token', () => {
    expect(client).toBeDefined();
  });

  it('should get user projects', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'test-project', path_with_namespace: 'user/test-project', web_url: 'https://gitlab.com/user/test-project' }
      ]),
    });

    const projects = await client.getUserProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0].name).toBe('test-project');
  });

  it('should get project info', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'test-project',
        path_with_namespace: 'user/test-project',
        web_url: 'https://gitlab.com/user/test-project',
        default_branch: 'main',
      }),
    });

    const project = await client.getProject(1);
    expect(project.name).toBe('test-project');
    expect(project.default_branch).toBe('main');
  });

  it('should throw error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    try {
      await client.getProject(999);
      expect.fail('Should throw error');
    } catch (error: any) {
      expect(error.message).toContain('404');
    }
  });

  it('should get project branches', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { name: 'main' },
        { name: 'develop' },
      ]),
    });

    const branches = await client.getProjectBranches(1);
    expect(branches.length).toBe(2);
    expect(branches[0].name).toBe('main');
    expect(branches[1].name).toBe('develop');
  });

  it('should get project by path', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'test-project',
        path_with_namespace: 'user/test-project',
        web_url: 'https://gitlab.com/user/test-project',
        default_branch: 'main',
      }),
    });

    const project = await client.getProjectByPath('user/test-project');
    expect(project.name).toBe('test-project');
    expect(project.path_with_namespace).toBe('user/test-project');
  });

  it('should use custom base URL', () => {
    const customClient = new GitLabClient('https://gitlab.example.com', 'test_token');
    expect(customClient).toBeDefined();
  });

  it('should strip trailing slash from base URL', async () => {
    const clientWithSlash = new GitLabClient('https://gitlab.com/', 'test_token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await clientWithSlash.getUserProjects();

    expect(fetch).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/projects?membership=true&per_page=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': 'test_token',
        }),
      })
    );
  });

  it('should send PRIVATE-TOKEN header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    await client.getProject(1);

    expect(fetch).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/projects/1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': 'test_token',
        }),
      })
    );
  });
});