'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  text?: string;
  className?: string;
}

export function Loading({ text = '加载中...', className }: LoadingProps) {
  return (
    <div
      className={cn(
        'flex h-full items-center justify-center bg-background',
        className
      )}
    >
      <div className="text-center">
        <div className="text-sm text-foreground mb-2">{text}</div>
        <div className="text-xs text-muted-foreground">请稍候</div>
      </div>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-muted border-t-primary',
        sizeClasses[size],
        className
      )}
    />
  );
}