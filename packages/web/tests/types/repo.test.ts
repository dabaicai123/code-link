import { describe, it, expect } from 'vitest';
import type { Repo, RepoProvider } from '@/types/repo';

describe('Repo types', () => {
  it('Repo type should have required fields for github', () => {
    const repo: Repo = {
      id: 1,
      provider: 'github',
      repoUrl: 'https://github.com/user/repo',
      repoName: 'user/repo',
      branch: 'main',
      cloned: false,
      createdAt: '2026-04-20T00:00:00Z',
    };
    expect(repo.provider).toBe('github');
    expect(repo.cloned).toBe(false);
  });

  it('Repo type should support gitlab provider', () => {
    const repo: Repo = {
      id: 2,
      provider: 'gitlab',
      repoUrl: 'https://gitlab.com/user/repo',
      repoName: 'user/repo',
      branch: 'develop',
      cloned: true,
      createdAt: '2026-04-20T00:00:00Z',
    };
    expect(repo.provider).toBe('gitlab');
    expect(repo.cloned).toBe(true);
  });

  it('RepoProvider should be valid values', () => {
    const providers: RepoProvider[] = ['github', 'gitlab'];
    expect(providers).toHaveLength(2);
  });
});
