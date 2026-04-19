'use client';

import { useState, useEffect } from 'react';
import { api, ApiError, Organization, OrgRole } from '@/lib/api';
import { useOrganization } from '@/lib/organization-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>创建新项目</DialogTitle>
        </DialogHeader>

        {/* 无权限提示 */}
        {!loadingOrgs && organizations.length === 0 ? (
          <div className="py-5 text-center">
            <p className="text-secondary mb-3">您没有权限创建项目</p>
            <p className="text-xs text-muted-foreground">请联系组织管理员邀请您加入组织，或创建一个新组织</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* 组织选择 */}
            <div className="mb-4 space-y-2">
              <Label>
                所属组织 <span className="text-destructive">*</span>
              </Label>
              {loadingOrgs ? (
                <div className="text-muted-foreground p-2">加载中...</div>
              ) : (
                <Select
                  value={selectedOrgId?.toString() || ''}
                  onValueChange={(value) => setSelectedOrgId(parseInt(value, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择组织" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id.toString()}>
                        {org.name} ({org.role === 'owner' ? 'Owner' : 'Developer'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 项目名称 */}
            <div className="mb-4 space-y-2">
              <Label htmlFor="project-name">
                项目名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入项目名称"
                required
              />
            </div>

            {/* 模板类型 */}
            <div className="mb-4 space-y-2">
              <Label>
                模板类型 <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={templateType}
                onValueChange={(value) => setTemplateType(value as TemplateType)}
                className="flex flex-col gap-2"
              >
                {TEMPLATE_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-center space-x-3 rounded-md border p-3 cursor-pointer transition-colors ${
                      templateType === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setTemplateType(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`template-${option.value}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 mb-4 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '创建中...' : '创建项目'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
