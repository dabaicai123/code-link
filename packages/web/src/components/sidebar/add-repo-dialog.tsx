'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface AddRepoDialogProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRepoDialog({ projectId, isOpen, onClose, onSuccess }: AddRepoDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ provider: string; repoName: string } | null>(null);

  const parseUrl = (input: string) => {
    try {
      const urlObj = new URL(input);
      let provider = '';
      if (urlObj.hostname === 'github.com') {
        provider = 'GitHub';
      } else if (urlObj.hostname.includes('gitlab')) {
        provider = 'GitLab';
      } else {
        return null;
      }

      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) return null;

      const repoName = pathParts[1].replace('.git', '');
      return { provider, repoName };
    } catch {
      return null;
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setError(null);

    if (value.trim()) {
      const parsed = parseUrl(value.trim());
      setPreview(parsed);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.addRepo(projectId, url.trim());
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '添加仓库失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setError(null);
    setPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} onClick={handleClose} />

      <div style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '400px', maxWidth: '90vw', padding: '24px', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>添加仓库</h2>
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
              仓库 URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="input"
              placeholder="https://github.com/owner/repo"
              required
            />
          </div>

          {preview && (
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px' }}>识别为</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                {preview.provider} / {preview.repoName}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={handleClose} className="btn btn-secondary">取消</button>
            <button type="submit" disabled={isSubmitting || !preview} className="btn btn-primary">
              {isSubmitting ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}