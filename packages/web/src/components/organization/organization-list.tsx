'use client';

import { useRouter } from 'next/navigation';
import { useOrganizations } from '@/lib/queries';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/constants';
import { Button } from '@/components/ui/button';

interface OrganizationListProps {
  onCreateOrganization: () => void;
}

export function OrganizationList({ onCreateOrganization }: OrganizationListProps) {
  const router = useRouter();
  const { data: organizations = [], isLoading, error, refetch } = useOrganizations();

  const handleClick = (orgId: number) => {
    router.push(`/organizations/${orgId}`);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)' }}>
        {error.message}
        <Button onClick={() => refetch()} variant="secondary" style={{ marginLeft: '12px' }}>
          重试
        </Button>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>您尚未加入任何组织</div>
        <Button onClick={onCreateOrganization} variant="default">
          创建组织
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          共 {organizations.length} 个组织
        </div>
        <Button onClick={onCreateOrganization} variant="default">
          创建组织
        </Button>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {organizations.map((org) => (
          <div
            key={org.id}
            onClick={() => handleClick(org.id)}
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500 }}>
                {org.name}
              </div>
              {org.role && (
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: `${ROLE_COLORS[org.role]}20`,
                    border: `1px solid ${ROLE_COLORS[org.role]}`,
                    borderRadius: 'var(--radius-sm)',
                    color: ROLE_COLORS[org.role],
                    fontSize: '11px',
                  }}
                >
                  {ROLE_LABELS[org.role]}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
              创建于 {new Date(org.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}