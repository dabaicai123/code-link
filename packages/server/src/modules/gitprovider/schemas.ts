import { z } from 'zod';
import { userIdQuerySchema, idParamSchema } from '../../shared/schemas.js';

export const providerEnum = z.enum(['github', 'gitlab']);

export const oauthCallbackSchema = z.object({
  code: z.string().min(1, '授权码不能为空'),
  userId: z.number().int().positive('用户ID必须是正整数'),
});

export { userIdQuerySchema as repoQuerySchema };

export const webhookCreateSchema = z.object({
  userId: z.number().int().positive('用户ID必须是正整数'),
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
  webhookUrl: z.string().url('webhookUrl 必须是有效的 URL'),
});

export { idParamSchema as gitLabProjectParamsSchema };

export type Provider = z.infer<typeof providerEnum>;
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
export type RepoQueryInput = z.infer<typeof userIdQuerySchema>;
export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;