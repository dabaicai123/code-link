# 组织管理第三阶段：前端 UI 实现

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现组织管理的完整前端界面，包括组织列表、组织详情、邀请处理等页面，以及修改现有组件支持组织选择。

**Architecture:** 新增组织相关页面路由，创建组织管理组件，修改项目创建对话框添加组织选择，更新侧边栏添加组织导航。

**Tech Stack:** React, Next.js App Router, TypeScript, CSS Variables

---

## Files Overview

| File | Purpose |
|------|---------|
| `packages/web/src/app/organizations/page.tsx` | 组织列表页面（新建） |
| `packages/web/src/app/organizations/[id]/page.tsx` | 组织详情页面（新建） |
| `packages/web/src/app/invitations/page.tsx` | 邀请处理页面（新建） |
| `packages/web/src/components/organization-list.tsx` | 组织列表组件（新建） |
| `packages/web/src/components/organization-member-list.tsx` | 组织成员列表组件（新建） |
| `packages/web/src/components/invite-member-dialog.tsx` | 邀请成员对话框（新建） |
| `packages/web/src/components/invitation-list.tsx` | 邀请列表组件（新建） |
| `packages/web/src/components/create-organization-dialog.tsx` | 创建组织对话框（新建） |
| `packages/web/src/components/create-project-dialog.tsx` | 修改：添加组织选择 |
| `packages/web/src/components/sidebar/index.tsx` | 修改：添加组织导航入口 |
| `packages/web/src/lib/api.ts` | 修改：添加组织相关 API |
| `packages/web/src/lib/auth-context.tsx` | 修改：扩展 User 类型 |

---

## Task 1: 扩展 API 客户端添加组织相关接口

**Files:**
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: 添加组织相关类型定义**

在 `api.ts` 文件中，在 `Repo` 接口之后添加：

```typescript
/**
 * 组织信息
 */
export interface Organization {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  role?: OrgRole;
}

/**
 * 组织角色
 */
export type OrgRole = 'owner' | 'developer' | 'member';

/**
 * 组织成员
 */
export interface OrganizationMember {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: OrgRole;
  joined_at: string;
}

/**
 * 组织邀请
 */
export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  organization_name?: string;
  email: string;
  role: OrgRole;
  invited_by: number;
  invited_by_name?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

/**
 * 组织详情（包含成员列表）
 */
export interface OrganizationDetail extends Organization {
  members: OrganizationMember[];
}
```

- [ ] **Step 2: 添加组织相关 API 方法**

在 `api` 对象中，在仓库相关 API 之后添加：

