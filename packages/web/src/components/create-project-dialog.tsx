'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOrganizationStore } from '@/lib/stores';
import { useCreateProject, type Project } from '@/lib/queries/use-projects';
import {
  createProjectSchema,
  type CreateProjectInput,
} from '@/lib/validations/project';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

type TemplateType = 'node' | 'node+java' | 'node+python';

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; description: string }[] = [
  { value: 'node', label: 'Node.js', description: '纯 Node.js 运行环境' },
  { value: 'node+java', label: 'Node.js + Java', description: 'Node.js 与 Java 混合环境' },
  { value: 'node+python', label: 'Node.js + Python', description: 'Node.js 与 Python 混合环境' },
];

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

export function CreateProjectDialog({ isOpen, onClose, onSuccess }: CreateProjectDialogProps) {
  const organizations = useOrganizationStore((s) => s.organizations);
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const createProject = useCreateProject();

  // 过滤出有权限创建项目的组织
  const creatableOrgs = useMemo(
    () => organizations.filter((org) => org.role === 'owner' || org.role === 'developer'),
    [organizations]
  );

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      templateType: 'node',
      organizationId: 0,
    },
  });

  // 重置表单并设置默认组织
  useEffect(() => {
    if (isOpen) {
      // 确定默认选中的组织
      let defaultOrgId = 0;
      if (currentOrganization && creatableOrgs.some((o) => o.id === currentOrganization.id)) {
        defaultOrgId = currentOrganization.id;
      } else if (creatableOrgs.length > 0) {
        defaultOrgId = creatableOrgs[0].id;
      }

      form.reset({
        name: '',
        templateType: 'node',
        organizationId: defaultOrgId,
      });
    }
  }, [isOpen, creatableOrgs, currentOrganization, form]);

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = async (values: CreateProjectInput) => {
    try {
      const project = await createProject.mutateAsync(values);
      toast.success('项目创建成功');
      onSuccess(project);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建项目失败');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>创建新项目</DialogTitle>
        </DialogHeader>

        {/* 无权限提示 */}
        {creatableOrgs.length === 0 ? (
          <div className="py-5 text-center">
            <p className="text-secondary mb-3">您没有权限创建项目</p>
            <p className="text-xs text-muted-foreground">
              请联系组织管理员邀请您加入组织，或创建一个新组织
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {/* 组织选择 */}
              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>
                      所属组织 <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      value={field.value ? field.value.toString() : ''}
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择组织" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {creatableOrgs.map((org) => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name} ({org.role === 'owner' ? 'Owner' : 'Developer'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 项目名称 */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>
                      项目名称 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="输入项目名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 模板类型 */}
              <FormField
                control={form.control}
                name="templateType"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>
                      模板类型 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="flex flex-col gap-2"
                      >
                        {TEMPLATE_OPTIONS.map((option) => (
                          <div
                            key={option.value}
                            className={`flex items-center space-x-3 rounded-md border p-3 cursor-pointer transition-colors ${
                              field.value === option.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => field.onChange(option.value)}
                          >
                            <RadioGroupItem value={option.value} id={`template-${option.value}`} />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{option.label}</div>
                              <div className="text-xs text-muted-foreground">{option.description}</div>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  取消
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? '创建中...' : '创建项目'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
