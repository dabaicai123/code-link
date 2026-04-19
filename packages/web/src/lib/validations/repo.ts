import { z } from 'zod';

export const addRepoSchema = z.object({
  url: z
    .string()
    .min(1, '请输入仓库 URL')
    .url('请输入有效的 URL'),
});

export const pushRepoSchema = z.object({
  message: z
    .string()
    .min(1, '请输入提交信息')
    .max(500, '提交信息不能超过 500 个字符'),
});

export type AddRepoInput = z.infer<typeof addRepoSchema>;
export type PushRepoInput = z.infer<typeof pushRepoSchema>;
