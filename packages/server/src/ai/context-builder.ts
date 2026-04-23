// packages/server/src/ai/context-builder.ts
import path from 'path';
import { getTranscriptPath, toContainerPath } from './transcript.js';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('context-builder');

export interface AIExecutionContext {
  projectId: number;
  draftId: number;
  transcriptPath?: string;
  command: string;
  args: string;
}

export async function buildAIExecutionContext(input: {
  projectId: number;
  draftId: number;
  command: string;
  args: string;
  contextCardId?: string;
}): Promise<AIExecutionContext> {
  const { projectId, draftId, command, args, contextCardId } = input;

  const transcriptPath = contextCardId
    ? getTranscriptPath(projectId, draftId, contextCardId)
    : undefined;

  if (!contextCardId) {
    logger.debug('Built AI context', { projectId, draftId });
  } else {
    logger.debug('Built AI context', { projectId, draftId, transcriptPath });
  }

  return {
    projectId,
    draftId,
    transcriptPath,
    command,
    args,
  };
}

export function generateClaudeCodePrompt(context: AIExecutionContext): string {
  const parts: string[] = [];

  parts.push(`@${toContainerPath(context.projectId, context.draftId, 'discussion.json')}`);

  if (context.transcriptPath) {
    const filename = path.basename(context.transcriptPath);
    parts.push(`@${toContainerPath(context.projectId, context.draftId, filename)}`);
  }

  parts.push(`${context.command} ${context.args}`);

  return parts.join(' ');
}