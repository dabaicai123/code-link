'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAddRepo } from '@/lib/queries';
import { addRepoSchema, type AddRepoInput } from '@/lib/validations/repo';
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
import { toast } from 'sonner';

interface AddRepoDialogProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function parseUrl(input: string) {
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
}

export function AddRepoDialog({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: AddRepoDialogProps) {
  const addRepo = useAddRepo();

  const form = useForm<AddRepoInput>({
    resolver: zodResolver(addRepoSchema),
    defaultValues: {
      url: '',
    },
  });

  const url = form.watch('url');
  const preview = useMemo(() => {
    if (url?.trim()) {
      return parseUrl(url.trim());
    }
    return null;
  }, [url]);

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = async (values: AddRepoInput) => {
    try {
      await addRepo.mutateAsync({
        projectId,
        url: values.url.trim(),
      });
      toast.success('仓库添加成功');
      onSuccess?.();
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加仓库失败');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>添加仓库</DialogTitle>
        </DialogHeader>

        <Form form={form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    仓库 URL <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://github.com/user/repo.git"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {preview && (
              <div className="p-3 bg-muted rounded-md">
                <div className="text-muted-foreground text-xs mb-1">识别为</div>
                <div className="text-sm">
                  {preview.provider} / {preview.repoName}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              支持 GitHub 和 GitLab 仓库 URL
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? '添加中...' : '添加仓库'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
