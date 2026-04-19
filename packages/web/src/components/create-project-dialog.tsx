'use client';

import { useState, useEffect } from 'react';
import { api, ApiError, Organization, OrgRole } from '@/lib/api';
import { useOrganization } from '@/lib/organization-context';

type TemplateType = 'node' | 'node+java' | 'node+python';

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; description: string }[] = [
  { value: 'node', label: 'Node.js', description: '纯 Node.js 运行环境' },
  { value: 'node+java', label: 'Node.js + Java', description: 'Node.js 与 Java 混合环境' },
  { value: 'node+python', label: 'Node.js + Python', description: 'Node.js 与 Python 混合环境' },
];

interface Project {
  id: number;
  name: string;
  templateType: TemplateType;
  organizationId: number;
  containerId: string | null;
  status: 'created' | 'running' | 'stopped';
  createdBy: number;
  createdAt: string;
}

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

export function CreateProjectDialog({ isOpen, onClose, onSuccess }: CreateProjectDialogProps) {
  const { currentOrganization, organizations: allOrganizations } = useOrganization();
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('node');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 使用 context 中的组织列表，过滤出有权限创建项目的组织
      const creatableOrgs = allOrganizations.filter(
        (org) => org.role === 'owner' || org.role === 'developer'
      );
      setOrganizations(creatableOrgs);
      // 默认选择当前组织（如果有权限）
      if (currentOrganization && creatableOrgs.some(o => o.id === currentOrganization.id)) {
        setSelectedOrgId(currentOrganization.id);
      } else if (creatableOrgs.length > 0) {
        setSelectedOrgId(creatableOrgs[0].id);
      }
    }
  }, [isOpen, allOrganizations, currentOrganization]);

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
        templateType: templateType,
        organizationId: selectedOrgId,
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
                    border: `1px solid ${templateType === option.value ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: templateType === option.value ? 'rgba(217, 119, 87, 0.08)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="template-type"
                    value={option.value}
                    checked={templateType === option.value}
                    onChange={() => setTemplateType(option.value)}
                    style={{ marginRight: '12px', accentColor: 'var(--accent-primary)' }}
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