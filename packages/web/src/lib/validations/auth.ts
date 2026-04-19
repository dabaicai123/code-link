import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱地址')
    .email('请输入有效的邮箱地址'),
  password: z
    .string()
    .min(1, '请输入密码'),
});

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱地址')
    .email('请输入有效的邮箱地址'),
  name: z
    .string()
    .min(1, '请输入用户名')
    .min(2, '用户名至少需要 2 个字符')
    .max(50, '用户名不能超过 50 个字符'),
  password: z
    .string()
    .min(1, '请输入密码')
    .min(6, '密码至少需要 6 个字符')
    .max(100, '密码不能超过 100 个字符'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
