'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Terminal, FolderKanban, Layers } from 'lucide-react';
import { useLogin, useRegister } from '@/lib/queries';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/validations';
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

interface AuthFormProps {
  mode: 'login' | 'register';
}

const FEATURES = [
  { Icon: Terminal, label: '一键启动开发容器' },
  { Icon: FolderKanban, label: '多项目并行管理' },
  { Icon: Layers, label: 'AI 驱动的协作工具' },
];

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
        await registerMutation.mutateAsync(values as RegisterInput);
      }
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div className="h-screen flex">
      {/* Left — Brand panel */}
      <div className="hidden md:flex w-1/2 bg-bg-secondary border-r border-border-default flex-col items-center justify-center px-16">
        <div className="max-w-lg w-full">
          <div className="w-20 h-20 bg-accent-primary text-white rounded-2xl flex items-center justify-center text-3xl font-bold shadow-warm mb-10">C</div>
          <h1 className="text-4xl font-bold text-text-primary mb-4 leading-tight">Code Link</h1>
          <p className="text-lg text-text-secondary leading-relaxed mb-12">
            开发环境管理平台<br />连接代码与容器，让开发更简单
          </p>
          <div className="space-y-5">
            {FEATURES.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-accent-light flex items-center justify-center">
                  <Icon className="w-5 h-5 text-accent-primary" />
                </div>
                <span className="text-base text-text-secondary">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 bg-bg-primary flex items-center justify-center px-8 md:px-20">
        <div className="w-full max-w-[480px]">
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-accent-primary text-white rounded-xl flex items-center justify-center font-bold">C</div>
            <span className="font-bold text-text-primary text-lg">Code Link</span>
          </div>

          <h2 className="text-3xl font-bold text-text-primary mb-3">
            {mode === 'login' ? '欢迎回来' : '创建账户'}
          </h2>
          <p className="text-base text-text-muted mb-10">
            {mode === 'login' ? '登录以继续使用 Code Link' : '注册以开始使用 Code Link'}
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel className="text-base font-medium text-text-secondary mb-2 block">邮箱地址</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com" className="h-control-lg text-base" {...field} />
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
                    <FormItem className="mb-5">
                      <FormLabel className="text-base font-medium text-text-secondary mb-2 block">用户名</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="输入用户名" className="h-control-lg text-base" {...field} />
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
                  <FormItem className="mb-8">
                    <FormLabel className="text-base font-medium text-text-secondary mb-2 block">密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="输入密码" className="h-control-lg text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="w-full text-base font-medium">
                {form.formState.isSubmitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-text-muted text-base text-center">
            {mode === 'login' ? (
              <>
                没有账户？{' '}
                <Link href="/register" className="text-accent-primary font-medium hover:underline">注册</Link>
              </>
            ) : (
              <>
                已有账户？{' '}
                <Link href="/login" className="text-accent-primary font-medium hover:underline">登录</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}