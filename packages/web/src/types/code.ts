export interface RepoGitStatus {
  repoName: string;
  branch: string;
  files: GitFileChange[];
  ahead: number;
  behind: number;
}

export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

export interface CommitNode {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  branch: string;
  isHead: boolean;
  isMerge: boolean;
  parentHashes: string[];
  mergeFrom?: string;
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  language: string;
  repoName: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export const GIT_STATUS_COLORS: Record<GitFileStatus, string> = {
  modified: 'var(--code-git-modified)',
  added: 'var(--code-git-added)',
  deleted: 'var(--code-git-modified)',
  renamed: 'var(--code-git-renamed)',
  untracked: 'var(--code-git-untracked)',
};

export const GIT_STATUS_LABELS: Record<GitFileStatus, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
};

export const REPO_COLORS = ['#0078d4', '#22c55e', '#d4a017', '#e74c3c', '#7c3aed'];