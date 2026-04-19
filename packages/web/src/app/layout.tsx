import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { OrganizationProvider } from '@/lib/organization-context';
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
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <OrganizationProvider>{children}</OrganizationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}