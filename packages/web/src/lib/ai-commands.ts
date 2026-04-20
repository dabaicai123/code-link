// packages/web/src/lib/ai-commands.ts
import type { AICommandType } from '@/types/draft';

// 重新导出类型以保持向后兼容
export type { AICommandType };

/**
 * AI 命令建议
 */
export interface AICommandSuggestion {
  type: AICommandType;
  description: string;
  example: string;
}

/**
 * AI 命令列表
 */
export const AI_COMMANDS: AICommandSuggestion[] = [
  { type: 'generate', description: '生成代码', example: '@AI generate a function to sort array' },
  { type: 'analyze', description: '分析代码或问题', example: '@AI analyze the performance issues' },
  { type: 'suggest', description: '提供建议', example: '@AI suggest improvements for this code' },
  { type: 'explain', description: '解释代码或概念', example: '@AI explain how React hooks work' },
  { type: 'review', description: '代码评审', example: '@AI review the changes in file.ts' },
  { type: 'refactor', description: '重构建议', example: '@AI refactor this function' },
  { type: 'test', description: '生成测试', example: '@AI test cases for this component' },
];

/**
 * 获取 AI 命令建议列表
 */
export function getAICommandSuggestions(): AICommandSuggestion[] {
  return AI_COMMANDS;
}

/**
 * 检测输入是否为 AI 命令
 */
export function detectAICommand(input: string): { isAI: boolean; command?: AICommandType } {
  const trimmed = input.trim();

  if (!trimmed.startsWith('@AI')) {
    return { isAI: false };
  }

  // 匹配命令类型
  const patterns: Record<AICommandType, RegExp> = {
    generate: /^@AI\s+generate\s/i,
    analyze: /^@AI\s+analyze\s/i,
    suggest: /^@AI\s+suggest\s/i,
    explain: /^@AI\s+explain\s/i,
    review: /^@AI\s+review\s/i,
    refactor: /^@AI\s+refactor\s/i,
    test: /^@AI\s+test\s/i,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(trimmed)) {
      return { isAI: true, command: type as AICommandType };
    }
  }

  // 是 AI 命令但未匹配具体类型
  return { isAI: true };
}

/**
 * 格式化 AI 命令
 */
export function formatAICommand(type: AICommandType, target: string, params?: Record<string, string>): string {
  let command = `@AI ${type} ${target}`;

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      command += ` --${key} ${value}`;
    }
  }

  return command;
}

/**
 * AI 命令类型中文标签
 */
export const AI_COMMAND_TYPE_LABELS: Record<AICommandType, string> = {
  generate: '生成代码',
  analyze: '分析',
  suggest: '建议',
  explain: '解释',
  review: '评审',
  refactor: '重构',
  test: '测试',
};

/**
 * AI 响应元数据接口
 */
export interface AIResponseMetadata {
  commandType: AICommandType;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

/**
 * 解析 AI 响应元数据
 */
export function parseAIResponseMetadata(metadata: string | null): AIResponseMetadata | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata);
    return {
      commandType: parsed.commandType,
      model: parsed.model,
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      error: parsed.error,
    };
  } catch {
    return null;
  }
}
