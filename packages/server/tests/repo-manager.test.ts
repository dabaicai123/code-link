import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.js';
import { RepoManager } from '../src/git/repo-manager.js';
import { TokenManager } from '../src/git/token-manager.js';
import { getSqliteDb } from '../src/db/index.js';

// Mock execInContainer
vi.mock('../src/docker/container-manager.js', () => ({
  execInContainer: vi.fn(),
}));

import { execInContainer } from '../src/docker/container-manager.js';

describe('RepoManager', () => {
  let db: Database.Database;
  let manager: RepoManager;

  beforeEach(async () => {
    db = getSqliteDb(':memory:');
    initSchema(db);
    // 创建测试用户
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('test', 'test@test.com', 'hash');
    // 创建测试项目
    db.prepare('INSERT INTO projects (name, template_type, created_by) VALUES (?, ?, ?)').run('test-project', 'node', 1);
    manager = new RepoManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    closeDb(db);
  });

  describe('cloneRepo', () => {
    it('should clone repo with authentication', async () => {
      // 先保存 token
      const tokenManager = new TokenManager();
      await tokenManager.saveToken(1, 'github', 'gh_token_xxx');

      vi.mocked(execInContainer).mockResolvedValueOnce({
        stdout: 'Cloning into test-repo...',
        stderr: '',
        exitCode: 0,
      });

      const result = await manager.cloneRepo(
        'container-123',
        1,
        'https://github.com/user/test-repo.git',
        1
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('/workspace/project-1/test-repo');
      expect(execInContainer).toHaveBeenCalledWith(
        'container-123',
        ['bash', '-c', "mkdir -p /workspace/project-1 && cd /workspace/project-1 && git clone --depth 1 'https://gh_token_xxx@github.com/user/test-repo.git' 'test-repo'"]
      );
    });

    it('should return error when token not found', async () => {
      const result = await manager.cloneRepo(
        'container-123',
        1,
        'https://github.com/user/test-repo.git',
        1
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('未找到 github 的授权');
    });

    it('should return error when clone fails', async () => {
      const tokenManager = new TokenManager();
      await tokenManager.saveToken(1, 'github', 'gh_token_xxx');

      vi.mocked(execInContainer).mockResolvedValueOnce({
        stdout: '',
        stderr: 'fatal: repository not found',
        exitCode: 128,
      });

      const result = await manager.cloneRepo(
        'container-123',
        1,
        'https://github.com/user/nonexistent.git',
        1
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('fatal: repository not found');
    });

    it('should work with GitLab URLs', async () => {
      const tokenManager = new TokenManager();
      await tokenManager.saveToken(1, 'gitlab', 'gl_token_xxx');

      vi.mocked(execInContainer).mockResolvedValueOnce({
        stdout: 'Cloning into my-project...',
        stderr: '',
        exitCode: 0,
      });

      const result = await manager.cloneRepo(
        'container-123',
        1,
        'https://gitlab.com/user/my-project.git',
        1
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('/workspace/project-1/my-project');
    });

    it('should escape malicious characters in URL', async () => {
      const tokenManager = new TokenManager();
      await tokenManager.saveToken(1, 'github', 'gh_token_xxx');

      vi.mocked(execInContainer).mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await manager.cloneRepo(
        'container-123',
        1,
        'https://github.com/user/repo$(whoami).git',
        1
      );

      expect(result.success).toBe(true);
      const callArgs = vi.mocked(execInContainer).mock.calls[0][1];
      expect(callArgs[2]).toContain("'repo$(whoami)'"); // 特殊字符被转义
    });
  });

  describe('pushRepo', () => {
    it('should push repo with user identity', async () => {
      const tokenManager = new TokenManager();
      await tokenManager.saveToken(1, 'github', 'gh_token_yyy');

      vi.mocked(execInContainer).mockResolvedValueOnce({
        stdout: 'Changes pushed',
        stderr: '',
        exitCode: 0,
      });

      const result = await manager.pushRepo(
        'container-123',
        1,
        'https://github.com/user/test-repo.git',
        'main',
        'Update files',
        1,
        'Test User',
        'test@test.com'
      );

      expect(result.success).toBe(true);
      const expectedCommand = [
        'cd /workspace/project-1/\'test-repo\'',
        'git config user.name \'Test User\'',
        'git config user.email \'test@test.com\'',
        'git add -A',
        'git commit -m \'Update files\'',
        'git push \'https://gh_token_yyy@github.com/user/test-repo.git\' HEAD:\'main\'',
      ].join('\n');
      expect(execInContainer).toHaveBeenCalledWith(
        'container-123',
        ['bash', '-c', expectedCommand]
      );
    });

    it('should return error when token not found', async () => {
      const result = await manager.pushRepo(
        'container-123',
        1,
        'https://github.com/user/test-repo.git',
        'main',
        'Update files',
        1,
        'Test User',
        'test@test.com'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('未找到 github 的授权');
    });

    it('should return error when push fails', async () => {
      const tokenManager = new TokenManager();
      await tokenManager.saveToken(1, 'github', 'gh_token_yyy');

      vi.mocked(execInContainer).mockResolvedValueOnce({
        stdout: '',
        stderr: 'fatal: Authentication failed',
        exitCode: 128,
      });

      const result = await manager.pushRepo(
        'container-123',
        1,
        'https://github.com/user/test-repo.git',
        'main',
        'Update files',
        1,
        'Test User',
        'test@test.com'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('fatal: Authentication failed');
    });

    it('should escape malicious commit message', async () => {
      const tokenManager = new TokenManager();
      await tokenManager.saveToken(1, 'github', 'gh_token_yyy');

      vi.mocked(execInContainer).mockResolvedValueOnce({
        stdout: 'Changes pushed',
        stderr: '',
        exitCode: 0,
      });

      const result = await manager.pushRepo(
        'container-123',
        1,
        'https://github.com/user/test-repo.git',
        'main',
        'Update; rm -rf /',
        1,
        'Test User',
        'test@test.com'
      );

      expect(result.success).toBe(true);
      const callArgs = vi.mocked(execInContainer).mock.calls[0][1];
      expect(callArgs[2]).toContain("'Update; rm -rf /'"); // 特殊字符被转义
    });
  });

  describe('addRepoAssociation', () => {
    it('should add repo association to project', async () => {
      await manager.addRepoAssociation(1, 'github', 'https://github.com/user/test-repo.git', 'test-repo', 'main');

      const repos = await manager.getProjectRepos(1);
      expect(repos).toHaveLength(1);
      expect(repos[0].repoUrl).toBe('https://github.com/user/test-repo.git');
      expect(repos[0].repoName).toBe('test-repo');
      expect(repos[0].provider).toBe('github');
      expect(repos[0].branch).toBe('main');
    });
  });

  describe('getProjectRepos', () => {
    it('should return empty array when no repos', async () => {
      const repos = await manager.getProjectRepos(1);
      expect(repos).toEqual([]);
    });

    it('should return all repos for a project', async () => {
      await manager.addRepoAssociation(1, 'github', 'https://github.com/user/repo1.git', 'repo1', 'main');
      await manager.addRepoAssociation(1, 'gitlab', 'https://gitlab.com/user/repo2.git', 'repo2', 'develop');

      const repos = await manager.getProjectRepos(1);
      expect(repos).toHaveLength(2);
      expect(repos.map(r => r.provider)).toContain('github');
      expect(repos.map(r => r.provider)).toContain('gitlab');
    });
  });

  describe('removeRepoAssociation', () => {
    it('should remove repo association', async () => {
      await manager.addRepoAssociation(1, 'github', 'https://github.com/user/test-repo.git', 'test-repo', 'main');

      await manager.removeRepoAssociation(1, 'https://github.com/user/test-repo.git');

      const repos = await manager.getProjectRepos(1);
      expect(repos).toHaveLength(0);
    });

    it('should not throw when removing non-existent association', async () => {
      await expect(manager.removeRepoAssociation(1, 'https://github.com/nonexistent.git')).resolves.not.toThrow();
    });
  });

  describe('detectProvider', () => {
    it('should detect GitHub', () => {
      expect(manager.detectProvider('https://github.com/user/repo.git')).toBe('github');
    });

    it('should detect GitLab', () => {
      expect(manager.detectProvider('https://gitlab.com/user/repo.git')).toBe('gitlab');
      expect(manager.detectProvider('https://custom.gitlab.com/user/repo.git')).toBe('gitlab');
    });

    it('should throw for unknown provider', () => {
      expect(() => manager.detectProvider('https://bitbucket.org/user/repo.git')).toThrow('Unknown Git provider');
    });
  });

  describe('injectTokenIntoUrl', () => {
    it('should inject token into GitHub URL', () => {
      const result = manager.injectTokenIntoUrl('https://github.com/user/repo.git', 'my_token');
      expect(result).toBe('https://my_token@github.com/user/repo.git');
    });

    it('should inject token into GitLab URL', () => {
      const result = manager.injectTokenIntoUrl('https://gitlab.com/user/repo.git', 'gl_token');
      expect(result).toBe('https://gl_token@gitlab.com/user/repo.git');
    });
  });

  describe('extractRepoName', () => {
    it('should extract repo name from GitHub URL', () => {
      expect(manager.extractRepoName('https://github.com/user/my-repo.git')).toBe('my-repo');
    });

    it('should extract repo name from GitLab URL', () => {
      expect(manager.extractRepoName('https://gitlab.com/user/another-repo.git')).toBe('another-repo');
    });

    it('should handle URL without .git suffix', () => {
      expect(manager.extractRepoName('https://github.com/user/my-repo')).toBe('my-repo');
    });

    it('should handle URL with multiple path segments', () => {
      expect(manager.extractRepoName('https://github.com/org/team/project.git')).toBe('project');
    });
  });
});
