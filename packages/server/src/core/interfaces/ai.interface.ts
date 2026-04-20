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