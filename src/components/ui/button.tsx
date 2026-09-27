import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink hover:bg-accent-strong active:bg-accent-strong',
        secondary:
          'border border-line bg-surface-raised text-content hover:border-line-strong hover:bg-surface',
        outline: 'border border-line bg-transparent text-content hover:bg-surface-raised',
        ghost: 'text-content-muted hover:bg-surface-raised hover:text-content',
        danger: 'bg-danger text-[#2A0B0B] hover:bg-[#F98A8A]',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        // Phones get 44px targets (the Android guideline); desktop keeps the
        // compact 32/40px bar heights it was designed around.
        sm: 'h-11 px-3 text-xs sm:h-8',
        md: 'h-11 px-4 sm:h-10',
        lg: 'min-touch h-11 px-5',
        icon: 'h-11 w-11 sm:h-10 sm:w-10',
        'icon-sm': 'h-11 w-11 sm:h-8 sm:w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element instead of a <button> (e.g. for links). */
    asChild?: boolean;
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const Component = asChild ? Slot : 'button';
    // Radix <Slot> requires exactly ONE element child, so the spinner must not
    // be a sibling of `children` when asChild is set (a `<Link>` must stay the
    // only child or Slot throws "failed to slot onto its children").
    return (
      <Component
        ref={ref}
        type={asChild ? undefined : type}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="size-4 animate-spin shrink-0" />}
            {children}
          </>
        )}
      </Component>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };

