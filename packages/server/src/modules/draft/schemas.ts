import { z } from 'zod';
import { draftIdParamSchema } from '../../shared/schemas.js';

export const createDraftSchema = z.object({
  projectId: z.number().int().positive('项目ID必须是正整数'),
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  memberIds: z.array(z.number().int().positive()).optional(),
});

export const updateDraftStatusSchema = z.object({
  status: z.enum(['discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived'], {
    message: '状态必须是 discussing, brainstorming, reviewing, developing, confirmed 或 archived',
  }),
});

export const createDraftMessageSchema = z.object({
  content: z.string().min(1, '消息内容不能为空'),
  messageType: z.enum(['text', 'image', 'code', 'document_card', 'ai_command', 'system', 'ai_response', 'ai_error']).optional(),
  parentId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const confirmMessageSchema = z.object({
  type: z.enum(['agree', 'disagree', 'suggest'], {
    message: '确认类型必须是 agree, disagree 或 suggest',
  }),
  comment: z.string().max(500, '评论最多500个字符').optional(),
});

export const addDraftMemberSchema = z.object({
  newUserId: z.number().int().positive('用户ID必须是正整数'),
});

export { draftIdParamSchema as draftIdParamsSchema };

export const messageIdParamsSchema = draftIdParamSchema.extend({
  messageId: z.string().regex(/^\d+$/, '消息ID必须是数字').transform(Number),
});

export const memberIdParamsSchema = draftIdParamSchema.extend({
  memberId: z.string().regex(/^\d+$/, '成员ID必须是数字').transform(Number),
});

export const paginationQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  before: z.string().optional(),
});

export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftStatusInput = z.infer<typeof updateDraftStatusSchema>;
export type CreateDraftMessageInput = z.infer<typeof createDraftMessageSchema>;
export type ConfirmMessageInput = z.infer<typeof confirmMessageSchema>;
export type AddDraftMemberInput = z.infer<typeof addDraftMemberSchema>;