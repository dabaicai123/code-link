'use client';

import { useState } from 'react';
import { api, ApiError, OrgRole, OrganizationInvitation } from '@/lib/api';

const ROLE_OPTIONS: { value: OrgRole; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: '可以管理组织、邀请成员、创建和删除项目' },
  { value: 'developer', label: 'Developer', description: '可以创建项目、添加仓库、执行构建' },
  { value: 'member', label: 'Member', description: '可以查看项目和聊天记录' },
];

interface InviteMemberDialogProps {
  organizationId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invitation: OrganizationInvitation) => void;
}

export function InviteMemberDialog({ organizationId, isOpen, onClose, onSuccess }: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const invitation = await api.inviteMember(organizationId, email.trim().toLowerCase(), role);
      onSuccess(invitation);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '邀请失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} onClick={handleClose} />

      <div style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '400px', maxWidth: '90vw', padding: '24px', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>邀请成员</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              邮箱地址 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="输入被邀请人的邮箱"
              required
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              角色 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: `1px solid ${role === option.value ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: role === option.value ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    style={{ marginRight: '12px', accentColor: 'var(--accent-color)' }}
                  />
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{option.label}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={handleClose} className="btn btn-secondary">取消</button>
            <button type="submit" disabled={isSubmitting || !email.trim()} className="btn btn-primary">
              {isSubmitting ? '邀请中...' : '发送邀请'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}