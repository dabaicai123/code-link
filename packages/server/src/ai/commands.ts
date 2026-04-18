import { isAIEnabled, type AIMessage } from './client.js';
import { createLogger } from '../logger/index.js';

const logger = createLogger('ai-commands');

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
 * Parse AI command from content
 */
export function parseAICommand(content: string): AICommand | null {
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
 * Note: This function requires context.ts and prompts.ts to be fully implemented.
 * Currently returns an error indicating the dependency is not ready.
 */
export async function executeAICommand(
  _db: unknown,
  _draftId: number,
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

  // TODO: Implement after context.ts and prompts.ts are created (Task 3 & Task 4)
  // This is a stub implementation
  logger.warn('executeAICommand called but context/prompts modules not ready', {
    commandType: command.type,
  });

  return {
    success: false,
    commandType: command.type,
    error: 'Command execution not yet implemented. Requires context.ts and prompts.ts modules.',
  };
}

/**
 * Check if content is an AI command
 */
export function isAICommand(content: string): boolean {
  return content.trim().startsWith('@AI');
}

/**
 * Get list of supported command types
 */
export function getSupportedCommands(): Array<{ type: AICommandType; description: string; example: string }> {
  return [
    { type: 'generate', description: '生成代码', example: '@AI generate a function to sort array' },
    { type: 'analyze', description: '分析代码或问题', example: '@AI analyze the performance issues' },
    { type: 'suggest', description: '提供建议', example: '@AI suggest improvements for this code' },
    { type: 'explain', description: '解释代码或概念', example: '@AI explain how React hooks work' },
    { type: 'review', description: '代码评审', example: '@AI review the changes in file.ts' },
    { type: 'refactor', description: '重构建议', example: '@AI refactor this function' },
    { type: 'test', description: '生成测试', example: '@AI test cases for this component' },
  ];
}