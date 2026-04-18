'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
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
  const { user, loading: authLoading, logout } = useAuth();
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

    // Validate JSON format
    let config: typeof DEFAULT_CONFIG;
    try {
      config = JSON.parse(configText);
    } catch {
      setError('JSON 格式无效');
      return;
    }

    // Validate required fields
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
    } catch (err: any) {
      setError(err.message || '保存配置失败');
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
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
        color: '#9ca3af'
      }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid #374151',
        backgroundColor: '#1f2937',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← 返回
          </button>
          <h1 style={{ color: '#f9fafb', fontSize: '18px', margin: 0 }}>Claude Code 配置</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: '#3b82f6',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ color: '#e5e7eb', fontSize: '14px' }}>{user.name}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '13px',
              marginLeft: '8px',
            }}
          >
            退出
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '8px',
          border: '1px solid #374151',
          padding: '24px',
        }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ color: '#f9fafb', fontSize: '16px', margin: '0 0 8px 0' }}>
              配置信息
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
              此配置将用于所有项目的 Claude Code 环境。
              {hasConfig ? ' 您已保存自定义配置。' : ' 您尚未配置，使用默认模板。'}
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#7f1d1d',
              color: '#fecaca',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              backgroundColor: '#14532d',
              color: '#bbf7d0',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
            }}>
              {success}
            </div>
          )}

          {isLoading ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>
              加载中...
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  color: '#e5e7eb',
                  fontSize: '14px',
                  marginBottom: '8px',
                }}>
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
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    padding: '12px',
                    color: '#e5e7eb',
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
                  style={{
                    backgroundColor: isSaving ? '#4b5563' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {isSaving ? '保存中...' : '保存配置'}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isSaving}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#9ca3af',
                    border: '1px solid #374151',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  重置为默认
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
