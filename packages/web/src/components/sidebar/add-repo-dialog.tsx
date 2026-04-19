'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>添加仓库</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 mb-4 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="mb-4 space-y-2">
            <Label htmlFor="repo-url">仓库 URL</Label>
            <Input
              id="repo-url"
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://github.com/owner/repo"
              required
            />
          </div>

          {preview && (
            <div className="p-3 bg-muted rounded-md mb-4">
              <div className="text-muted-foreground text-[11px] mb-1">识别为</div>
              <div className="text-foreground text-[13px]">
                {preview.provider} / {preview.repoName}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting || !preview}>
              {isSubmitting ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
