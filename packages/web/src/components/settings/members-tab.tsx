'use client';

import { OrganizationMemberList } from '@/components/organization/organization-member-list';
import type { OrganizationDetail } from '@/types/organization';

interface MembersTabProps {
  organization: OrganizationDetail;
  currentUserId: number;
  onRefresh: () => void;
}

export function MembersTab({ organization, currentUserId, onRefresh }: MembersTabProps) {
  return (
    <div className="bg-bg-card border border-border-default rounded-md p-4">
      <h3 className="text-foreground text-sm mb-3">成员列表</h3>
      <OrganizationMemberList
        organizationId={organization.id}
        members={organization.members}
        currentUserId={currentUserId}
        currentUserRole={organization.role || 'member'}
        onRefresh={onRefresh}
      />
    </div>
  );
}