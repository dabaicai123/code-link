'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, Organization, OrgRole } from '@/lib/api';

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

interface OrganizationListProps {
  onCreateOrganization: () => void;
}

export function OrganizationList({ onCreateOrganization }: OrganizationListProps) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载组织列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (orgId: number) => {
    router.push(`/organizations/${orgId}`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)' }}>
        {error}
        <button onClick={fetchOrganizations} className="btn btn-secondary" style={{ marginLeft: '12px' }}>
          重试
        </button>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>您尚未加入任何组织</div>
        <button onClick={onCreateOrganization} className="btn btn-primary">
          创建组织
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          共 {organizations.length} 个组织
        </div>
        <button onClick={onCreateOrganization} className="btn btn-primary">
          创建组织
        </button>
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
