'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCurrentUser } from '@/lib/queries';

const spinnerStyle = { animation: 'spin 1s linear infinite', height: '32px', width: '32px', color: 'var(--accent-color)', margin: '0 auto' };

function LoadingSpinner() {
  return (
    <svg style={spinnerStyle} fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ textAlign: 'center' }}>{children}</div>
    </div>
  );
}

function GitLabCallbackContent() {
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
        await api.post('/gitlab/oauth/callback', {
          code,
          userId: user.id,
        });
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (err) {
        setStatus('error');
        const message = err instanceof ApiError ? err.message : 'GitLab 授权失败，请重试';
        setErrorMessage(message);
      }
    };

    handleCallback();
  }, [searchParams, user, authLoading, router]);

  if (authLoading) {
    return (
      <PageContainer>
        <LoadingSpinner />
        <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>加载中...</p>
      </PageContainer>
    );
  }

  if (status === 'loading') {
    return (
      <PageContainer>
        <LoadingSpinner />
        <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>正在授权 GitLab...</p>
      </PageContainer>
    );
  }

  if (status === 'success') {
    return (
      <PageContainer>
        <svg style={{ height: '48px', width: '48px', color: 'var(--status-success)', margin: '0 auto' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p style={{ marginTop: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>GitLab 授权成功！</p>
        <p style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '13px' }}>正在跳转到控制台...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <svg style={{ height: '48px', width: '48px', color: 'var(--status-error)', margin: '0 auto' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      <p style={{ marginTop: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>GitLab 授权失败</p>
      {errorMessage && <p style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '13px' }}>{errorMessage}</p>}
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'white',
          backgroundColor: 'var(--accent-color)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
      >
        返回控制台
      </button>
    </PageContainer>
  );
}

export default function GitLabOAuthCallback() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <LoadingSpinner />
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>加载中...</p>
        </PageContainer>
      }
    >
      <GitLabCallbackContent />
    </Suspense>
  );
}