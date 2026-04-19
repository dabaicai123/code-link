import { z } from 'zod';

export const claudeEnvSchema = z.object({
  ANTHROPIC_BASE_URL: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().min(1, 'ANTHROPIC_AUTH_TOKEN 不能为空'),
  ANTHROPIC_DEFAULT_OPUS_MODEL: z.string().optional(),
  ANTHROPIC_DEFAULT_SONNET_MODEL: z.string().optional(),
  ANTHROPIC_DEFAULT_HAIKU_MODEL: z.string().optional(),
  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: z.string().optional(),
});

export const claudeConfigSchema = z.object({
  env: claudeEnvSchema,
  skipDangerousModePermissionPrompt: z.boolean().optional(),
});

export type ClaudeEnv = z.infer<typeof claudeEnvSchema>;
export type ClaudeConfig = z.infer<typeof claudeConfigSchema>;