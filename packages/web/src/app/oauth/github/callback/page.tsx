'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCurrentUser } from '@/lib/queries';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-center">{children}</div>
    </div>
  );
}

function GitHubCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const { isLoading: authLoading } = useCurrentUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const code = searchParams.get('code');

    if (!code) {
      setStatus('error');
      setErrorMessage('缺少授权码');
      return;
    }

    const handleCallback = async () => {
      try {
        await api.post('/github/oauth/callback', {
          code,
          userId: user.id,
        });
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (err) {
        setStatus('error');
        const message = err instanceof ApiError ? err.message : 'GitHub 授权失败，请重试';
        setErrorMessage(message);
      }
    };

    handleCallback();
  }, [searchParams, user, authLoading, router]);

  if (authLoading) {
    return (
      <PageContainer>
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin mx-auto" />
        <p className="mt-2 text-text-secondary">加载中...</p>
      </PageContainer>
    );
  }

  if (status === 'loading') {
    return (
      <PageContainer>
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin mx-auto" />
        <p className="mt-2 text-text-secondary">正在授权 GitHub...</p>
      </PageContainer>
    );
  }

  if (status === 'success') {
    return (
      <PageContainer>
        <CheckCircle2 className="w-12 h-12 text-status-running mx-auto" />
        <p className="mt-2 text-text-primary font-medium">GitHub 授权成功！</p>
        <p className="mt-1 text-text-secondary text-[13px]">正在跳转到控制台...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <XCircle className="w-12 h-12 text-destructive mx-auto" />
      <p className="mt-2 text-text-primary font-medium">GitHub 授权失败</p>
      {errorMessage && <p className="mt-1 text-text-secondary text-[13px]">{errorMessage}</p>}
      <Button
        onClick={() => router.push('/dashboard')}
        className="mt-4"
      >
        返回控制台
      </Button>
    </PageContainer>
  );
}

export default function GitHubOAuthCallback() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin mx-auto" />
          <p className="mt-2 text-text-secondary">加载中...</p>
        </PageContainer>
      }
    >
      <GitHubCallbackContent />
    </Suspense>
  );
}