import { isAIEnabled, sendAIMessage, type AIMessage } from './client.js';
import { buildContextForDraft, type DraftContext } from './context.js';
import { getSystemPrompt, getCommandPrompt } from './prompts.js';
import { createLogger } from '../../../core/logger/index.js';

const logger = createLogger('ai-commands');

// New command patterns for AI collaboration
const ASSISTANT_PATTERN = /@助手\s+(.*)/i;
const SUPERPOWERS_PATTERN = /@助手\s+\/superpowers:(\w+)\s*(.*)/i;
const CARD_REFERENCE_PATTERN = /@卡片([a-f0-9-]+)/gi;

export type AICommandType =
  | 'generate'
  | 'analyze'
  | 'suggest'
  | 'explain'
  | 'review'
  | 'refactor'
  | 'test';

export interface AICommand {
  type: AICommandType;
  target?: string;
  params?: Record<string, string>;
  rawContent: string;
}

export interface AICommandResult {
  success: boolean;
  response?: string;
  commandType: AICommandType;
  error?: string;
}

export interface SuperpowersCommand {
  type: 'superpowers';
  skill: string;
  args: string;
  rawContent: string;
}

export interface FreeChatCommand {
  type: 'free_chat';
  prompt: string;
  rawContent: string;
}

const COMMAND_PATTERNS: Record<AICommandType, RegExp> = {
  generate: /@AI\s+generate\s+(.+)/i,
  analyze: /@AI\s+analyze\s+(.+)/i,
  suggest: /@AI\s+suggest\s+(.+)/i,
  explain: /@AI\s+explain\s+(.+)/i,
  review: /@AI\s+review\s+(.+)/i,
  refactor: /@AI\s+refactor\s+(.+)/i,
  test: /@AI\s+test\s+(.+)/i,
};

/**
 * Parse superpowers command from content
 */
export function parseSuperpowersCommand(content: string): SuperpowersCommand | null {
  const match = content.match(SUPERPOWERS_PATTERN);
  if (!match) return null;
  return {
    type: 'superpowers',
    skill: match[1],
    args: match[2].trim(),
    rawContent: content,
  };
}

/**
 * Check if content is a superpowers command
 */
export function isSuperpowersCommand(content: string): boolean {
  return SUPERPOWERS_PATTERN.test(content);
}

/**
 * Parse free chat command from content
 */
export function parseFreeChatCommand(content: string): FreeChatCommand | null {
  const match = content.match(ASSISTANT_PATTERN);
  if (!match) return null;
  // Exclude superpowers commands
  if (SUPERPOWERS_PATTERN.test(content)) return null;
  return {
    type: 'free_chat',
    prompt: match[1].trim(),
    rawContent: content,
  };
}

/**
 * Parse AI command from content
 * Priority: superpowers > free_chat > legacy AI commands
 */
export function parseAICommand(content: string): AICommand | SuperpowersCommand | FreeChatCommand | null {
  // superpowers 指令优先
  const superpowersCmd = parseSuperpowersCommand(content);
  if (superpowersCmd) return superpowersCmd;

  // 自由对话次优先
  const freeChatCmd = parseFreeChatCommand(content);
  if (freeChatCmd) return freeChatCmd;

  // 旧指令逻辑不变
  for (const [type, pattern] of Object.entries(COMMAND_PATTERNS)) {
    const match = content.match(pattern);
    if (match) {
      const target = match[1].trim();
      // Parse additional parameters (e.g., --file, --language)
      const params: Record<string, string> = {};
      const paramPattern = /--(\w+)\s+(\S+)/g;
      let paramMatch;
      while ((paramMatch = paramPattern.exec(target)) !== null) {
        params[paramMatch[1]] = paramMatch[2];
      }
      // Remove parameter parts, keep core target
      const cleanTarget = target.replace(paramPattern, '').trim();

      return {
        type: type as AICommandType,
        target: cleanTarget,
        params,
        rawContent: content,
      };
    }
  }

  return null;
}

/**
 * Execute AI command
 */
export async function executeAICommand(
  draftId: number,
  command: AICommand,
  _userId: number
): Promise<AICommandResult> {
  if (!isAIEnabled()) {
    return {
      success: false,
      commandType: command.type,
      error: 'AI 功能未启用。请配置 ANTHROPIC_API_KEY。',
    };
  }

  try {
    logger.info('Executing AI command', { draftId, commandType: command.type });

    // Build context for the draft
    const context = await buildContextForDraft(draftId);

    // Get system prompt with context
    const systemPrompt = getSystemPrompt(command.type, context);

    // Get user prompt
    const userPrompt = getCommandPrompt(command, context);

    // Build messages
    const messages: AIMessage[] = [
      { role: 'user', content: userPrompt },
    ];

    // Send to AI
    const response = await sendAIMessage(messages, {
      system: systemPrompt,
      maxTokens: 4096,
      temperature: 0.7,
    });

    logger.info('AI command executed successfully', {
      draftId,
      commandType: command.type,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    });

    return {
      success: true,
      response: response.content,
      commandType: command.type,
    };
  } catch (error) {
    logger.error('Failed to execute AI command', error instanceof Error ? error : new Error(String(error)), {
      draftId,
      commandType: command.type,
    });

    return {
      success: false,
      commandType: command.type,
      error: error instanceof Error ? error.message : 'AI 命令执行失败',
    };
  }
}

/**
 * Check if content is an AI command
 */
export function isAICommand(content: string): boolean {
  return content.trim().startsWith('@助手');
}

/**
 * Parse all card reference IDs from content
 */
export function parseCardReferenceIds(content: string): string[] {
  const ids: string[] = [];
  const matches = content.matchAll(CARD_REFERENCE_PATTERN);
  for (const match of matches) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * Extract the first card reference ID from content
 */
export function extractFirstCardReferenceId(content: string): string | undefined {
  const ids = parseCardReferenceIds(content);
  return ids[0];
}

