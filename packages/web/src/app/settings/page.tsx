'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLogout, useCurrentUser } from '@/lib/queries';
import { useAuthStore } from '@/lib/stores/auth-store';
import { SettingsTabs, SettingsTab } from '@/components/settings/settings-tabs';
import { OrganizationTabContent } from '@/components/settings/organization-tab-content';
import { api } from '@/lib/api';

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

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { isLoading: authLoading } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<SettingsTab>('organization');
  const [configText, setConfigText] = useState('');
  const [hasConfig, setHasConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) loadConfig();
  }, [user, authLoading, router]);

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
    } finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    let config: typeof DEFAULT_CONFIG;
    try { config = JSON.parse(configText); } catch { setError('JSON 格式无效'); return; }
    if (!config.env || typeof config.env !== 'object') { setError('config.env 必须是对象'); return; }
    if (!config.env.ANTHROPIC_AUTH_TOKEN) { setError('ANTHROPIC_AUTH_TOKEN 不能为空'); return; }

    setIsSaving(true);
    try {
      await api.post('/claude-config', { config });
      setHasConfig(true);
      setSuccess('配置保存成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败');
    } finally { setIsSaving(false); }
  };

  const handleReset = () => {
    setConfigText(JSON.stringify(DEFAULT_CONFIG, null, 2));
    setError(null);
    setSuccess(null);
  };

  const handleLogout = () => { logout(); router.push('/login'); };

  if (authLoading || !user) {
    return <div className="h-screen flex items-center justify-center bg-bg-primary text-text-secondary">加载中...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-default bg-bg-secondary">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-none border-none text-text-secondary cursor-pointer text-sm flex items-center gap-1"
          >
            ← 返回
          </button>
          <h1 className="text-foreground text-lg m-0">设置</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent-primary rounded-md flex items-center justify-center text-white text-xs font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-foreground text-sm">{user.name}</span>
          <button onClick={handleLogout} className="bg-none border-none text-text-secondary cursor-pointer text-[13px] ml-2">退出</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'organization' && <OrganizationTabContent currentUserId={user.id} />}

        {activeTab === 'claude-code' && (
          <div className="flex-1 p-6 overflow-auto">
            <div className="bg-bg-card border border-border-default rounded-md p-6 max-w-[800px]">
              <div className="mb-4">
                <h2 className="text-foreground text-base mb-2">配置信息</h2>
                <p className="text-text-secondary text-[13px]">
                  此配置将用于所有项目的 Claude Code 环境。
                  {hasConfig ? ' 您已保存自定义配置。' : ' 您尚未配置，使用默认模板。'}
                </p>
              </div>

              {error && <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">{error}</div>}
              {success && <div className="bg-success/10 text-success p-3 rounded-md mb-4 text-sm">{success}</div>}

              {isLoading ? (
                <div className="text-text-secondary text-center py-10">加载中...</div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-foreground text-sm mb-2">JSON 配置</label>
                    <textarea
                      value={configText}
                      onChange={(e) => { setConfigText(e.target.value); setError(null); setSuccess(null); }}
                      className="w-full h-[400px] bg-bg-primary border border-border-default rounded-md p-3 text-foreground text-[13px] font-mono resize-y outline-none"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex gap-3">
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
        )}
      </div>
    </div>
  );
}