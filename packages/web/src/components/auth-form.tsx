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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-80 text-center">
        <div className="text-base font-semibold text-primary mb-2">Code Link</div>
        <div className="text-muted-foreground mb-6 text-[13px]">开发环境管理平台</div>

        <form onSubmit={handleSubmit} className="text-left">
          {error && (
            <div className="p-3 mb-4 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="mb-3">
            <Input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="mb-3">
              <Input
                type="text"
                placeholder="用户名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="mb-4">
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full py-3">
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </Button>
        </form>

        <div className="mt-4 text-secondary-foreground text-[13px]">
          {mode === 'login' ? (
            <>
              没有账户？{' '}
              <Link href="/register" className="text-primary hover:underline">
                注册
              </Link>
            </>
          ) : (
            <>
              已有账户？{' '}
              <Link href="/login" className="text-primary hover:underline">
                登录
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}