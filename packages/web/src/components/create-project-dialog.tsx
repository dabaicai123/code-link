'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const project = await api.post<Project>('/projects', {
        name: name.trim(),
        template_type: templateType,
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
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

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
