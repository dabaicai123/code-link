import { z } from 'zod';
import { orgIdParamSchema, invitationIdParamSchema } from '../../shared/schemas.js';

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

export { orgIdParamSchema as orgIdParamsSchema, invitationIdParamSchema as invitationIdParamsSchema };

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;