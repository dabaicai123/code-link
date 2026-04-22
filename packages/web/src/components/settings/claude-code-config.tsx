'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const DEFAULT_CONFIG = {
  env: {
    ANTHROPIC_BASE_URL: '',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  },
  skipDangerousModePermissionPrompt: true,
};

interface ClaudeConfigResponse {
  config: typeof DEFAULT_CONFIG;
  hasConfig: boolean;
}

export function ClaudeCodeConfig() {
  const [configText, setConfigText] = useState('');
  const [hasConfig, setHasConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ClaudeConfigResponse>('/claude-config');
      setConfigText(JSON.stringify(response.config, null, 2));
      setHasConfig(response.hasConfig);
    } catch (err) {
      setError('加载配置失败');
      console.error('Failed to load config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    let config: typeof DEFAULT_CONFIG;
    try {
      config = JSON.parse(configText);
    } catch {
      setError('JSON 格式无效');
      return;
    }
    if (!config.env || typeof config.env !== 'object') {
      setError('config.env 必须是对象');
      return;
    }
    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      setError('ANTHROPIC_AUTH_TOKEN 不能为空');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/claude-config', { config });
      setHasConfig(true);
      setSuccess('配置保存成功');
      toast.success('配置保存成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfigText(JSON.stringify(DEFAULT_CONFIG, null, 2));
    setError(null);
    setSuccess(null);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary">Claude Code 配置</h1>
      <p className="text-sm text-text-muted mb-6">
        此配置将用于所有项目的 Claude Code 环境。
      </p>

      {/* Status indicator */}
      {hasConfig ? (
        <div className="flex items-center gap-1.5 text-[12px] mb-3 px-3 py-2 bg-[rgba(93,138,84,0.1)] border border-[rgba(93,138,84,0.3)] rounded-[var(--corner-sm)] text-[var(--status-running)]">
          <Check className="w-3.5 h-3.5" />
          已保存自定义配置
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[12px] mb-3 px-3 py-2 bg-bg-card border border-border-default rounded-[var(--corner-sm)] text-text-muted">
          <Check className="w-3.5 h-3.5" />
          您尚未配置，使用默认模板
        </div>
      )}

      {/* Config card */}
      <div className="bg-bg-card border border-border-default rounded-[var(--corner-lg)] p-5">
        <label className="block text-[13px] font-medium text-text-secondary mb-2">
          JSON 配置
        </label>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-[var(--corner-md)] mb-3 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-[var(--status-running)]/10 text-[var(--status-running)] p-3 rounded-[var(--corner-md)] mb-3 text-sm">
            {success}
          </div>
        )}

        {isLoading ? (
          <div className="text-text-muted text-center py-10">加载中...</div>
        ) : (
          <>
            <textarea
              value={configText}
              onChange={(e) => {
                setConfigText(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className="w-full h-[400px] bg-bg-primary border border-border-default rounded-[var(--corner-md)] p-3 text-[13px] font-[var(--ff-mono)] resize-y outline-none text-text-primary leading-relaxed focus:border-accent-primary"
              spellCheck={false}
            />

            <div className="flex gap-3 mt-4">
              <Button onClick={handleSave} disabled={isSaving} variant="default">
                {isSaving ? '保存中...' : '保存配置'}
              </Button>
              <Button onClick={handleReset} disabled={isSaving} variant="secondary">
                重置为默认
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}