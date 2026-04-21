'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { ImageIcon, Code, Sparkles, Send, X, Zap, Loader2 } from 'lucide-react';
import type { DraftMessage, MessageType } from '../../types/draft';
import type { Skill } from '../../types/skill';
import { api } from '@/lib/api';

const messageSchema = z.object({
  content: z.string().max(10000, '消息过长'),
});

type MessageInput = z.infer<typeof messageSchema>;

// 内置系统命令
interface SystemCommand {
  cmd: string;
  desc: string;
  action?: () => void;
}

// 图片预览类型
interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

interface ChatInputProps {
  draftId: number;
  replyTo?: DraftMessage | null;
  onSend: (content: string, messageType: MessageType, parentId?: number, attachments?: File[]) => Promise<void>;
  onCancelReply?: () => void;
  onCommand?: (command: string) => void;
}

export function ChatInput({ draftId, replyTo, onSend, onCancelReply, onCommand }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 动态 skills 状态
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const form = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: '' },
  });

  const content = form.watch('content');

  // 内置系统命令
  const systemCommands: SystemCommand[] = useMemo(() => [
    { cmd: '/clear', desc: '清除当前会话' },
    { cmd: '/help', desc: '显示帮助信息' },
    { cmd: '/model', desc: '查看/切换模型' },
    { cmd: '/mode', desc: '查看/切换权限模式' },
  ], []);

  // 加载 skills
  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      // 从后端 API 获取可用 skills
      const result = await api.getSkills();
      setSkills(result.skills || []);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setSkillsError('加载 skills 失败');
      // 降级：使用空数组
      setSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  // 组件挂载时加载 skills
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // 合并命令列表：skills + 系统命令
  const allCommands = useMemo(() => {
    const skillCommands = skills.map(skill => ({
      cmd: `/${skill.name}`,
      desc: skill.description,
      isSkill: true,
    }));
    const systemCmds = systemCommands.map(cmd => ({
      ...cmd,
      isSkill: false,
    }));
    return [...skillCommands, ...systemCmds];
  }, [skills, systemCommands]);

  // 过滤命令列表
  const filteredCommands = useMemo(() => {
    if (!commandFilter) return allCommands;
    const filter = commandFilter.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.cmd.toLowerCase().includes(filter) ||
      cmd.desc.toLowerCase().includes(filter)
    );
  }, [allCommands, commandFilter]);

  // 检测斜杠命令
  useEffect(() => {
    if (content.startsWith('/')) {
      setShowCommands(true);
      setCommandFilter(content.slice(1));
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
      setCommandFilter('');
    }
  }, [content]);

  // 选择命令
  const selectCommand = useCallback((cmd: typeof allCommands[0]) => {
    form.setValue('content', cmd.cmd + ' ');
    setShowCommands(false);
    textareaRef.current?.focus();
  }, [form]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 斜杠命令菜单导航
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        selectCommand(filteredCommands[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    // 发送消息
    if (e.key === 'Enter' && !e.shiftKey && !showCommands) {
      e.preventDefault();
      form.handleSubmit(handleSubmit)();
    }
  };

  // 图片上传处理
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPreviews: ImagePreview[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        newPreviews.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          url: URL.createObjectURL(file),
        });
      }
    }

    setImagePreviews(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 粘贴图片
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newPreviews: ImagePreview[] = [];

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          newPreviews.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            url: URL.createObjectURL(file),
          });
        }
      }
    }

    if (newPreviews.length > 0) {
      e.preventDefault();
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  // 移除图片
  const removeImage = (id: string) => {
    setImagePreviews(prev => {
      const img = prev.find(p => p.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter(p => p.id !== id);
    });
  };

  // 提交表单
  const handleSubmit = async (values: MessageInput) => {
    const text = values.content.trim();
    if (!text && imagePreviews.length === 0) return;

    // 检查是否是斜杠命令
    if (text.startsWith('/')) {
      const cmdName = text.split(' ')[0].slice(1);
      const matchedSkill = skills.find(s => s.name === cmdName);
      if (matchedSkill) {
        // 调用 skill 处理
        onCommand?.(text);
        form.reset();
        return;
      }
    }

    setIsUploading(true);
    try {
      const attachments = imagePreviews.map(p => p.file);
      await onSend(
        text,
        imagePreviews.length > 0 ? 'image' : messageType,
        replyTo?.id,
        attachments
      );
      form.reset();
      setImagePreviews([]);
      setMessageType('text');
      onCancelReply?.();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // 切换代码模式
  const toggleCodeMode = () => {
    setMessageType(prev => prev === 'code' ? 'text' : 'code');
  };

  // 清理图片 URL
  useEffect(() => {
    return () => {
      imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, []);

  const isSubmitting = form.formState.isSubmitting || isUploading;

  return (
    <div className="bg-bg-secondary border-t border-border-default px-4 pb-[max(14px,env(safe-area-inset-bottom,14px))] pt-2.5">
      {/* 回复提示 */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-1.5 bg-background rounded-md">
          <span className="text-xs text-muted-foreground">
            回复 {replyTo.userName}:
          </span>
          <span className="text-xs text-foreground flex-1 truncate">
            {replyTo.content.slice(0, 50)}{replyTo.content.length > 50 ? '...' : ''}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="px-1.5 py-0.5 text-[10px] rounded bg-bg-hover text-text-muted hover:text-text-primary"
          >
            取消
          </button>
        </div>
      )}

      {/* 图片预览 */}
      {imagePreviews.length > 0 && (
        <div className="flex flex-wrap gap-2 max-w-[800px] mx-auto mb-2.5">
          {imagePreviews.map(preview => (
            <div key={preview.id} className="inline-flex items-center gap-2 max-w-full px-2.5 py-1.5 border border-accent-primary/20 rounded-xl bg-bg-card text-text-primary text-xs relative group">
              <img
                src={preview.url}
                alt="预览"
                className="w-16 h-16 object-cover rounded border border-border"
              />
              <button
                type="button"
                onClick={() => removeImage(preview.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="relative">
          {/* 斜杠命令菜单 - cc-web 风格 */}
          {showCommands && (
            <div className="absolute bottom-full left-0 mb-2 min-w-[280px] max-w-[360px] bg-bg-card border border-border-default rounded-xl shadow-warm overflow-auto z-50">
              {/* 加载中状态 */}
              {skillsLoading && (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  加载命令列表...
                </div>
              )}

              {/* 错误状态 */}
              {skillsError && !skillsLoading && (
                <div className="p-2 text-xs text-destructive">
                  {skillsError}
                  <button
                    type="button"
                    onClick={loadSkills}
                    className="ml-2 underline hover:no-underline"
                  >
                    重试
                  </button>
                </div>
              )}

              {/* 命令列表 */}
              {!skillsLoading && filteredCommands.length > 0 && (
                <div className="p-1.5 max-h-[280px] overflow-auto">
                  {/* Skills 分组 */}
                  {filteredCommands.some(c => c.isSkill) && (
                    <div className="mb-1">
                      <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">
                        <Zap className="w-3 h-3 inline mr-1" />
                        Skills
                      </div>
                      {filteredCommands.filter(c => c.isSkill).map((cmd, idx) => {
                        const globalIdx = filteredCommands.indexOf(cmd);
                        return (
                          <button
                            key={cmd.cmd}
                            type="button"
                            onClick={() => selectCommand(cmd)}
                            className={cn(
                              'flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors w-full',
                              globalIdx === selectedIndex
                                ? 'bg-accent-primary text-text-primary'
                                : 'hover:bg-bg-hover'
                            )}
                          >
                            <span className="font-semibold text-sm text-accent-primary whitespace-nowrap">
                              {cmd.cmd}
                            </span>
                            <span className="text-[13px] text-text-secondary flex-1 overflow-hidden text-ellipsis">
                              {cmd.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 系统命令分组 */}
                  {filteredCommands.some(c => !c.isSkill) && (
                    <div>
                      <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">
                        系统命令
                      </div>
                      {filteredCommands.filter(c => !c.isSkill).map((cmd) => {
                        const globalIdx = filteredCommands.indexOf(cmd);
                        return (
                          <button
                            key={cmd.cmd}
                            type="button"
                            onClick={() => selectCommand(cmd)}
                            className={cn(
                              'flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors w-full',
                              globalIdx === selectedIndex
                                ? 'bg-accent-primary text-text-primary'
                                : 'hover:bg-bg-hover'
                            )}
                          >
                            <span className="font-semibold text-sm text-accent-primary whitespace-nowrap">
                              {cmd.cmd}
                            </span>
                            <span className="text-[13px] text-text-secondary flex-1 overflow-hidden text-ellipsis">
                              {cmd.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 无匹配结果 */}
              {!skillsLoading && filteredCommands.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  没有匹配的命令
                </div>
              )}

              {/* 键盘提示 */}
              <div className="px-3 py-2 border-t border-border-default text-[10px] text-text-muted flex gap-3">
                <span>↑↓ 选择</span>
                <span>Tab/Enter 确认</span>
                <span>Esc 关闭</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 items-end max-w-[800px] mx-auto">
            <div className="flex-1 relative">
              <FormField
                name="content"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <textarea
                        {...field}
                        ref={textareaRef}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        rows={1}
                        placeholder={
                          messageType === 'code' ? '输入代码...' :
                          imagePreviews.length > 0 ? '添加描述（可选）...' :
                          '输入消息，/ 打开命令菜单...'
                        }
                        className="w-full min-h-[44px] max-h-[120px] p-3 text-sm border border-border rounded-xl bg-background text-foreground resize-none outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                        style={{
                          fontFamily: messageType === 'code' ? 'monospace' : 'inherit',
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 类型指示器 */}
              {messageType !== 'text' && (
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground">
                    代码
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={(!content?.trim() && imagePreviews.length === 0) || isSubmitting}
              className="h-11 px-4 rounded-xl"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* 工具栏 */}
      <div className="flex gap-1 mt-2 px-1">
        {/* 图片上传 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-11 h-11 rounded-xl border border-border-default text-text-secondary cursor-pointer transition-all flex items-center justify-center hover:bg-bg-hover hover:text-text-primary hover:border-border-light"
          title="上传图片 (支持粘贴)"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />

        {/* 代码模式 */}
        <button
          type="button"
          onClick={toggleCodeMode}
          className={cn(
            'p-2 rounded-lg transition-colors',
            messageType === 'code'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
          title="代码模式"
        >
          <Code className="w-4 h-4" />
        </button>

        {/* 斜杠命令提示 */}
        <button
          type="button"
          onClick={() => {
            form.setValue('content', '/');
            textareaRef.current?.focus();
          }}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="斜杠命令"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
