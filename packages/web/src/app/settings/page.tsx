'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadConfig();
    }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存配置失败';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfigText(JSON.stringify(DEFAULT_CONFIG, null, 2));
    setError(null);
    setSuccess(null);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authLoading || !user) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← 返回
          </button>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>设置</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{user.name}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              marginLeft: '8px',
            }}
          >
            退出
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'organization' && <OrganizationTabContent currentUserId={user.id} />}

        {activeTab === 'claude-code' && (
          <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                maxWidth: '800px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: '0 0 8px 0' }}>
                  配置信息
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                  此配置将用于所有项目的 Claude Code 环境。
                  {hasConfig ? ' 您已保存自定义配置。' : ' 您尚未配置，使用默认模板。'}
                </p>
              </div>

              {error && (
                <div
                  style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    color: 'var(--status-error)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    fontSize: '14px',
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    color: 'var(--status-running)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    fontSize: '14px',
                  }}
                >
                  {success}
                </div>
              )}

              {isLoading ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
                  加载中...
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        display: 'block',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        marginBottom: '8px',
                      }}
                    >
                      JSON 配置
                    </label>
                    <textarea
                      value={configText}
                      onChange={(e) => {
                        setConfigText(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      style={{
                        width: '100%',
                        height: '400px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                      spellCheck={false}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="btn btn-primary"
                    >
                      {isSaving ? '保存中...' : '保存配置'}
                    </button>
                    <button onClick={handleReset} disabled={isSaving} className="btn btn-secondary">
                      重置为默认
                    </button>
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