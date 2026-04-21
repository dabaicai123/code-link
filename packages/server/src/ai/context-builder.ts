// packages/server/src/ai/context-builder.ts
import { loadDiscussion, loadCard, getDiscussionPath, getTranscriptPath } from './transcript.js';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('context-builder');

export interface AIExecutionContext {
  projectId: number;
  draftId: number;
  discussionPath: string;
  transcriptPath?: string;
  command: string;
  args: string;
}

/**
 * 为 AI 执行构建上下文
 */
export async function buildAIExecutionContext(input: {
  projectId: number;
  draftId: number;
  command: string;
  args: string;
  contextCardId?: string;
}): Promise<AIExecutionContext> {
  const { projectId, draftId, command, args, contextCardId } = input;

  // 1. Discussion 文件路径
  const discussionPath = getDiscussionPath(projectId, draftId);

  // 2. 如果有引用卡片，加载其 transcript 路径
  let transcriptPath: string | undefined;
  if (contextCardId) {
    const card = await loadCard(projectId, draftId, contextCardId);
    if (card) {
      // 使用卡片数据中的 transcriptPath 或生成路径
      transcriptPath = card.transcriptPath || getTranscriptPath(projectId, draftId, contextCardId);
    }
  }

  logger.debug('Built AI context', { projectId, draftId, discussionPath, transcriptPath });

  return {
    projectId,
    draftId,
    discussionPath,
    transcriptPath,
    command,
    args,
  };
}

/**
 * 生成发送给 Claude Code 的完整指令
 * 路径映射：宿主机路径转换为容器内相对路径
 * 容器内工作目录为 /workspace，transcripts 目录映射为 /workspace/transcripts
 */
export function generateClaudeCodePrompt(context: AIExecutionContext): string {
  const parts: string[] = [];

  // 容器内相对路径（而非宿主机绝对路径）
  const containerDiscussionPath = `/workspace/transcripts/${context.projectId}/${context.draftId}/discussion.json`;
  parts.push(`@${containerDiscussionPath}`);

  if (context.transcriptPath) {
    const containerTranscriptPath = `/workspace/transcripts/${context.projectId}/${context.draftId}/${context.transcriptPath.split('/').pop()}`;
    parts.push(`@${containerTranscriptPath}`);
  }

  // 执行指令
  parts.push(`${context.command} ${context.args}`);

  return parts.join(' ');
}