import type {
  BudgetRow,
  CategoryRow,
  ExpenseRow,
  HouseholdRole,
  HouseholdRow,
  PaymentMethod,
  ProfileRow,
} from '@/types/database';
import type { IsoDate, MonthKey } from '@/domain/dates';

/** Category shape embedded in expense queries (never the whole row). */
export type CategorySummary = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type MemberSummary = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

/** An expense joined with the two relations the UI always needs. */
export type ExpenseWithRelations = ExpenseRow & {
  category: CategorySummary | null;
  spender: MemberSummary | null;
};

export type HouseholdMembership = {
  household: HouseholdRow;
  role: HouseholdRole;
  joined_at: string;
};

export type HouseholdMember = {
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
  profile: MemberSummary | null;
};

export type Category = CategoryRow & {
  /** true for the shared system default set (household_id IS NULL). */
  is_system: boolean;
};

export type PeriodTotals = {
  total_paise: number;
  expense_count: number;
  member_count: number;
  largest_expense_paise: number;
  average_expense_paise: number;
};

export const EMPTY_PERIOD_TOTALS: PeriodTotals = {
  total_paise: 0,
  expense_count: 0,
  member_count: 0,
  largest_expense_paise: 0,
  average_expense_paise: 0,
};

export type CategoryTotal = {
  category_id: string | null;
  category_name: string;
  category_icon: string;
  category_color: string;
  total_paise: number;
  expense_count: number;
};

export type MemberTotal = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: HouseholdRole;
  total_paise: number;
  expense_count: number;
};

export type DailyTotal = {
  day: IsoDate;
  total_paise: number;
  expense_count: number;
};

export type ExpenseSortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

/** Filters accepted by the ledger query layer. */
export type ExpenseQueryFilters = {
  /** Inclusive ISO day range. */
  from: IsoDate;
  to: IsoDate;
  search?: string;
  categoryIds?: string[];
  memberIds?: string[];
  paymentMethods?: PaymentMethod[];
  minPaise?: number | null;
  maxPaise?: number | null;
};

export type ExpenseFormValues = {
  amount: string;
  expense_date: IsoDate;
  category_id: string | null;
  spent_by: string;
  merchant: string;
  note: string;
  payment_method: PaymentMethod;
};

export type BudgetScope = {
  categoryId: string | null;
  categoryName: string;
};

export type CategoryBudgetRow = BudgetRow & {
  category: CategorySummary | null;
  spent_paise: number;
};

/** Budget as returned by the API: joined with its category, spend computed separately. */
export type BudgetWithCategory = BudgetRow & {
  category: CategorySummary | null;
};

export type MonthlyInsights = {
  householdId: string;
  monthKey: MonthKey;
  range: { from: IsoDate; to: IsoDate };
  totals: PeriodTotals;
  previousTotals: PeriodTotals;
  categoryTotals: CategoryTotal[];
  memberTotals: MemberTotal[];
  dailyTotals: DailyTotal[];
  recentExpenses: ExpenseWithRelations[];
  topExpenses: ExpenseWithRelations[];
};

export type MemberInsights = {
  member: MemberSummary | null;
  totals: PeriodTotals;
  categoryTotals: CategoryTotal[];
  dailyTotals: DailyTotal[];
  expenses: ExpenseWithRelations[];
};

export type { BudgetRow, CategoryRow, ExpenseRow, HouseholdRole, HouseholdRow, PaymentMethod, ProfileRow };
