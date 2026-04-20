import { z } from 'zod';

/**
 * 用于验证容器操作的项目 ID 参数
 * 注意：命名为 containerIdParamsSchema 是为了与现有 Project 模块的模式命名保持一致
 * 实际验证的是项目 ID，因为容器操作是基于项目进行的
 */
export const containerIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '项目ID必须是数字').transform(Number),
});

export type ContainerIdParams = z.infer<typeof containerIdParamsSchema>;
