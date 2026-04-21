// packages/server/src/ai/context-builder.ts
import { loadCard, getTranscriptPath } from './transcript.js';
import path from 'path';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('context-builder');

export interface AIExecutionContext {
  projectId: number;
  draftId: number;
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

  // 如果有引用卡片，加载其 transcript 路径
  let transcriptPath: string | undefined;
  if (contextCardId) {
    const card = await loadCard(projectId, draftId, contextCardId);
    if (card) {
      transcriptPath = card.transcriptPath || getTranscriptPath(projectId, draftId, contextCardId);
    } else {
      logger.warn(`Context card not found: ${contextCardId}`);
    }
  }

  logger.debug('Built AI context', { projectId, draftId, transcriptPath });

  return {
    projectId,
    draftId,
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
    const filename = path.basename(context.transcriptPath);
    const containerTranscriptPath = `/workspace/transcripts/${context.projectId}/${context.draftId}/${filename}`;
    parts.push(`@${containerTranscriptPath}`);
  }

  // 执行指令
  parts.push(`${context.command} ${context.args}`);

  return parts.join(' ');
}