import "reflect-metadata";
import { container } from "tsyringe";
import { createLogger } from '../../../core/logger/index.js';
import { getContainerStatus } from '../../../docker/container-manager.js';
import { DraftRepository } from '../repository.js';

const logger = createLogger('ai-context');
const draftRepo = container.resolve(DraftRepository);

export interface DraftContext {
  draftId: number;
  projectId: number;
  project: {
    name: string;
    templateType: string;
  };
  draft: {
    title: string;
    status: string;
  };
  recentMessages: Array<{
    userId: number;
    userName: string;
    content: string;
    messageType: string;
    createdAt: string;
  }>;
  members: Array<{
    userId: number;
    userName: string;
    role: string;
  }>;
  container?: {
    id: string;
    status: string;
  };
}

/**
 * 为 Draft 构建 AI 上下文
 */
export async function buildContextForDraft(draftId: number): Promise<DraftContext> {

  const contextData = await draftRepo.findDraftContext(draftId);
  if (!contextData) {
    throw new Error(`Draft ${draftId} not found`);
  }

  // 获取容器信息（如果存在）
  let container: { id: string; status: string } | undefined;
  if (contextData.draft.containerId) {
    try {
      const status = await getContainerStatus(contextData.draft.containerId);
      container = { id: contextData.draft.containerId, status };
    } catch (error) {
      logger.warn('获取容器状态失败', { containerId: contextData.draft.containerId, error });
      // 容器可能已被删除，不包含容器信息
    }
  }

  // 格式化消息（反转顺序，从早到晚）
  const formattedMessages = contextData.recentMessages
    .reverse()
    .map(m => ({
      userId: m.userId,
      userName: m.userName,
      content: m.content || '',
      messageType: m.messageType,
      createdAt: m.createdAt,
    }));

  return {
    draftId,
    projectId: contextData.draft.projectId,
    project: {
      name: contextData.draft.projectName,
      templateType: contextData.draft.projectTemplate,
    },
    draft: {
      title: contextData.draft.title,
      status: contextData.draft.status,
    },
    recentMessages: formattedMessages,
    members: contextData.members,
    container,
  };
}

/**
 * 格式化上下文为文本（用于 Prompt）
 */
export function formatContextAsText(context: DraftContext): string {
  const lines: string[] = [];

  lines.push(`# 项目信息`);
  lines.push(`- 项目名称: ${context.project.name}`);
  lines.push(`- 项目类型: ${context.project.templateType}`);

  lines.push(`\n# Draft 信息`);
  lines.push(`- Draft 标题: ${context.draft.title}`);
  lines.push(`- 当前状态: ${context.draft.status}`);

  lines.push(`\n# 成员`);
  context.members.forEach(m => {
    lines.push(`- ${m.userName} (${m.role})`);
  });

  if (context.recentMessages.length > 0) {
    lines.push(`\n# 最近讨论（共 ${context.recentMessages.length} 条）`);
    context.recentMessages.forEach(m => {
      const typeLabel = m.messageType === 'ai_command' ? '[AI指令]' :
                        m.messageType === 'code' ? '[代码]' : '';
      lines.push(`- ${m.userName}: ${typeLabel} ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`);
    });
  }

  if (context.container) {
    lines.push(`\n# 容器状态`);
    lines.push(`- 容器 ID: ${context.container.id}`);
    lines.push(`- 状态: ${context.container.status}`);
  }

  return lines.join('\n');
}