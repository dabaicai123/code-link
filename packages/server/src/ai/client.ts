import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../core/logger/index.js';

const logger = createLogger('ai-client');

export interface AIResponse {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

let anthropicClient: Anthropic | null = null;

export function initAIClient(apiKey?: string): void {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    logger.warn('ANTHROPIC_API_KEY not set. AI commands disabled.');
    return;
  }

  anthropicClient = new Anthropic({ apiKey: key });
  logger.info('AI client initialized');
}

export function getAIClient(): Anthropic | null {
  return anthropicClient;
}

export async function sendAIMessage(
  messages: AIMessage[],
  options: AIRequestOptions = {}
): Promise<AIResponse> {
  if (!anthropicClient) {
    throw new Error('AI client not initialized');
  }

  const { system, maxTokens = 4096, temperature = 0.7 } = options;

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    // 提取文本内容
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content: textContent,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    logger.error('AI request failed:', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export function isAIEnabled(): boolean {
  return anthropicClient !== null;
}
