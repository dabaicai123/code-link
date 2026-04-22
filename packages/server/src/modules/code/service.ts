import { singleton, inject } from 'tsyringe';
import { DockerService } from '../container/lib/docker.service.js';
import { ProjectRepository } from '../project/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { NotFoundError } from '../../core/errors/index.js';
import type {
  RepoGitStatus, GitFileChange, CommitNode, BranchInfo,
  FileContent, FileTreeNode, GitExecResult, GitFileStatus,
} from './types.js';

@singleton()
export class CodeService {
  constructor(
    @inject(DockerService) private readonly docker: DockerService,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(PermissionService) private readonly permission: PermissionService,
  ) {}

  private async getContainerId(userId: number, projectId: number): Promise<string> {
    const project = await this.permission.checkProjectAccess(userId, projectId);
    if (!project.containerId) throw new NotFoundError('容器');
    return project.containerId;
  }

  private async execGit(containerId: string, args: string[], workDir?: string): Promise<GitExecResult> {
    const command = workDir
      ? ['sh', '-c', `cd ${workDir} && git ${args.join(' ')}`]
      : ['git', ...args];
    const result = await this.docker.execInContainer(containerId, command);
    return result;
  }

  // ─── File operations ─────────────────────────────────────────

  async getFileTree(userId: number, projectId: number, repoName?: string): Promise<FileTreeNode[]> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.docker.execInContainer(containerId, [
      'sh', '-c', `cd ${workDir} && find . -not -path './.git/*' -not -path '*/node_modules/*' -not -path '*/.next/*' -not -name '.git' -not -name 'node_modules' | head -500`,
    ]);
    return this.parseFileTree(result.stdout);
  }

  async getFileContent(userId: number, projectId: number, path: string, repoName?: string): Promise<FileContent> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.docker.execInContainer(containerId, [
      'sh', '-c', `cat "${workDir}/${path}" | head -5000`,
    ]);
    return {
      path,
      content: result.stdout,
      language: this.detectLanguage(path),
      repoName: repoName || 'default',
    };
  }

  // ─── Git status ─────────────────────────────────────────────

  async getGitStatus(userId: number, projectId: number): Promise<RepoGitStatus[]> {
    const containerId = await this.getContainerId(userId, projectId);
    const reposResult = await this.docker.execInContainer(containerId, [
      'sh', '-c', 'find /home/codelink -maxdepth 2 -name .git -type d 2>/dev/null | sed "s/\\/\\.git$//"',
    ]);
    const repoPaths = reposResult.stdout.trim().split('\n').filter(Boolean);
    if (repoPaths.length === 0) return [];

    const statuses: RepoGitStatus[] = [];
    for (const repoPath of repoPaths) {
      const repoName = repoPath.split('/').pop() || 'default';

      const branchResult = await this.execGit(containerId, ['branch', '--show-current'], repoPath);
      const branch = branchResult.stdout.trim() || 'main';

      const statusResult = await this.execGit(containerId, ['status', '--porcelain'], repoPath);
      const files = this.parseGitStatus(statusResult.stdout);

      const trackingResult = await this.execGit(containerId, [
        'rev-list', '--left-right', '--count', `${branch}...origin/${branch}`,
      ], repoPath);
      const [ahead, behind] = this.parseAheadBehind(trackingResult.stdout);

      statuses.push({ repoName, branch, files, ahead, behind });
    }
    return statuses;
  }

  // ─── Git log / branch tree ──────────────────────────────────

  async getGitLog(userId: number, projectId: number, repoName?: string): Promise<CommitNode[]> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.execGit(containerId, [
      'log', '--all', '--pretty=format:%H|%s|%an|%at|%D|%P', '--topo-order', '-50',
    ], workDir);
    return this.parseGitLog(result.stdout);
  }

  async getBranches(userId: number, projectId: number, repoName?: string): Promise<BranchInfo[]> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.execGit(containerId, ['branch', '-a', '--no-color'], workDir);
    return this.parseBranchList(result.stdout);
  }

  // ─── Git diff ───────────────────────────────────────────────

  async getCommitDiff(userId: number, projectId: number, hash: string, repoName?: string): Promise<string> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.execGit(containerId, ['diff', `${hash}^!`, '--stat', '--patch'], workDir);
    return result.stdout;
  }

  // ─── Git operations ─────────────────────────────────────────

  async commit(userId: number, projectId: number, message: string, repoName?: string): Promise<{ success: boolean; hash?: string }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    await this.execGit(containerId, ['add', '-A'], workDir);
    const result = await this.execGit(containerId, ['commit', '-m', message], workDir);
    const hashMatch = result.stdout.match(/\[[^\]]*\s([a-f0-9]{7,})\]/);
    return { success: result.exitCode === 0, hash: hashMatch?.[1] };
  }

  async push(userId: number, projectId: number, repoName?: string): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.execGit(containerId, ['push'], workDir);
    return { success: result.exitCode === 0 };
  }

  async pull(userId: number, projectId: number, repoName?: string): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = repoName ? `/home/codelink/${repoName}` : '/home/codelink';
    const result = await this.execGit(containerId, ['pull'], workDir);
    return { success: result.exitCode === 0 };
  }

  async stage(userId: number, projectId: number, repoName: string, paths: string[]): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = `/home/codelink/${repoName}`;
    const result = await this.execGit(containerId, ['add', ...paths], workDir);
    return { success: result.exitCode === 0 };
  }

  async discard(userId: number, projectId: number, repoName: string, paths: string[]): Promise<{ success: boolean }> {
    const containerId = await this.getContainerId(userId, projectId);
    const workDir = `/home/codelink/${repoName}`;
    const checkoutResult = await this.execGit(containerId, ['checkout', '--', ...paths], workDir);
    const cleanResult = await this.execGit(containerId, ['clean', '-f', ...paths], workDir);
    return { success: checkoutResult.exitCode === 0 && cleanResult.exitCode === 0 };
  }

  // ─── Private parsing helpers ────────────────────────────────

  private parseFileTree(raw: string): FileTreeNode[] {
    const lines = raw.trim().split('\n').filter(Boolean);
    const nodes: FileTreeNode[] = [];
    for (const line of lines) {
      const cleanPath = line.replace(/^\.\//, '');
      const parts = cleanPath.split('/');
      const name = parts[parts.length - 1];
      const isDir = !name.includes('.') || name === '';
      if (!name) continue;
      nodes.push({
        name,
        path: cleanPath,
        type: isDir ? 'directory' : 'file',
      });
    }
    return nodes;
  }

  private parseGitStatus(raw: string): GitFileChange[] {
    const files: GitFileChange[] = [];
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      if (line.length < 3) continue;
      const index = line[0];
      const workTree = line[1];
      const path = line.substring(3);
      const staged = index !== ' ' && index !== '?' && index !== '.';
      const status = this.mapStatus(index, workTree);
      files.push({ path, status, staged });
    }
    return files;
  }

  private mapStatus(index: string, workTree: string): GitFileStatus {
    if (workTree === 'M' || index === 'M') return 'modified';
    if (workTree === 'A' || index === 'A') return 'added';
    if (workTree === 'D' || index === 'D') return 'deleted';
    if (workTree === 'R' || index === 'R') return 'renamed';
    if (workTree === '?' || index === '?') return 'untracked';
    return 'modified';
  }

  private parseAheadBehind(raw: string): [number, number] {
    const parts = raw.trim().split('\t');
    return [Number(parts[0]) || 0, Number(parts[1]) || 0];
  }

  private parseGitLog(raw: string): CommitNode[] {
    const commits: CommitNode[] = [];
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      const parts = line.split('|');
      if (parts.length < 6) continue;
      const [hash, message, author, timestamp, refs, parents] = parts;
      const branch = this.extractBranchFromRefs(refs);
      const isHead = refs.includes('HEAD');
      const parentList = parents.split(' ').filter(Boolean);
      const isMerge = parentList.length > 1;
      commits.push({
        hash,
        message,
        author,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        branch,
        isHead,
        isMerge,
        parentHashes: parentList,
        mergeFrom: isMerge ? branch : undefined,
      });
    }
    return commits;
  }

  private extractBranchFromRefs(refs: string): string {
    const match = refs.match(/HEAD -> ([^,\s]+)/);
    if (match) return match[1];
    const firstRef = refs.split(',')[0]?.trim();
    if (firstRef?.startsWith('tag:')) return firstRef.replace('tag: ', '');
    return firstRef || 'main';
  }

  private parseBranchList(raw: string): BranchInfo[] {
    const branches: BranchInfo[] = [];
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      const isCurrent = line.startsWith('*');
      const cleanLine = line.replace(/^\* /, '').replace(/^  /, '');
      const isRemote = cleanLine.startsWith('remotes/');
      const name = cleanLine.replace('remotes/origin/', '');
      branches.push({ name, isCurrent, isRemote });
    }
    return branches;
  }

  private detectLanguage(path: string): string {
    const ext = path.split('.').pop() || '';
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', css: 'css',
      html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
      sql: 'sql', sh: 'shell', bash: 'shell', vue: 'vue', svelte: 'svelte',
    };
    return map[ext] || 'plaintext';
  }
}