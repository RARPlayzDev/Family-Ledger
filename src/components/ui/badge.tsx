import type { HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-raised text-content-muted',
        accent: 'border-accent/30 bg-accent-soft text-accent',
        warn: 'border-warn/30 bg-warn-soft text-warn',
        danger: 'border-danger/30 bg-danger-soft text-danger',
        outline: 'border-line text-content-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & { children?: ReactNode };

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
