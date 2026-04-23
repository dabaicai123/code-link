import { z } from 'zod';
import { idParamSchema, repoIdParamSchema } from '../../shared/schemas.js';

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称最多100个字符'),
  templateType: z.enum(['node', 'node+java', 'node+python'], { message: '模板类型必须是 node, node+java 或 node+python' }),
  organizationId: z.number().int().positive('组织ID必须是正整数'),
});

export const addRepoSchema = z.object({
  url: z.string().url('必须是有效的 URL'),
});

export { idParamSchema as projectIdParamsSchema, repoIdParamSchema as repoIdParamsSchema };

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type AddRepoInput = z.infer<typeof addRepoSchema>;
export type ProjectIdParams = z.infer<typeof idParamSchema>;
export type RepoIdParams = z.infer<typeof repoIdParamSchema>;