'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, OrganizationInvitation, OrgRole } from '@/lib/api';

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  developer: 'Developer',
  member: 'Member',
};

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: 'var(--accent-color)',
  developer: 'var(--status-success)',
  member: 'var(--text-secondary)',
};

interface InvitationListProps {
  invitations: OrganizationInvitation[];
  onRefresh: () => void;
}

export function InvitationList({ invitations, onRefresh }: InvitationListProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleAccept = async (invId: number) => {
    setProcessingId(invId);
    try {
      await api.acceptInvitation(invId);
      onRefresh();
      // 成功后跳转到组织详情
      router.push('/organizations');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '接受邀请失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invId: number) => {
    if (!confirm('确定要拒绝这个邀请吗？')) return;

    setProcessingId(invId);
    try {
      await api.declineInvitation(invId);
      onRefresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '拒绝邀请失败');
    } finally {
      setProcessingId(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        暂无待处理的邀请
      </div>
    );
  }

  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
        共 {invitations.length} 个待处理邀请
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {invitations.map((inv) => {
          const isProcessing = processingId === inv.id;

          return (
            <div
              key={inv.id}
              style={{
                padding: '16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500 }}>
                  {inv.organization_name || `组织 #${inv.organization_id}`}
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: `${ROLE_COLORS[inv.role]}20`,
                    border: `1px solid ${ROLE_COLORS[inv.role]}`,
                    borderRadius: 'var(--radius-sm)',
                    color: ROLE_COLORS[inv.role],
                    fontSize: '11px',
                  }}
                >
                  {ROLE_LABELS[inv.role]}
                </span>
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                邀请人: {inv.invited_by_name || '未知'}
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px' }}>
                邀请时间: {new Date(inv.created_at).toLocaleDateString('zh-CN')}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => handleAccept(inv.id)}
                  disabled={isProcessing}
                  className="btn btn-primary"
                >
                  {isProcessing ? '处理中...' : '接受'}
                </button>
                <button
                  onClick={() => handleDecline(inv.id)}
                  disabled={isProcessing}
                  className="btn btn-secondary"
                >
                  拒绝
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}