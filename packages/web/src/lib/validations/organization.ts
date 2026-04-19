import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, '请输入组织名称')
    .min(2, '组织名称至少需要 2 个字符')
    .max(100, '组织名称不能超过 100 个字符'),
});

export const updateOrganizationSchema = createOrganizationSchema;

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
