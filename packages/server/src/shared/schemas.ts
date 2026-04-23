import { z } from 'zod';

/** Shared param schemas — import from here instead of redefining per-module. */

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID必须是数字').transform(Number),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
});

export const orgIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, '组织ID必须是数字').transform(Number),
});

export const draftIdParamSchema = z.object({
  draftId: z.string().regex(/^\d+$/, 'Draft ID必须是数字').transform(Number),
});

export const invitationIdParamSchema = z.object({
  invId: z.string().regex(/^\d+$/, '邀请ID必须是数字').transform(Number),
});

export const repoIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
  repoId: z.string().regex(/^\d+$/, '仓库ID必须是数字').transform(Number),
});

export const userIdQuerySchema = z.object({
  userId: z.string().regex(/^\d+$/, '用户ID必须是数字').transform(Number),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type ProjectIdParam = z.infer<typeof projectIdParamSchema>;