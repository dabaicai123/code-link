# 设置页面重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将组织管理功能整合到设置页面，采用左侧垂直 Tab 导航，用户可在设置页面内完成所有组织管理操作。

**Architecture:** 重构 `/settings/page.tsx` 为 Tab 导航结构，创建独立的组织内容组件和详情面板组件，复用现有的成员列表和邀请弹窗组件。采用左右分栏布局展示组织列表和详情。

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, CSS Variables (现有样式系统)

---

## 文件结构

**创建文件：**
- `packages/web/src/components/settings/settings-tabs.tsx` - 左侧垂直 Tab 导航组件
- `packages/web/src/components/settings/organization-tab-content.tsx` - 组织 Tab 内容（列表 + 详情面板）
- `packages/web/src/components/settings/organization-detail-panel.tsx` - 组织详情右侧面板

**修改文件：**
- `packages/web/src/app/settings/page.tsx` - 重构为 Tab 结构主页面
- `packages/web/src/components/sidebar/index.tsx` - 更新"我的组织"按钮导航

**删除文件：**
- `packages/web/src/app/organizations/page.tsx` - 组织列表页面（功能迁移）
- `packages/web/src/app/organizations/[id]/page.tsx` - 组织详情页面（功能迁移）

---

## Task 1: 创建左侧垂直 Tab 导航组件

**Files:**
- Create: `packages/web/src/components/settings/settings-tabs.tsx`

- [ ] **Step 1: 创建 settings 目录和 settings-tabs 组件**

```tsx
'use client';

export type SettingsTab = 'organization' | 'claude-code';

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'organization', label: '组织' },
  { id: 'claude-code', label: 'Claude Code' },
];

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <div
      style={{
        width: '140px',
        padding: '16px 0',
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            backgroundColor: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '14px',
            textAlign: 'left',
            cursor: 'pointer',
            borderLeft: activeTab === tab.id ? '3px solid var(--accent-color)' : '3px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 提交代码**

```bash
git -C /root/my/code-link add packages/web/src/components/settings/settings-tabs.tsx
git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat: add vertical settings tabs component

Add SettingsTabs component for left-side vertical navigation in settings page.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建组织详情面板组件

**Files:**
- Create: `packages/web/src/components/settings/organization-detail-panel.tsx`

- [ ] **Step 1: 创建组织详情面板组件**

```tsx
'use client';

import { useState } from 'react';
import { api, ApiError, OrganizationDetail, OrganizationInvitation, OrgRole, OrganizationMember } from '@/lib/api';
import { OrganizationMemberList } from '@/components/organization-member-list';
import { InviteMemberDialog } from '@/components/invite-member-dialog';

interface OrganizationDetailPanelProps {
  organization: OrganizationDetail | null;
  currentUserId: number;
  onRefresh: () => void;
  onClose: () => void;
}

export function OrganizationDetailPanel({
  organization,
  currentUserId,
  onRefresh,
  onClose,
}: OrganizationDetailPanelProps) {
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [showInvitations, setShowInvitations] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // 当 organization 变化时，重置状态并加载邀请
  useState(() => {
    if (organization) {
      setOrgName(organization.name);
      setIsEditingName(false);
      setError(null);
      loadInvitations();
    }
  });

  const loadInvitations = async () => {
    if (!organization || organization.role !== 'owner') return;
    try {
      const data = await api.getOrganizationInvitations(organization.id);
      setInvitations(data);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    }
  };

  if (!organization) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '14px',
        }}
      >
        选择一个组织查看详情
      </div>
    );
  }

  const isOwner = organization.role === 'owner';

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
      await api.updateOrganization(organization.id, orgName.trim());
      await onRefresh();
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改组织名称失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setOrgName(organization.name);
    setError(null);
  };

  const handleInviteSuccess = (invitation: OrganizationInvitation) => {
    setIsInviteDialogOpen(false);
    setInvitations([...invitations, invitation]);
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!confirm('确定要取消这个邀请吗？')) return;

    try {
      await api.cancelInvitation(organization.id, invId);
      setInvitations(invitations.filter((inv) => inv.id !== invId));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '取消邀请失败');
    }
  };

  const handleLeaveOrganization = async () => {
    if (!confirm('确定要退出该组织吗？')) return;

    try {
      await api.removeMember(organization.id, currentUserId);
      onClose();
      onRefresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '退出组织失败');
    }
  };

  return (
    <div
      style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto',
        borderLeft: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* 头部：名称 + 邀请按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditingName ? (
            <>
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
            </>
          ) : (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>
                {organization.name}
              </h2>
              {isOwner && (
                <button
                  onClick={handleEditName}
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '11px' }}
                >
                  编辑
                </button>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isOwner && (
            <button onClick={() => setIsInviteDialogOpen(true)} className="btn btn-primary">
              邀请成员
            </button>
          )}
          {!isOwner && (
            <button
              onClick={handleLeaveOrganization}
              className="btn btn-secondary"
              style={{ color: 'var(--status-error)' }}
            >
              退出组织
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-error)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* 待处理邀请（Owner 可见） */}
      {isOwner && invitations.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0 }}>
              待处理邀请 ({invitations.length})
            </h3>
            <button onClick={() => setShowInvitations(!showInvitations)} className="btn btn-secondary">
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
                      角色: {inv.role} | 邀请时间: {new Date(inv.createdAt).toLocaleDateString('zh-CN')}
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

      {/* 成员列表 */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
        }}
      >
        <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', margin: '0 0 12px 0' }}>
          成员列表
        </h3>
        <OrganizationMemberList
          organizationId={organization.id}
          members={organization.members}
          currentUserId={currentUserId}
          currentUserRole={organization.role || 'member'}
          onRefresh={onRefresh}
        />
      </div>

      {/* 邀请成员弹窗 */}
      <InviteMemberDialog
        organizationId={organization.id}
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
```