```typescript
  // 组织相关 API
  getOrganizations: (): Promise<Organization[]> =>
    apiClient<Organization[]>('/organizations', { method: 'GET' }),

  getOrganization: (orgId: number): Promise<OrganizationDetail> =>
    apiClient<OrganizationDetail>(`/organizations/${orgId}`, { method: 'GET' }),

  createOrganization: (name: string): Promise<Organization> =>
    apiClient<Organization>('/organizations', { method: 'POST', body: JSON.stringify({ name }) }),

  updateOrganization: (orgId: number, name: string): Promise<Organization> =>
    apiClient<Organization>(`/organizations/${orgId}`, { method: 'PUT', body: JSON.stringify({ name }) }),

  deleteOrganization: (orgId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}`, { method: 'DELETE' }),

  // 组织成员相关 API
  updateMemberRole: (orgId: number, userId: number, role: OrgRole): Promise<OrganizationMember> =>
    apiClient<OrganizationMember>(`/organizations/${orgId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  removeMember: (orgId: number, userId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}/members/${userId}`, { method: 'DELETE' }),

  // 组织邀请相关 API
  inviteMember: (orgId: number, email: string, role: OrgRole): Promise<OrganizationInvitation> =>
    apiClient<OrganizationInvitation>(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  getOrganizationInvitations: (orgId: number): Promise<OrganizationInvitation[]> =>
    apiClient<OrganizationInvitation[]>(`/organizations/${orgId}/invitations`, { method: 'GET' }),

  cancelInvitation: (orgId: number, invId: number): Promise<void> =>
    apiClient<void>(`/organizations/${orgId}/invitations/${invId}`, { method: 'DELETE' }),

  // 用户邀请相关 API
  getMyInvitations: (): Promise<OrganizationInvitation[]> =>
    apiClient<OrganizationInvitation[]>('/invitations', { method: 'GET' }),

  acceptInvitation: (invId: number): Promise<{ organization: Organization; member: OrganizationMember }> =>
    apiClient<{ organization: Organization; member: OrganizationMember }>(`/invitations/${invId}`, {
      method: 'POST',
    }),

  declineInvitation: (invId: number): Promise<void> =>
    apiClient<void>(`/invitations/${invId}`, { method: 'DELETE' }),
```

- [ ] **Step 3: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 4: 提交 API 扩展**

```bash
git -C /root/my/code-link add packages/web/src/lib/api.ts
git -C /root/my/code-link commit -m "feat(web): add organization API methods

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: 扩展 auth-context 用户类型

**Files:**
- Modify: `packages/web/src/lib/auth-context.tsx`

- [ ] **Step 1: 扩展 User 接口添加 id 为 number 类型**

修改 `User` 接口：

```typescript
/**
 * 用户信息
 */
interface User {
  id: number;  // 改为 number 类型，与后端一致
  email: string;
  name: string;
  avatar?: string | null;
}
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 可能有一些类型错误，后续步骤会修复

- [ ] **Step 3: 修复 dashboard page 的 User 类型**

在 `packages/web/src/app/dashboard/page.tsx` 中，修改 User 接口定义：

```typescript
interface User {
  id: number;
  email: string;
  name: string;
}
```

- [ ] **Step 4: 修复 sidebar 的 User 类型**

在 `packages/web/src/components/sidebar/index.tsx` 中，修改 User 接口定义：

```typescript
interface User {
  id: number;
  email: string;
  name: string;
}
```

- [ ] **Step 5: 修复 user-section 的 User 类型**

在 `packages/web/src/components/sidebar/user-section.tsx` 中，修改 User 接口定义：

```typescript
interface User {
  id: number;
  email: string;
  name: string;
}
```

- [ ] **Step 6: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 7: 提交类型修复**

```bash
git -C /root/my/code-link add packages/web/src/lib/auth-context.tsx packages/web/src/app/dashboard/page.tsx packages/web/src/components/sidebar/index.tsx packages/web/src/components/sidebar/user-section.tsx
git -C /root/my/code-link commit -m "fix(web): change User.id to number type for consistency

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: 创建创建组织对话框组件

**Files:**
- Create: `packages/web/src/components/create-organization-dialog.tsx`

- [ ] **Step 1: 创建创建组织对话框组件**

创建 `packages/web/src/components/create-organization-dialog.tsx`：

```typescript
'use client';

import { useState } from 'react';
import { api, ApiError, Organization } from '@/lib/api';

interface CreateOrganizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (organization: Organization) => void;
}

export function CreateOrganizationDialog({ isOpen, onClose, onSuccess }: CreateOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const organization = await api.createOrganization(name.trim());
      onSuccess(organization);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建组织失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} onClick={handleClose} />

      <div style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '400px', maxWidth: '90vw', padding: '24px', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>创建新组织</h2>
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
              组织名称 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="输入组织名称"
              required
              maxLength={100}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            创建组织后，您将自动成为组织的 owner，可以邀请成员加入组织。
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={handleClose} className="btn btn-secondary">取消</button>
            <button type="submit" disabled={isSubmitting || !name.trim()} className="btn btn-primary">
              {isSubmitting ? '创建中...' : '创建组织'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交创建组织对话框**

```bash
git -C /root/my/code-link add packages/web/src/components/create-organization-dialog.tsx
git -C /root/my/code-link commit -m "feat(web): add create organization dialog component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: 创建组织列表组件

**Files:**
- Create: `packages/web/src/components/organization-list.tsx`

- [ ] **Step 1: 创建组织列表组件**

创建 `packages/web/src/components/organization-list.tsx`：

```typescript
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
              创建于 {new Date(org.created_at).toLocaleDateString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交组织列表组件**

```bash
git -C /root/my/code-link add packages/web/src/components/organization-list.tsx
git -C /root/my/code-link commit -m "feat(web): add organization list component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: 创建邀请成员对话框组件

**Files:**
- Create: `packages/web/src/components/invite-member-dialog.tsx`

- [ ] **Step 1: 创建邀请成员对话框组件**

创建 `packages/web/src/components/invite-member-dialog.tsx`：

```typescript
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
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交邀请成员对话框**

```bash
git -C /root/my/code-link add packages/web/src/components/invite-member-dialog.tsx
git -C /root/my/code-link commit -m "feat(web): add invite member dialog component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: 创建组织成员列表组件

**Files:**
- Create: `packages/web/src/components/organization-member-list.tsx`

- [ ] **Step 1: 创建组织成员列表组件**

创建 `packages/web/src/components/organization-member-list.tsx`：

```typescript
'use client';

import { useState } from 'react';
import { api, ApiError, OrganizationMember, OrgRole } from '@/lib/api';

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

const ROLE_OPTIONS: OrgRole[] = ['owner', 'developer', 'member'];

interface OrganizationMemberListProps {
  organizationId: number;
  members: OrganizationMember[];
  currentUserId: number;
  currentUserRole: OrgRole;
  onRefresh: () => void;
}

export function OrganizationMemberList({
  organizationId,
  members,
  currentUserId,
  currentUserRole,
  onRefresh,
}: OrganizationMemberListProps) {
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<OrgRole>('member');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageMembers = currentUserRole === 'owner';

  const handleEditRole = (userId: number, currentRole: OrgRole) => {
    setEditingUserId(userId);
    setSelectedRole(currentRole);
    setError(null);
  };

  const handleSaveRole = async (userId: number) => {
    setIsUpdating(true);
    setError(null);

    try {
      await api.updateMemberRole(organizationId, userId, selectedRole);
      setEditingUserId(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改角色失败');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: number, memberRole: OrgRole) => {
    if (userId === currentUserId) {
      alert('不能移除自己');
      return;
    }

    // 检查是否是最后一个 owner
    const ownerCount = members.filter(m => m.role === 'owner').length;
    if (memberRole === 'owner' && ownerCount <= 1) {
      alert('不能移除最后一个 owner');
      return;
    }

    if (!confirm('确定要移除该成员吗？')) return;

    try {
      await api.removeMember(organizationId, userId);
      onRefresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '移除成员失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setError(null);
  };

  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
        共 {members.length} 名成员
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid var(--status-error)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--status-error)',
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '8px' }}>
        {members.map((member) => {
          const isEditing = editingUserId === member.id;
          const isCurrentUser = member.id === currentUserId;

          return (
            <div
              key={member.id}
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--accent-color)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                  {member.name}
                  {isCurrentUser && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '6px' }}>
                      (我)
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  {member.email}
                </div>
              </div>

              {/* Role */}
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
                    className="input"
                    style={{ width: '120px', padding: '6px 8px' }}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSaveRole(member.id)}
                    disabled={isUpdating}
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    {isUpdating ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isUpdating}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      backgroundColor: `${ROLE_COLORS[member.role]}20`,
                      border: `1px solid ${ROLE_COLORS[member.role]}`,
                      borderRadius: 'var(--radius-sm)',
                      color: ROLE_COLORS[member.role],
                      fontSize: '11px',
                    }}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>

                  {canManageMembers && !isCurrentUser && (
                    <>
                      <button
                        onClick={() => handleEditRole(member.id, member.role)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        修改角色
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.role)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--status-error)' }}
                      >
                        移除
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交组织成员列表组件**

```bash
git -C /root/my/code-link add packages/web/src/components/organization-member-list.tsx
git -C /root/my/code-link commit -m "feat(web): add organization member list component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: 创建邀请列表组件

**Files:**
- Create: `packages/web/src/components/invitation-list.tsx`

- [ ] **Step 1: 创建邀请列表组件**

创建 `packages/web/src/components/invitation-list.tsx`：

```typescript
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
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交邀请列表组件**

```bash
git -C /root/my/code-link add packages/web/src/components/invitation-list.tsx
git -C /root/my/code-link commit -m "feat(web): add invitation list component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: 创建组织列表页面

**Files:**
- Create: `packages/web/src/app/organizations/page.tsx`

- [ ] **Step 1: 创建组织列表页面**

创建 `packages/web/src/app/organizations/page.tsx`：

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { OrganizationList } from '@/components/organization-list';
import { CreateOrganizationDialog } from '@/components/create-organization-dialog';
import { Organization } from '@/lib/api';

export default function OrganizationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCreateSuccess = (org: Organization) => {
    setIsCreateDialogOpen(false);
    router.push(`/organizations/${org.id}`);
  };

  if (authLoading || !user) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
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
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← 返回
          </button>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>我的组织</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'var(--accent-color)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
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
              color: 'var(--text-secondary)',
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
        <OrganizationList onCreateOrganization={() => setIsCreateDialogOpen(true)} />
      </div>

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交组织列表页面**

```bash
git -C /root/my/code-link add packages/web/src/app/organizations/page.tsx
git -C /root/my/code-link commit -m "feat(web): add organizations list page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: 创建组织详情页面

**Files:**
- Create: `packages/web/src/app/organizations/[id]/page.tsx`

- [ ] **Step 1: 创建组织详情页面**

创建 `packages/web/src/app/organizations/[id]/page.tsx`：

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, OrganizationDetail, OrganizationInvitation, OrgRole } from '@/lib/api';
import { OrganizationMemberList } from '@/components/organization-member-list';
import { InviteMemberDialog } from '@/components/invite-member-dialog';

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = parseInt(params.id as string, 10);
  const { user, loading: authLoading, logout } = useAuth();

  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && orgId) {
      fetchOrganization();
    }
  }, [user, orgId]);

  const fetchOrganization = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrganization(orgId);
      setOrganization(data);
      setOrgName(data.name);

      // 如果是 owner，加载邀请列表
      if (data.role === 'owner') {
        const invData = await api.getOrganizationInvitations(orgId);
        setInvitations(invData);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载组织详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleInviteSuccess = (invitation: OrganizationInvitation) => {
    setIsInviteDialogOpen(false);
    setInvitations([...invitations, invitation]);
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!confirm('确定要取消这个邀请吗？')) return;

    try {
      await api.cancelInvitation(orgId, invId);
      setInvitations(invitations.filter((inv) => inv.id !== invId));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '取消邀请失败');
    }
  };

  const handleEditName = () => {
    setIsEditingName(true);
    setError(null);
  };

  const handleSaveName = async () => {
    if (!orgName.trim()) {
      setError('组织名称不能为空');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await api.updateOrganization(orgId, orgName.trim());
      setOrganization({ ...organization!, name: updated.name });
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改组织名称失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setOrgName(organization?.name || '');
    setError(null);
  };

  const handleDeleteOrganization = async () => {
    if (!organization) return;

    // 检查组织下是否有项目
    if (organization.members && organization.members.length > 1) {
      alert('组织下还有其他成员，请先移除所有成员');
      return;
    }

    if (!confirm('确定要删除这个组织吗？此操作不可恢复。')) return;
    if (!confirm('再次确认：删除组织将同时删除组织下的所有项目数据。')) return;

    setIsDeleting(true);
    try {
      await api.deleteOrganization(orgId);
      router.push('/organizations');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '删除组织失败');
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}>
        加载中...
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}>
        加载中...
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{ color: 'var(--status-error)', fontSize: '16px' }}>
          {error || '组织不存在'}
        </div>
        <button onClick={() => router.push('/organizations')} className="btn btn-primary">
          返回组织列表
        </button>
      </div>
    );
  }

  const currentUserRole = organization.role || 'member';
  const isOwner = currentUserRole === 'owner';

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
            onClick={() => router.push('/organizations')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← 返回
          </button>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>
            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="input"
                  style={{ width: '200px' }}
                  maxLength={100}
                />
                <button
                  onClick={handleSaveName}
                  disabled={isSaving}
                  className="btn btn-primary"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleCancelEditName}
                  disabled={isSaving}
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  取消
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {organization.name}
                {isOwner && (
                  <button
                    onClick={handleEditName}
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                  >
                    编辑
                  </button>
                )}
              </div>
            )}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'var(--accent-color)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
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
              color: 'var(--text-secondary)',
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
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-error)',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* 成员管理 */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: 0 }}>成员列表</h2>
            {isOwner && (
              <button onClick={() => setIsInviteDialogOpen(true)} className="btn btn-primary">
                邀请成员
              </button>
            )}
          </div>

          <OrganizationMemberList
            organizationId={orgId}
            members={organization.members}
            currentUserId={user.id}
            currentUserRole={currentUserRole}
            onRefresh={fetchOrganization}
          />
        </div>

        {/* 待处理邀请（仅 owner 可见） */}
        {isOwner && invitations.length > 0 && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: 0 }}>
                待处理邀请 ({invitations.length})
              </h2>
              <button
                onClick={() => setShowInvitations(!showInvitations)}
                className="btn btn-secondary"
              >
                {showInvitations ? '收起' : '展开'}
              </button>
            </div>

            {showInvitations && (
              <div style={{ display: 'grid', gap: '8px' }}>
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      padding: '10px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{inv.email}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                        角色: {inv.role} | 邀请时间: {new Date(inv.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelInvitation(inv.id)}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      取消邀请
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 删除组织（仅 owner 可见） */}
        {isOwner && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
          }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: '0 0 12px 0' }}>危险操作</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
              删除组织将同时删除组织下的所有项目和成员数据。此操作不可恢复。
            </div>
            <button
              onClick={handleDeleteOrganization}
              disabled={isDeleting}
              className="btn btn-secondary"
              style={{ color: 'var(--status-error)' }}
            >
              {isDeleting ? '删除中...' : '删除组织'}
            </button>
          </div>
        )}
      </div>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        organizationId={orgId}
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交组织详情页面**

```bash
git -C /root/my/code-link add packages/web/src/app/organizations/[id]/page.tsx
git -C /root/my/code-link commit -m "feat(web): add organization detail page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: 创建邀请处理页面

**Files:**
- Create: `packages/web/src/app/invitations/page.tsx`

- [ ] **Step 1: 创建邀请处理页面**

创建 `packages/web/src/app/invitations/page.tsx`：

```typescript
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
        color: 'var(--text-secondary)',
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
              color: 'var(--text-secondary)',
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
              backgroundColor: 'var(--accent-color)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
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
              color: 'var(--text-secondary)',
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
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交邀请处理页面**

```bash
git -C /root/my/code-link add packages/web/src/app/invitations/page.tsx
git -C /root/my/code-link commit -m "feat(web): add invitations page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: 修改项目创建对话框添加组织选择

**Files:**
- Modify: `packages/web/src/components/create-project-dialog.tsx`

- [ ] **Step 1: 添加组织选择功能**

修改 `packages/web/src/components/create-project-dialog.tsx`，添加组织选择：

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api, ApiError, Organization, OrgRole } from '@/lib/api';

