// packages/server/src/ai/context.ts
import type Database from 'better-sqlite3';
import { createLogger } from '../logger/index.js';
import { getContainerStatus } from '../docker/container-manager.js';

const logger = createLogger('ai-context');

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
export async function buildContextForDraft(
  db: Database.Database,
  draftId: number
): Promise<DraftContext> {
  // 获取 Draft 信息
  const draft = db.prepare(`
    SELECT d.*, p.name as project_name, p.template_type as project_template, p.container_id
    FROM drafts d
    JOIN projects p ON d.project_id = p.id
    WHERE d.id = ?
  `).get(draftId) as any;

  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }

  // 获取最近的消息（最多 20 条）
  const recentMessages = db.prepare(`
    SELECT m.*, u.name as user_name
    FROM draft_messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.draft_id = ?
    ORDER BY m.created_at DESC
    LIMIT 20
  `).all(draftId) as any[];

  // 获取成员列表
  const members = db.prepare(`
    SELECT dm.*, u.name as user_name
    FROM draft_members dm
    JOIN users u ON dm.user_id = u.id
    WHERE dm.draft_id = ?
  `).all(draftId) as any[];

  // 获取容器信息（如果存在）
  let container: { id: string; status: string } | undefined;
  if (draft.container_id) {
    try {
      const status = await getContainerStatus(draft.container_id);
      container = { id: draft.container_id, status };
    } catch (error) {
      logger.warn('获取容器状态失败', { containerId: draft.container_id, error });
      // 容器可能已被删除，不包含容器信息
    }
  }

  // 格式化消息（反转顺序，从早到晚）
  const formattedMessages = recentMessages
    .reverse()
    .map(m => ({
      userId: m.user_id,
      userName: m.user_name,
      content: m.content || '',
      messageType: m.message_type,
      createdAt: m.created_at,
    }));

  return {
    draftId,
    projectId: draft.project_id,
    project: {
      name: draft.project_name,
      templateType: draft.project_template,
    },
    draft: {
      title: draft.title,
      status: draft.status,
    },
    recentMessages: formattedMessages,
    members: members.map(m => ({
      userId: m.user_id,
      userName: m.user_name,
      role: m.role,
    })),
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
