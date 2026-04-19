import { z } from 'zod';

export const templateTypeSchema = z.enum(['node', 'node+java', 'node+python']);

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, '请输入项目名称')
    .min(2, '项目名称至少需要 2 个字符')
    .max(100, '项目名称不能超过 100 个字符'),
  templateType: templateTypeSchema,
  organizationId: z
    .number()
    .int('组织 ID 必须是整数')
    .positive('请选择所属组织'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
