'use client';

import type { OrganizationInvitation } from '@/types/invitation';
import { Button } from '@/components/ui/button';

interface InvitationsTabProps {
  invitations: OrganizationInvitation[];
  show: boolean;
  onToggle: () => void;
  onCancel: (invId: number) => void;
}

export function InvitationsTab({ invitations, show, onToggle, onCancel }: InvitationsTabProps) {
  if (invitations.length === 0) return null;

  return (
    <div className="bg-bg-card border border-border-default rounded-md p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-foreground text-sm">待处理邀请 ({invitations.length})</h3>
        <Button onClick={onToggle} variant="secondary">{show ? '收起' : '展开'}</Button>
      </div>

      {show && (
        <div className="grid gap-2">
          {invitations.map(inv => (
            <div key={inv.id} className="p-2.5 bg-bg-secondary border border-border-default rounded-md flex items-center justify-between">
              <div>
                <div className="text-foreground text-[13px]">{inv.email}</div>
                <div className="text-text-secondary text-[11px]">角色: {inv.role} | 邀请时间: {new Date(inv.createdAt).toLocaleDateString('zh-CN')}</div>
              </div>
              <Button onClick={() => onCancel(inv.id)} variant="secondary" className="text-xs py-1 px-2">取消邀请</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}