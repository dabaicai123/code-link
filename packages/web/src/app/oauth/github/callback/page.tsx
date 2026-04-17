'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * GitHub OAuth 回调处理组件
 */
function GitHubCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // 等待认证状态加载完成
    if (authLoading) {
      return;
    }

    // 如果用户未登录，跳转到登录页
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

    // 调用后端 API 完成 OAuth 授权
    api
      .post('/github/oauth/callback', {
        code,
        userId: user.id,
      })
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      })
      .catch((err) => {
        setStatus('error');
        const message =
          err instanceof ApiError ? err.message : 'GitHub 授权失败，请重试';
        setErrorMessage(message);
      });
  }, [searchParams, user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-indigo-600 mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-indigo-600 mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-2 text-gray-600">正在授权 GitHub...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="h-12 w-12 text-green-500 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="mt-2 text-gray-900 font-medium">GitHub 授权成功！</p>
          <p className="mt-1 text-gray-500 text-sm">正在跳转到控制台...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <svg
          className="h-12 w-12 text-red-500 mx-auto"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        <p className="mt-2 text-gray-900 font-medium">GitHub 授权失败</p>
        {errorMessage && (
          <p className="mt-1 text-gray-500 text-sm">{errorMessage}</p>
        )}
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          返回控制台
        </button>
      </div>
    </div>
  );
}

/**
 * GitHub OAuth 回调页面
 * 注意：useSearchParams 需要 Suspense boundary
 */
export default function GitHubOAuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <svg
              className="animate-spin h-8 w-8 text-indigo-600 mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        </div>
      }
    >
      <GitHubCallbackContent />
    </Suspense>
  );
}
