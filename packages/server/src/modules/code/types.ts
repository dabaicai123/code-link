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

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}