type TemplateType = 'node' | 'node+java' | 'node+python';

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; description: string }[] = [
  { value: 'node', label: 'Node.js', description: '纯 Node.js 运行环境' },
  { value: 'node+java', label: 'Node.js + Java', description: 'Node.js 与 Java 混合环境' },
  { value: 'node+python', label: 'Node.js + Python', description: 'Node.js 与 Python 混合环境' },
];

interface Project {
  id: number;
  name: string;
  template_type: TemplateType;
  organization_id: number;
  container_id: string | null;
  status: 'created' | 'running' | 'stopped';
  created_by: number;
  created_at: string;
}

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

export function CreateProjectDialog({ isOpen, onClose, onSuccess }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('node');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const data = await api.getOrganizations();
      // 只显示有权限创建项目的组织 (owner 或 developer)
      const creatableOrgs = data.filter(
        (org) => org.role === 'owner' || org.role === 'developer'
      );
      setOrganizations(creatableOrgs);
      if (creatableOrgs.length > 0) {
        setSelectedOrgId(creatableOrgs[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!selectedOrgId) {
      setError('请选择一个组织');
      setIsSubmitting(false);
      return;
    }

    try {
      const project = await api.post<Project>('/projects', {
        name: name.trim(),
        template_type: templateType,
        organization_id: selectedOrgId,
      });
      onSuccess(project);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建项目失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setTemplateType('node');
    setSelectedOrgId(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  // 如果没有可创建项目的组织，显示提示
  if (!loadingOrgs && organizations.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} onClick={handleClose} />

        <div style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '400px', maxWidth: '90vw', padding: '24px', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>创建新项目</h2>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
          </div>

          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: '12px' }}>您没有权限创建项目</div>
            <div style={{ fontSize: '12px' }}>请联系组织管理员邀请您加入组织，或创建一个新组织</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={handleClose} className="btn btn-secondary">关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} onClick={handleClose} />

      <div style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '400px', maxWidth: '90vw', padding: '24px', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>创建新项目</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {/* 组织选择 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              所属组织 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            {loadingOrgs ? (
              <div style={{ color: 'var(--text-secondary)', padding: '8px' }}>加载中...</div>
            ) : (
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(parseInt(e.target.value, 10))}
                className="input"
                required
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.role === 'owner' ? 'Owner' : 'Developer'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 项目名称 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              项目名称 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="输入项目名称"
              required
            />
          </div>

          {/* 模板类型 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
              模板类型 <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TEMPLATE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: `1px solid ${templateType === option.value ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: templateType === option.value ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="template-type"
                    value={option.value}
                    checked={templateType === option.value}
                    onChange={() => setTemplateType(option.value)}
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
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? '创建中...' : '创建项目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交项目创建对话框更新**

```bash
git -C /root/my/code-link add packages/web/src/components/create-project-dialog.tsx
git -C /root/my/code-link commit -m "feat(web): add organization selection to project creation dialog

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: 修改侧边栏添加组织导航入口

**Files:**
- Modify: `packages/web/src/components/sidebar/index.tsx`

- [ ] **Step 1: 添加组织导航入口**

修改 `packages/web/src/components/sidebar/index.tsx`，在 "新建项目" 按钮之前添加组织相关入口：

首先，在 `SidebarProps` 中添加新属性：

```typescript
interface SidebarProps {
  user: User;
  activeProjectId: number | null;
  refreshKey?: number;
  onProjectSelect: (project: Project) => void;
  onCreateProject: () => void;
  onLogout: () => void;
  invitationCount?: number;  // 新增：待处理邀请数量
}
```

然后，在组件中添加导航入口。在 `<button onClick={onCreateProject}...` 之前添加：

```typescript
      {/* 导航入口 */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => router.push('/organizations')}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>我的组织</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>→</span>
        </button>

        {invitationCount > 0 && (
          <button
            onClick={() => router.push('/invitations')}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid var(--accent-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-color)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '6px',
            }}
          >
            <span>待处理邀请</span>
            <span style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
            }}>
              {invitationCount}
            </span>
          </button>
        )}
      </div>
