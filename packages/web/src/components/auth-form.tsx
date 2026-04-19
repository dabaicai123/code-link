'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ width: '320px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px' }}>Code Link</div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '13px' }}>开发环境管理平台</div>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {error && <div style={{ padding: '12px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

          <div style={{ marginBottom: '12px' }}>
            <Input type="email" placeholder="邮箱地址" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '12px' }}>
              <Input type="text" placeholder="用户名" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <Button type="submit" disabled={loading} className="w-full" style={{ padding: '12px' }}>
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </Button>
        </form>

        <div style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          {mode === 'login' ? (
            <>没有账户？ <Link href="/register" style={{ color: 'var(--accent-primary)' }}>注册</Link></>
          ) : (
            <>已有账户？ <Link href="/login" style={{ color: 'var(--accent-primary)' }}>登录</Link></>
          )}
        </div>
      </div>
    </div>
  );
}