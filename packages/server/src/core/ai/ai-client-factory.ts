import { singleton } from 'tsyringe';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';
import { normalizeError } from '../errors/index.js';
import { createLogger } from '../logger/index.js';

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

export interface IAIService {
  sendMessage(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse>;
  isEnabled(): boolean;
}

const logger = createLogger('ai-client');

@singleton()
export class AIClientFactory implements IAIService {
  private client: Anthropic | null = null;

  constructor() {
    const config = getConfig();
    if (config.anthropicApiKey) {
      this.client = new Anthropic({ apiKey: config.anthropicApiKey });
      logger.info('AI client initialized');
    } else {
      logger.warn('ANTHROPIC_API_KEY not set. AI commands disabled.');
    }
  }

  getClient(): Anthropic | null {
    return this.client;
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async sendMessage(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('AI client not initialized');
    }

    const { system, maxTokens = 4096, temperature = 0.7 } = options;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      });

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
      logger.error('AI request failed:', normalizeError(error));
      throw error;
    }
  }
}