import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Code Link',
  description: '开发环境管理平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