- [ ] **Step 2: 提交代码**

```bash
git -C /root/my/code-link add packages/web/src/components/settings/organization-detail-panel.tsx
git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat: add organization detail panel component

Add OrganizationDetailPanel for displaying organization details, member list, and invitations in settings page.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 创建组织 Tab 内容组件

**Files:**
- Create: `packages/web/src/components/settings/organization-tab-content.tsx`

- [ ] **Step 1: 创建组织 Tab 内容组件**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { api, ApiError, Organization, OrganizationDetail, OrgRole } from '@/lib/api';
import { CreateOrganizationDialog } from '@/components/create-organization-dialog';
import { OrganizationDetailPanel } from './organization-detail-panel';

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

interface OrganizationTabContentProps {
  currentUserId: number;
}

export function OrganizationTabContent({ currentUserId }: OrganizationTabContentProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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

  const fetchOrganizationDetail = async (orgId: number) => {
    try {
      const data = await api.getOrganization(orgId);
      setSelectedOrg(data);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '加载组织详情失败');
    }
  };

  const handleSelectOrg = (org: Organization) => {
    fetchOrganizationDetail(org.id);
  };

  const handleCreateSuccess = (org: Organization) => {
    setIsCreateDialogOpen(false);
    fetchOrganizations();
    // 自动选中新创建的组织
    fetchOrganizationDetail(org.id);
  };

  const handleCloseDetail = () => {
    setSelectedOrg(null);
  };

  const handleRefresh = async () => {
    await fetchOrganizations();
    if (selectedOrg) {
      await fetchOrganizationDetail(selectedOrg.id);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--status-error)',
          padding: '20px',
        }}
      >
        {error}
        <button onClick={fetchOrganizations} className="btn btn-secondary" style={{ marginLeft: '12px' }}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* 左侧组织列表 */}
      <div
        style={{
          width: '280px',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <button onClick={() => setIsCreateDialogOpen(true)} className="btn btn-primary" style={{ width: '100%' }}>
            + 创建组织
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {organizations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
              您尚未加入任何组织
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  style={{
                    padding: '12px',
                    backgroundColor: selectedOrg?.id === org.id ? 'var(--bg-primary)' : 'var(--bg-card)',
                    border: `1px solid ${selectedOrg?.id === org.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
                      {org.name}
                    </span>
                    {org.role && (
                      <span
                        style={{
                          padding: '2px 6px',
                          backgroundColor: `${ROLE_COLORS[org.role]}20`,
                          border: `1px solid ${ROLE_COLORS[org.role]}`,
                          borderRadius: 'var(--radius-sm)',
                          color: ROLE_COLORS[org.role],
                          fontSize: '10px',
                        }}
                      >
                        {ROLE_LABELS[org.role]}
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px' }}>
                    创建于 {new Date(org.createdAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧详情面板 */}
      <OrganizationDetailPanel
        organization={selectedOrg}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
        onClose={handleCloseDetail}
      />

      {/* 创建组织弹窗 */}
      <CreateOrganizationDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
```

- [ ] **Step 2: 提交代码**

```bash
git -C /root/my/code-link add packages/web/src/components/settings/organization-tab-content.tsx
git -C /root/my/code-link commit -m "$(cat <<'EOF'
feat: add organization tab content component

Add OrganizationTabContent with left organization list and right detail panel.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 重构设置页面主组件

**Files:**
- Modify: `packages/web/src/app/settings/page.tsx`

- [ ] **Step 1: 重构设置页面为 Tab 结构**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { SettingsTabs, SettingsTab } from '@/components/settings/settings-tabs';
import { OrganizationTabContent } from '@/components/settings/organization-tab-content';
import { api } from '@/lib/api';

const DEFAULT_CONFIG = {
  env: {
    ANTHROPIC_BASE_URL: '',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  },
  skipDangerousModePermissionPrompt: true,
};

interface ClaudeConfigResponse {
  config: typeof DEFAULT_CONFIG;
  hasConfig: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('organization');
  const [configText, setConfigText] = useState('');
  const [hasConfig, setHasConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadConfig();
    }
  }, [user, authLoading, router]);

  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ClaudeConfigResponse>('/claude-config');
      setConfigText(JSON.stringify(response.config, null, 2));
      setHasConfig(response.hasConfig);
    } catch (err) {
      setError('加载配置失败');
      console.error('Failed to load config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    let config: typeof DEFAULT_CONFIG;
    try {
      config = JSON.parse(configText);
    } catch {
      setError('JSON 格式无效');
      return;
    }

    if (!config.env || typeof config.env !== 'object') {
      setError('config.env 必须是对象');
      return;
    }

    if (!config.env.ANTHROPIC_AUTH_TOKEN) {
      setError('ANTHROPIC_AUTH_TOKEN 不能为空');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/claude-config', { config });
      setHasConfig(true);
      setSuccess('配置保存成功');
    } catch (err: any) {
      setError(err.message || '保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfigText(JSON.stringify(DEFAULT_CONFIG, null, 2));
    setError(null);
    setSuccess(null);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authLoading || !user) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
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
          <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>设置</h1>
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

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'organization' && <OrganizationTabContent currentUserId={user.id} />}

        {activeTab === 'claude-code' && (
          <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                maxWidth: '800px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', margin: '0 0 8px 0' }}>
                  配置信息
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                  此配置将用于所有项目的 Claude Code 环境。
                  {hasConfig ? ' 您已保存自定义配置。' : ' 您尚未配置，使用默认模板。'}
                </p>
              </div>

              {error && (
                <div
                  style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    color: 'var(--status-error)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    fontSize: '14px',
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    color: 'var(--status-success)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    fontSize: '14px',
                  }}
                >
                  {success}
                </div>
              )}

              {isLoading ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
                  加载中...
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        display: 'block',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        marginBottom: '8px',
                      }}
                    >
                      JSON 配置
                    </label>
                    <textarea
                      value={configText}
                      onChange={(e) => {
                        setConfigText(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      style={{
                        width: '100%',
                        height: '400px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                      spellCheck={false}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="btn btn-primary"
                    >
                      {isSaving ? '保存中...' : '保存配置'}
                    </button>
                    <button onClick={handleReset} disabled={isSaving} className="btn btn-secondary">
                      重置为默认
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交代码**

```bash
git -C /root/my/code-link add packages/web/src/app/settings/page.tsx
git -C /root/my/code-link commit -m "$(cat <<'EOF'
refactor: restructure settings page with vertical tabs

Refactor settings page to use left-side vertical tabs for organization and Claude Code configuration.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 更新侧边栏导航

**Files:**
- Modify: `packages/web/src/components/sidebar/index.tsx`

- [ ] **Step 1: 修改侧边栏"我的组织"按钮导航**

找到"我的组织"按钮，修改 `onClick` 从 `router.push('/organizations')` 改为 `router.push('/settings')`。

在 `packages/web/src/components/sidebar/index.tsx` 中找到约第 151-170 行的"我的组织"按钮部分：

```tsx
{/* 导航入口 */}
<div style={{ marginBottom: '12px' }}>
  <button
    onClick={() => router.push('/settings')}
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
    <span>组织设置</span>
    <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>→</span>
  </button>
```

- [ ] **Step 2: 提交代码**

```bash
git -C /root/my/code-link add packages/web/src/components/sidebar/index.tsx
git -C /root/my/code-link commit -m "$(cat <<'EOF'
refactor(sidebar): update organization button to navigate to settings

Change '我的组织' button to navigate to /settings instead of /organizations.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 删除废弃的组织页面

**Files:**
- Delete: `packages/web/src/app/organizations/page.tsx`
- Delete: `packages/web/src/app/organizations/[id]/page.tsx`

- [ ] **Step 1: 删除组织列表页面**

```bash
rm -rf packages/web/src/app/organizations
```

- [ ] **Step 2: 提交代码**

```bash
git -C /root/my/code-link add -A
git -C /root/my/code-link commit -m "$(cat <<'EOF'
refactor: remove deprecated organization pages

Remove /organizations and /organizations/[id] pages as functionality moved to settings page.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 修复 OrganizationDetailPanel 中的状态管理问题

**Files:**
- Modify: `packages/web/src/components/settings/organization-detail-panel.tsx`

- [ ] **Step 1: 修复 useState 误用问题**

在 `OrganizationDetailPanel` 中，`useState` 被错误用于副作用。需要使用 `useEffect` 替代：

找到这段代码：
```tsx
// 当 organization 变化时，重置状态并加载邀请
useState(() => {
  if (organization) {
    setOrgName(organization.name);
    setIsEditingName(false);
    setError(null);
    loadInvitations();
  }
});
```

替换为：
```tsx
// 当 organization 变化时，重置状态并加载邀请
useEffect(() => {
  if (organization) {
    setOrgName(organization.name);
    setIsEditingName(false);
    setError(null);
    loadInvitations();
  }
}, [organization?.id]);
```

并确保在文件顶部添加 `useEffect` 导入：
```tsx
import { useState, useEffect } from 'react';
```

- [ ] **Step 2: 提交代码**

```bash
git -C /root/my/code-link add packages/web/src/components/settings/organization-detail-panel.tsx
git -C /root/my/code-link commit -m "$(cat <<'EOF'
fix: correct state management in OrganizationDetailPanel

Replace incorrect useState usage with useEffect for side effects when organization changes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 手动测试验证

**Files:**
- None (测试任务)

- [ ] **Step 1: 启动开发服务器**

```bash
cd /root/my/code-link && npm run dev
```

- [ ] **Step 2: 测试设置页面 Tab 切换**

1. 登录后点击侧边栏底部的设置按钮（⚙️）
2. 验证页面显示左侧垂直 Tab（组织 / Claude Code）
3. 点击不同 Tab，验证内容区域正确切换

- [ ] **Step 3: 测试组织 Tab 功能**

1. 在组织 Tab 中验证组织列表显示正确
2. 点击"创建组织"按钮，验证弹窗显示，创建新组织
3. 点击组织项，验证右侧详情面板显示
4. 测试编辑组织名称功能（Owner）
5. 测试邀请成员功能（Owner）
6. 测试待处理邀请列表显示（Owner）
7. 测试成员列表显示
8. 测试修改成员角色（Owner）
9. 测试移除成员（Owner）
10. 测试退出组织（非 Owner）

- [ ] **Step 4: 测试 Claude Code Tab 功能**

1. 切换到 Claude Code Tab
2. 验证配置编辑器显示正确
3. 测试保存配置功能
4. 测试重置为默认功能

- [ ] **Step 5: 测试侧边栏导航**

1. 点击侧边栏"组织设置"按钮
2. 验证跳转到 `/settings` 并显示组织 Tab

---

## 自检清单

**1. Spec 覆盖检查：**
- [x] 左侧垂直 Tab 导航（组织 / Claude Code）→ Task 1, 4
- [x] 组织列表显示（名称、角色、创建时间）→ Task 3
- [x] 创建组织功能 → Task 3
- [x] 组织详情面板 → Task 2
- [x] 编辑组织名称（Owner）→ Task 2
- [x] 邀请成员按钮在上方 → Task 2
- [x] 待处理邀请在成员列表上方 → Task 2
- [x] 成员列表 → Task 2
- [x] 移除成员（Owner）→ Task 2 (复用 OrganizationMemberList)
- [x] 退出组织（非 Owner）→ Task 2
- [x] 更新侧边栏导航 → Task 5
- [x] 删除废弃页面 → Task 6

**2. Placeholder 扫描：**
- 无 TBD、TODO 等占位符
- 所有代码步骤都有完整实现

**3. 类型一致性：**
- `SettingsTab` 类型在 Task 1 定义，Task 4 使用一致
- `OrganizationDetail` 类型来自现有 api.ts
- 组件 props 类型定义完整
