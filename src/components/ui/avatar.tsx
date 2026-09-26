import { cn } from '@/lib/utils';

const TONES = [
  'bg-[rgba(154,230,180,0.16)] text-accent',
  'bg-[rgba(138,180,248,0.16)] text-[#8AB4F8]',
  'bg-[rgba(242,200,121,0.16)] text-[#F2C879]',
  'bg-[rgba(167,156,245,0.16)] text-[#A79CF5]',
  'bg-[rgba(240,155,180,0.16)] text-[#F09BB4]',
  'bg-[rgba(127,216,208,0.16)] text-[#7FD8D0]',
];

function toneFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return TONES[hash % TONES.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Deterministic avatar.
 * Uses the uploaded image when present, otherwise a colour derived from the name
 * so the same member always gets the same tone (no layout-dependent colours).
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass = {
    sm: 'size-7 text-2xs',
    md: 'size-9 text-xs',
    lg: 'size-12 text-sm',
  }[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={cn('shrink-0 rounded-full border border-line object-cover', sizeClass, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizeClass,
        toneFor(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
