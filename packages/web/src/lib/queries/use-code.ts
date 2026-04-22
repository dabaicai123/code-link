import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RepoGitStatus, CommitNode, BranchInfo, FileContent, FileTreeNode } from '@/types/code';

export const codeKeys = {
  all: ['code'] as const,
  gitStatus: (projectId: number) => [...codeKeys.all, 'gitStatus', projectId] as const,
  gitLog: (projectId: number, repoName?: string) => [...codeKeys.all, 'gitLog', projectId, repoName] as const,
  branches: (projectId: number, repoName?: string) => [...codeKeys.all, 'branches', projectId, repoName] as const,
  fileTree: (projectId: number, repoName?: string) => [...codeKeys.all, 'fileTree', projectId, repoName] as const,
  fileContent: (projectId: number, path: string, repoName?: string) => [...codeKeys.all, 'fileContent', projectId, path, repoName] as const,
  commitDiff: (projectId: number, hash: string, repoName?: string) => [...codeKeys.all, 'commitDiff', projectId, hash, repoName] as const,
};

export function useCodeGitStatus(projectId: number | null) {
  return useQuery({
    queryKey: codeKeys.gitStatus(projectId ?? 0),
    queryFn: () => api.getCodeGitStatus(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useCodeGitLog(projectId: number | null, repoName?: string) {
  return useQuery({
    queryKey: codeKeys.gitLog(projectId ?? 0, repoName),
    queryFn: () => api.getCodeGitLog(projectId!, repoName),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useCodeFileContent(projectId: number | null, path: string | null, repoName?: string) {
  return useQuery({
    queryKey: codeKeys.fileContent(projectId ?? 0, path ?? '', repoName),
    queryFn: () => api.getCodeFileContent(projectId!, path!, repoName),
    enabled: !!projectId && !!path,
    staleTime: 300_000,
  });
}

export function useCodeCommitDiff(projectId: number | null, hash: string | null, repoName?: string) {
  return useQuery({
    queryKey: codeKeys.commitDiff(projectId ?? 0, hash ?? '', repoName),
    queryFn: () => api.getCodeCommitDiff(projectId!, hash!, repoName),
    enabled: !!projectId && !!hash,
    staleTime: 300_000,
  });
}

export function useCodeGitCommit(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { message: string; repoName?: string }) =>
      api.codeGitCommit(projectId, data.message, data.repoName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}

export function useCodeGitPush(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName?: string }) => api.codeGitPush(projectId, data.repoName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.gitStatus(projectId) });
    },
  });
}

export function useCodeGitPull(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName?: string }) => api.codeGitPull(projectId, data.repoName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.all });
    },
  });
}

export function useCodeGitStage(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName: string; paths: string[] }) =>
      api.codeGitStage(projectId, data.repoName, data.paths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.gitStatus(projectId) });
    },
  });
}

export function useCodeGitDiscard(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { repoName: string; paths: string[] }) =>
      api.codeGitDiscard(projectId, data.repoName, data.paths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codeKeys.gitStatus(projectId) });
    },
  });
}