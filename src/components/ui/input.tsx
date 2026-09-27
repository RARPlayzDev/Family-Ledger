import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

/**
 * Dark, touch-friendly input.
 * 44px tall and 16px text on phones so it is comfortable to tap (and so iOS does
 * not zoom the page when the field takes focus).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid = false, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex min-touch w-full rounded-md border bg-surface-sunken px-3 py-2 text-base text-content sm:text-sm',
        'placeholder:text-content-subtle',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-danger' : 'border-line',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
