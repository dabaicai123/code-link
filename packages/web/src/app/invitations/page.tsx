'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, OrganizationInvitation } from '@/lib/api';
import { InvitationList } from '@/components/invitation-list';

export default function InvitationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchInvitations();
    }
  }, [user]);

  const fetchInvitations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyInvitations();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载邀请列表失败');
    } finally {
      setLoading(false);
    }
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
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-muted)',
      }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← 返回
          </button>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>我的邀请</h1>
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
              color: 'var(--text-muted)',
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            加载中...
          </div>
        ) : error ? (
          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-error)',
          }}>
            {error}
            <button onClick={fetchInvitations} className="btn btn-secondary" style={{ marginLeft: '12px' }}>
              重试
            </button>
          </div>
        ) : (
          <InvitationList invitations={invitations} onRefresh={fetchInvitations} />
        )}
      </div>
    </div>
  );
}
