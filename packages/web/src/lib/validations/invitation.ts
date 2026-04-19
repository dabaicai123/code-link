import { z } from 'zod';

export const orgRoleSchema = z.enum(['owner', 'developer', 'member']);

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱地址')
    .email('请输入有效的邮箱地址'),
  role: orgRoleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
