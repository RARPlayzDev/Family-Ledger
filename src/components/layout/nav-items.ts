import {
  BarChart3,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  /** Shorter label for the 5-slot mobile bottom navigation. */
  shortLabel: string;
  icon: LucideIcon;
  end?: boolean;
};

/**
 * Single source of truth for navigation.
 * The sidebar and the mobile bottom bar are generated from the same arrays, so a
 * route can never appear in one place and be forgotten in the other.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Transactions', shortLabel: 'Ledger', icon: Receipt },
  { to: '/app/analytics', label: 'Analytics', shortLabel: 'Charts', icon: BarChart3 },
  { to: '/app/budgets', label: 'Budgets', shortLabel: 'Budget', icon: PiggyBank },
  { to: '/app/members', label: 'Family', shortLabel: 'Family', icon: Users },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: '/app/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

/** Mobile keeps five primary destinations; settings lives in the top bar menu. */
export const MOBILE_NAV: NavItem[] = PRIMARY_NAV;
