import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(1, '组织名称不能为空').max(100, '组织名称最多100个字符'),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, '组织名称不能为空').max(100, '组织名称最多100个字符'),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  role: z.enum(['owner', 'developer', 'member'], { message: '角色必须是 owner, developer 或 member' }),
});

export const orgIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '组织ID必须是数字').transform(Number),
});

export const invitationIdParamsSchema = z.object({
  invId: z.string().regex(/^\d+$/, '邀请ID必须是数字').transform(Number),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
