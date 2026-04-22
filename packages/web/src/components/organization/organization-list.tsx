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
      <div className="text-center py-10 text-text-secondary">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 bg-destructive/10 border border-destructive rounded-md text-destructive">
        {error.message}
        <Button onClick={() => refetch()} variant="secondary" className="ml-3">
          重试
        </Button>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-text-secondary mb-4">您尚未加入任何组织</div>
        <Button onClick={onCreateOrganization} variant="default">
          创建组织
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-text-secondary text-[13px]">
          共 {organizations.length} 个组织
        </div>
        <Button onClick={onCreateOrganization} variant="default">
          创建组织
        </Button>
      </div>

      <div className="grid gap-3">
        {organizations.map((org) => (
          <div
            key={org.id}
            onClick={() => handleClick(org.id)}
            className="p-4 bg-bg-card border border-border-default rounded-md cursor-pointer transition-all hover:border-accent-primary"
          >
            <div className="flex items-center justify-between">
              <div className="text-text-primary text-[15px] font-medium">
                {org.name}
              </div>
              {org.role && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] border"
                  style={{
                    backgroundColor: `${ROLE_COLORS[org.role]}20`,
                    borderColor: ROLE_COLORS[org.role],
                    color: ROLE_COLORS[org.role],
                  }}
                >
                  {ROLE_LABELS[org.role]}
                </span>
              )}
            </div>
            <div className="text-text-secondary text-[12px] mt-1">
              创建于 {new Date(org.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}