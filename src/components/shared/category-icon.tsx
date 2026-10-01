import {
  Banknote,
  Beef,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Milk,
  Package,
  PawPrint,
  Phone,
  PiggyBank,
  Plane,
  ReceiptText,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Train,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Icon registry for categories.
 *
 * Categories store a lucide icon NAME in the database, so the UI must map names
 * to components explicitly: this keeps the bundle tree-shakeable (no dynamic
 * require of the whole icon set) and gives a safe fallback for unknown names.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Banknote,
  Beef,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Milk,
  Package,
  PawPrint,
  Phone,
  PiggyBank,
  Plane,
  ReceiptText,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Train,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
};

export const CATEGORY_ICON_NAMES: string[] = Object.keys(CATEGORY_ICONS);

export function categoryIconComponent(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  return CATEGORY_ICONS[name] ?? Tag;
}

/** Colour dot + icon chip used in lists, pickers and charts. */
export function CategoryIcon({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string | null | undefined;
  color?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const Icon = categoryIconComponent(name);
  const tone = color ?? '#6C737D';
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: `${tone}1F`, color: tone }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        size === 'sm' ? 'size-7 [&_svg]:size-3.5' : 'size-9 [&_svg]:size-4',
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/** A colour swatch for category chips inside charts and legends. */
export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className={cn('size-2 rounded-full', className)}
    />
  );
}
