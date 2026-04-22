import { z } from 'zod/v4';

export const projectIdParamsSchema = z.object({
  projectId: z.string().transform(Number),
});

export const filePathQuerySchema = z.object({
  path: z.string().min(1),
  repoName: z.string().optional(),
});

export const commitHashQuerySchema = z.object({
  hash: z.string().min(1),
  repoName: z.string().optional(),
});

export const commitBodySchema = z.object({
  message: z.string().min(1).max(500),
  repoName: z.string().optional(),
});

export const stageBodySchema = z.object({
  repoName: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1),
});

export const discardBodySchema = z.object({
  repoName: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1),
});

export const pushBodySchema = z.object({
  repoName: z.string().optional(),
});

export const pullBodySchema = z.object({
  repoName: z.string().optional(),
});