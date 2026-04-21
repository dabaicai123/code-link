import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-accent-primary text-white hover:bg-accent-hover',
        secondary:
          'border-transparent bg-bg-secondary text-text-secondary hover:bg-bg-hover',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-text-primary border-border-default',
        status: 'border-transparent',
      },
      statusType: {
        running: 'bg-status-running/10 text-status-running border-status-running/20',
        stopped: 'bg-status-stopped/10 text-status-stopped border-status-stopped/20',
        warning: 'bg-status-warning/10 text-status-warning border-status-warning/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, statusType, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, statusType }), className)} {...props} />
  );
}

export { Badge, badgeVariants };