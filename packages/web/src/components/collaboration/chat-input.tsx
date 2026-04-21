'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DraftMessage, MessageType } from '@/types/draft';
import type { Skill } from '@/types/skill';
import { api } from '@/lib/api';
import { ChatCommandMenu } from './chat-command-menu';
import { ChatImageUpload, type ImagePreview } from './chat-image-upload';
import { ChatReplyPreview } from './chat-reply-preview';
import { ChatInputToolbar } from './chat-input-toolbar';

const messageSchema = z.object({
  content: z.string().max(10000, '消息过长'),
});
type MessageInput = z.infer<typeof messageSchema>;

interface SystemCommand {
  cmd: string;
  desc: string;
}

interface ChatInputCommand {
  cmd: string;
  desc: string;
  isSkill: boolean;
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
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const form = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: '' },
  });
  const content = form.watch('content');

  const systemCommands: SystemCommand[] = useMemo(() => [
    { cmd: '/clear', desc: '清除当前会话' },
    { cmd: '/help', desc: '显示帮助信息' },
    { cmd: '/model', desc: '查看/切换模型' },
    { cmd: '/mode', desc: '查看/切换权限模式' },
  ], []);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const result = await api.getSkills();
      setSkills(result.skills || []);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setSkillsError('加载 skills 失败');
      setSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const allCommands = useMemo(() => {
    const skillCommands = skills.map(skill => ({ cmd: `/${skill.name}`, desc: skill.description, isSkill: true }));
    const systemCmds = systemCommands.map(cmd => ({ ...cmd, isSkill: false }));
    return [...skillCommands, ...systemCmds];
  }, [skills, systemCommands]);

  const filteredCommands = useMemo(() => {
    if (!commandFilter) return allCommands;
    const filter = commandFilter.toLowerCase();
    return allCommands.filter(cmd => cmd.cmd.toLowerCase().includes(filter) || cmd.desc.toLowerCase().includes(filter));
  }, [allCommands, commandFilter]);

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

  const selectCommand = useCallback((cmd: ChatInputCommand) => {
    form.setValue('content', cmd.cmd + ' ');
    setShowCommands(false);
    textareaRef.current?.focus();
  }, [form]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => prev < filteredCommands.length - 1 ? prev + 1 : 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredCommands.length - 1); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); selectCommand(filteredCommands[selectedIndex]); return; }
      if (e.key === 'Escape') { setShowCommands(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !showCommands) {
      e.preventDefault();
      form.handleSubmit(handleSubmit)();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPreviews: ImagePreview[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        newPreviews.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) });
      }
    }
    setImagePreviews(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newPreviews: ImagePreview[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) newPreviews.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) });
      }
    }
    if (newPreviews.length > 0) { e.preventDefault(); setImagePreviews(prev => [...prev, ...newPreviews]); }
  };

  const removeImage = (id: string) => {
    setImagePreviews(prev => {
      const img = prev.find(p => p.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter(p => p.id !== id);
    });
  };

  const handleSubmit = async (values: MessageInput) => {
    const text = values.content.trim();
    if (!text && imagePreviews.length === 0) return;
    if (text.startsWith('/')) {
      const cmdName = text.split(' ')[0].slice(1);
      const matchedSkill = skills.find(s => s.name === cmdName);
      if (matchedSkill) { onCommand?.(text); form.reset(); return; }
    }
    setIsUploading(true);
    try {
      await onSend(text, imagePreviews.length > 0 ? 'image' : messageType, replyTo?.id, imagePreviews.map(p => p.file));
      form.reset();
      setImagePreviews([]);
      setMessageType('text');
      onCancelReply?.();
    } catch (err) { console.error('Failed to send message:', err); } finally { setIsUploading(false); }
  };

  useEffect(() => { return () => { imagePreviews.forEach(p => URL.revokeObjectURL(p.url)); }; }, []);

  const isSubmitting = form.formState.isSubmitting || isUploading;

  return (
    <div className="bg-bg-secondary border-t border-border-default px-4 pb-[max(14px,env(safe-area-inset-bottom,14px))] pt-2.5">
      <ChatReplyPreview replyTo={replyTo ?? null} onCancel={onCancelReply ?? (() => {})} />
      <ChatImageUpload previews={imagePreviews} onRemove={removeImage} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="relative">
          <ChatCommandMenu
            show={showCommands}
            commands={filteredCommands}
            selectedIndex={selectedIndex}
            onSelect={selectCommand}
            skillsLoading={skillsLoading}
            skillsError={skillsError}
            onRetry={loadSkills}
          />

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
                        className={cn(
                          'w-full min-h-[44px] max-h-[120px] p-3 text-sm border border-border rounded-xl bg-background text-foreground resize-none outline-none focus:ring-2 focus:ring-primary/50 transition-shadow',
                          messageType === 'code' && 'font-mono'
                        )}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {messageType !== 'text' && (
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground">代码</span>
                </div>
              )}
            </div>
            <Button type="submit" size="sm" disabled={(!content?.trim() && imagePreviews.length === 0) || isSubmitting} className="h-11 px-4 rounded-xl">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </Form>

      <ChatInputToolbar
        messageType={messageType}
        onToggleCodeMode={() => setMessageType(prev => prev === 'code' ? 'text' : 'code')}
        onOpenSlashCommand={() => { form.setValue('content', '/'); textareaRef.current?.focus(); }}
        fileInputRef={fileInputRef}
        onImageSelect={handleImageSelect}
      />
    </div>
  );
}