'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInviteMember } from '@/lib/queries';
import {
  inviteMemberSchema,
  type InviteMemberInput,
} from '@/lib/validations/invitation';
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
import { toast } from 'sonner';
import type { OrganizationInvitation } from '@/lib/api';

const ROLE_OPTIONS = [
  { value: 'member', label: '成员', description: '可以查看项目和聊天记录' },
  { value: 'developer', label: '开发者', description: '可以创建项目、添加仓库、执行构建' },
  { value: 'owner', label: '管理员', description: '可以管理组织、邀请成员、创建和删除项目' },
] as const;

interface InviteMemberDialogProps {
  organizationId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invitation: OrganizationInvitation) => void;
}

export function InviteMemberDialog({
  organizationId,
  isOpen,
  onClose,
  onSuccess,
}: InviteMemberDialogProps) {
  const inviteMember = useInviteMember();

  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = async (values: InviteMemberInput) => {
    try {
      const invitation = await inviteMember.mutateAsync({
        orgId: organizationId,
        email: values.email.trim().toLowerCase(),
        role: values.role,
      });
      toast.success('邀请已发送');
      onSuccess(invitation);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发送邀请失败');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    邮箱地址 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="输入成员邮箱"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    角色 <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? '发送中...' : '发送邀请'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
