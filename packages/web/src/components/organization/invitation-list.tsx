'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { OrganizationInvitation } from '@/types/invitation';
import type { OrgRole } from '@/types/user';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/constants';
import { Button } from '@/components/ui/button';

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
      router.push('/organizations');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '接受邀请失败');
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
      toast.error(err instanceof ApiError ? err.message : '拒绝邀请失败');
    } finally {
      setProcessingId(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <div className="text-center py-10 text-text-secondary">
        暂无待处理的邀请
      </div>
    );
  }

  return (
    <div>
      <div className="text-text-secondary text-[13px] mb-3">
        共 {invitations.length} 个待处理邀请
      </div>

      <div className="grid gap-3">
        {invitations.map((inv) => {
          const isProcessing = processingId === inv.id;

          return (
            <div
              key={inv.id}
              className="p-4 bg-bg-card border border-border-default rounded-md"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-text-primary text-[15px] font-medium">
                  {inv.organizationName || `组织 #${inv.organizationId}`}
                </div>
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] border"
                  style={{
                    backgroundColor: `${ROLE_COLORS[inv.role]}20`,
                    borderColor: ROLE_COLORS[inv.role],
                    color: ROLE_COLORS[inv.role],
                  }}
                >
                  {ROLE_LABELS[inv.role]}
                </span>
              </div>

              <div className="text-text-secondary text-[12px]">
                邀请人: {inv.invitedByName || '未知'}
              </div>

              <div className="text-text-muted text-[11px] mt-1">
                邀请时间: {new Date(inv.createdAt).toLocaleDateString('zh-CN')}
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => handleAccept(inv.id)}
                  disabled={isProcessing}
                  variant="default"
                >
                  {isProcessing ? '处理中...' : '接受'}
                </Button>
                <Button
                  onClick={() => handleDecline(inv.id)}
                  disabled={isProcessing}
                  variant="secondary"
                >
                  拒绝
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}