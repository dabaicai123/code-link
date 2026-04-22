import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称最多100个字符'),
  templateType: z.enum(['node', 'node+java', 'node+python'], { message: '模板类型必须是 node, node+java 或 node+python' }),
  organizationId: z.number().int().positive('组织ID必须是正整数'),
});

export const addRepoSchema = z.object({
  url: z.string().url('必须是有效的 URL'),
});

export const projectIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
});

export const repoIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
  repoId: z.string().regex(/^\d+$/, '仓库ID必须是数字').transform(Number),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type AddRepoInput = z.infer<typeof addRepoSchema>;
export type ProjectIdParams = z.infer<typeof projectIdParamsSchema>;
export type RepoIdParams = z.infer<typeof repoIdParamsSchema>;