'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLogin, useRegister } from '@/lib/queries';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const form = useForm<LoginInput | RegisterInput>({
    resolver: zodResolver(mode === 'login' ? loginSchema : registerSchema),
    defaultValues: {
      email: '',
      password: '',
      ...(mode === 'register' && { name: '' }),
    },
  });

  const onSubmit = async (values: LoginInput | RegisterInput) => {
    try {
      if (mode === 'login') {
        await loginMutation.mutateAsync(values);
      } else {
        const regValues = values as RegisterInput;
        await registerMutation.mutateAsync(regValues);
      }
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-80 text-center">
        <div className="text-sm font-medium text-primary mb-2">Code Link</div>
        <div className="text-muted-foreground mb-6 text-sm">开发环境管理平台</div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="text-left">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="mb-3">
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="邮箱地址"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'register' && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-3">
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="用户名"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="密码"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full py-3"
            >
              {form.formState.isSubmitting
                ? '处理中...'
                : mode === 'login'
                  ? '登录'
                  : '注册'}
            </Button>
          </form>
        </Form>

        <div className="mt-4 text-muted-foreground text-sm">
          {mode === 'login' ? (
            <>
              没有账户？{' '}
              <Link href="/register" className="text-primary">
                注册
              </Link>
            </>
          ) : (
            <>
              已有账户？{' '}
              <Link href="/login" className="text-primary">
                登录
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
