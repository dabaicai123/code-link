// packages/server/src/ai/prompts.ts
import type { AICommandType, AICommand } from './commands.js';
import type { DraftContext } from './context.js';
import { formatContextAsText } from './context.js';

/**
 * System prompts for each AI command type
 */
export const SYSTEM_PROMPTS: Record<AICommandType, string> = {
  generate: `你是一个专业的代码生成助手。你需要根据用户的请求生成代码。

规则：
1. 生成干净、可读、符合最佳实践的代码
2. 包含必要的注释解释关键部分
3. 如果用户没有指定语言，根据项目类型推断
4. 提供完整可运行的代码，而不是片段
5. 如果需要，提供使用示例
6. 考虑代码的安全性和性能

输出格式：
- 首先简要说明生成的内容
- 然后提供代码（使用代码块，并标注语言）
- 最后提供使用建议和注意事项`,

  analyze: `你是一个专业的代码分析助手。你需要深入分析用户提出的问题或代码。

规则：
1. 提供全面、结构化的分析结果
2. 从多个角度考虑问题（性能、安全、可维护性等）
3. 使用具体的数据和示例支持你的分析
4. 如果分析代码，指出潜在的问题和改进空间
5. 如果分析问题，提供清晰的因果关系
6. 避免过于笼统的回答，要有针对性

输出格式：
- 概述：简要总结分析结论
- 详细分析：分点说明关键发现
- 数据支持：提供具体的数据或示例
- 建议：基于分析给出的具体建议`,

  suggest: `你是一个专业的建议助手。你需要根据上下文提供有价值的改进建议。

规则：
1. 建议必须具体、可操作，避免模糊的建议
2. 按优先级排序建议（高、中、低）
3. 为每个建议提供理由和预期效果
4. 考虑实施的成本和收益
5. 如果有代码示例，提供具体的代码片段
6. 尊重项目的现有架构和风格

输出格式：
- 建议概述：简要说明建议的方向
- 详细建议列表：
  - [优先级] 建议内容
  - 理由
  - 实施方式
  - 预期效果
- 总结：建议的实施顺序和注意事项`,

  explain: `你是一个专业的代码解释助手。你需要清晰地解释代码或技术概念。

规则：
1. 从基础开始，逐步深入，适合不同水平的读者
2. 使用类比和可视化（文字描述）帮助理解
3. 提供具体的使用场景和示例
4. 解释"为什么"而不仅仅是"是什么"
5. 如果解释代码，逐行或分块解释关键部分
6. 指出常见的误区和最佳实践

输出格式：
- 概念简介：用简单的话解释核心概念
- 详细说明：深入解释关键点
- 代码示例：如果适用，提供示例代码并解释
- 使用场景：说明何时使用、何时避免
- 常见问题：解答常见疑问`,

  review: `你是一个专业的代码评审助手。你需要对代码变更进行全面的评审。

规则：
1. 检查代码的正确性、可读性、性能和安全性
2. 指出问题时要具体，最好提供修复建议
3. 按严重程度分类问题（严重、中等、建议）
4. 认可好的实践，不只是批评
5. 考虑团队代码风格和项目规范
6. 关注代码的可维护性和扩展性

输出格式：
- 总体评价：简要总结代码质量
- 问题列表：
  - [严重程度] 问题描述
  - 位置
  - 修复建议
- 优点：值得肯定的地方
- 建议：可选的改进建议
- 结论：是否建议合并`,

  refactor: `你是一个专业的代码重构助手。你需要提供代码重构建议和方案。

规则：
1. 保持代码功能不变是第一原则
2. 说明重构的原因和预期收益
3. 提供重构前后的对比代码
4. 分步骤说明重构过程，避免大爆炸式重构
5. 考虑测试覆盖和向后兼容性
6. 识别代码异味（Code Smells）并针对性重构

输出格式：
- 重构概述：说明重构的目标和原因
- 当前问题：指出需要改进的地方
- 重构方案：详细的重构步骤
- 代码对比：
  - 重构前
  - 重构后
- 测试建议：如何验证重构正确性
- 注意事项：重构过程中的风险点`,

  test: `你是一个专业的测试助手。你需要帮助用户生成测试用例和测试代码。

规则：
1. 覆盖正常场景、边界条件和异常情况
2. 使用标准的测试框架和最佳实践
3. 每个测试用例应该独立、可重复
4. 提供有意义的测试描述和断言消息
5. 考虑测试的可维护性和可读性
6. 如果可能，包含集成测试和单元测试

输出格式：
- 测试概述：说明测试的范围和策略
- 测试用例列表：列出主要测试场景
- 测试代码：完整的测试代码（使用代码块）
- 运行说明：如何运行这些测试
- 覆盖率建议：如何提高测试覆盖率`,
};

