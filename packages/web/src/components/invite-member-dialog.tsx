'use client';

import { useState } from 'react';
import { api, ApiError, OrgRole, OrganizationInvitation } from '@/lib/api';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 mb-4 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="mb-4 space-y-2">
            <Label htmlFor="invite-email">
              邮箱地址 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入被邀请人的邮箱"
              required
            />
          </div>

          <div className="mb-4 space-y-2">
            <Label>
              角色 <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={role}
              onValueChange={(value) => setRole(value as OrgRole)}
              className="flex flex-col gap-2"
            >
              {ROLE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'flex items-center space-x-3 rounded-md border p-2.5 cursor-pointer transition-colors',
                    role === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => setRole(option.value)}
                >
                  <RadioGroupItem value={option.value} id={`role-${option.value}`} />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{option.label}</div>
                    <div className="text-[11px] text-muted-foreground">{option.description}</div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? '邀请中...' : '发送邀请'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