```

还需要在组件顶部添加 `useRouter` 导入：

```typescript
import { useRouter } from 'next/navigation';
```

并在组件内添加：

```typescript
export function Sidebar({ user, activeProjectId, refreshKey, onProjectSelect, onCreateProject, onLogout, invitationCount }: SidebarProps) {
  const router = useRouter();
  // ... 其余代码
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交侧边栏更新**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/index.tsx
git -C /root/my/code-link commit -m "feat(web): add organization navigation to sidebar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: 更新 Dashboard 页面传递邀请数量

**Files:**
- Modify: `packages/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: 添加邀请数量获取逻辑**

修改 `packages/web/src/app/dashboard/page.tsx`，添加邀请数量获取：

首先，添加新的状态和接口：

```typescript
interface Invitation {
  id: number;
  status: 'pending' | 'accepted' | 'declined';
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);  // 新增

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // 新增：获取邀请数量
  useEffect(() => {
    if (user) {
      fetchInvitationCount();
    }
  }, [user]);

  const fetchInvitationCount = async () => {
    try {
      const invitations = await api.getMyInvitations();
      setInvitationCount(invitations.length);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  };
```

然后，在 Sidebar 组件调用中传递 `invitationCount`：

```typescript
      <Sidebar
        user={user}
        activeProjectId={activeProject?.id ?? null}
        refreshKey={projectRefreshKey}
        onProjectSelect={handleProjectSelect}
        onCreateProject={() => setIsDialogOpen(true)}
        onLogout={handleLogout}
        invitationCount={invitationCount}
      />
```

- [ ] **Step 2: 验证编译**

运行: `pnpm --filter @code-link/web exec tsc --noEmit`

预期: 无类型错误

- [ ] **Step 3: 提交 Dashboard 页面更新**

```bash
git -C /root/my/code-link add packages/web/src/app/dashboard/page.tsx
git -C /root/my/code-link commit -m "feat(web): add invitation count to dashboard sidebar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Summary

第三阶段完成后的成果：
1. API 客户端扩展：组织、成员、邀请相关接口
2. 创建组织对话框组件
3. 组织列表组件和页面
4. 邀请成员对话框组件
5. 组织成员列表组件
6. 邀请列表组件和页面
7. 组织详情页面（包含成员管理和邀请管理）
8. 项目创建对话框更新：添加组织选择
9. 侧边栏更新：添加组织导航入口
10. Dashboard 页面：显示待处理邀请数量

前端组织管理功能完整实现，用户可以：
- 查看和管理所属组织
- 邀请成员加入组织
- 处理收到的组织邀请
- 创建项目时选择所属组织
- 通过侧边栏快速访问组织功能