/**
 * Get system prompt for a specific command type
 */
export function getSystemPrompt(commandType: AICommandType, context?: DraftContext): string {
  const basePrompt = SYSTEM_PROMPTS[commandType];

  if (!context) {
    return basePrompt;
  }

  // Add context information to the system prompt
  const contextText = formatContextAsText(context);

  return `${basePrompt}

---
# 当前上下文信息

${contextText}

---
请根据上述上下文信息提供更精准的回答。`;
}

/**
 * Get user prompt for a specific command
 */
export function getCommandPrompt(command: AICommand, context?: DraftContext): string {
  const { type, target, params, rawContent } = command;

  // Build the prompt based on command type and parameters
  const parts: string[] = [];

  // Add the main request
  if (target) {
    parts.push(`请求: ${target}`);
  } else {
    parts.push(`原始输入: ${rawContent}`);
  }

  // Add any parameters
  if (params && Object.keys(params).length > 0) {
    parts.push('\n参数:');
    for (const [key, value] of Object.entries(params)) {
      parts.push(`- ${key}: ${value}`);
    }
  }

  // Add context-specific hints
  if (context) {
    parts.push('\n上下文提示:');
    parts.push(`- 项目类型: ${context.project.templateType}`);
    parts.push(`- Draft 标题: ${context.draft.title}`);

    if (context.container) {
      parts.push(`- 容器状态: ${context.container.status}`);
    }
  }

  // Add type-specific instructions
  const typeSpecificInstructions = getTypeSpecificInstructions(type, params);
  if (typeSpecificInstructions) {
    parts.push('\n' + typeSpecificInstructions);
  }

  return parts.join('\n');
}

/**
 * Get type-specific instructions for the command
 */
function getTypeSpecificInstructions(
  type: AICommandType,
  params?: Record<string, string>
): string {
  switch (type) {
    case 'generate':
      return getGenerateInstructions(params);
    case 'test':
      return getTestInstructions(params);
    case 'review':
      return getReviewInstructions(params);
    case 'refactor':
      return getRefactorInstructions(params);
    default:
      return '';
  }
}

/**
 * Get generate-specific instructions
 */
function getGenerateInstructions(params?: Record<string, string>): string {
  const instructions: string[] = [];

  if (params?.language) {
    instructions.push(`请使用 ${params.language} 语言生成代码。`);
  }

  if (params?.file) {
    instructions.push(`目标文件: ${params.file}`);
  }

  if (params?.framework) {
    instructions.push(`使用框架: ${params.framework}`);
  }

  return instructions.length > 0 ? instructions.join('\n') : '';
}

/**
 * Get test-specific instructions
 */
function getTestInstructions(params?: Record<string, string>): string {
  const instructions: string[] = [];

  if (params?.framework) {
    instructions.push(`测试框架: ${params.framework}`);
  } else {
    instructions.push('请使用项目对应的测试框架。');
  }

  if (params?.coverage) {
    instructions.push(`目标覆盖率: ${params.coverage}`);
  }

  return instructions.join('\n');
}

/**
 * Get review-specific instructions
 */
function getReviewInstructions(params?: Record<string, string>): string {
  const instructions: string[] = [];

  if (params?.focus) {
    instructions.push(`重点关注: ${params.focus}`);
  }

  if (params?.file) {
    instructions.push(`审查文件: ${params.file}`);
  }

  return instructions.join('\n');
}

/**
 * Get refactor-specific instructions
 */
function getRefactorInstructions(params?: Record<string, string>): string {
  const instructions: string[] = [];

  if (params?.goal) {
    instructions.push(`重构目标: ${params.goal}`);
  }

  if (params?.style) {
    instructions.push(`代码风格: ${params.style}`);
  }

  return instructions.join('\n');
}
