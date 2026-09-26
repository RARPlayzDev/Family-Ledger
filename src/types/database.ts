/**
 * FamilyLedger database types.
 *
 * These mirror supabase/migrations exactly and are shared by the browser app and
 * the invitation Edge Function. Regenerate with `supabase gen types typescript`
 * whenever the migrations change, then keep the migration files as the source of
 * truth: this file exists so the app never has to fall back to `any`.
 *
 * NOTE: object shapes are declared as *type aliases* (not interfaces) because
 * supabase-js requires row types to be assignable to Record<string, unknown>.
 */

export type HouseholdRole = 'owner' | 'member';
export type PaymentMethod = 'upi' | 'cash' | 'card' | 'bank_transfer' | 'other';

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type HouseholdRow = {
  id: string;
  name: string;
  owner_id: string;
  currency_code: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type HouseholdMemberRow = {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
};

export type CategoryRow = {
  id: string;
  household_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type ExpenseRow = {
  id: string;
  household_id: string;
  spent_by: string;
  category_id: string | null;
  amount_paise: number;
  expense_date: string;
  merchant: string | null;
  note: string | null;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
};

export type BudgetRow = {
  id: string;
  household_id: string;
  category_id: string | null;
  amount_paise: number;
  period_month: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type InvitationRow = {
  id: string;
  household_id: string;
  email: string;
  role: HouseholdRole;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
};
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: HouseholdRow;
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          currency_code?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          owner_id?: string;
          timezone?: string;
          currency_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'households_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      household_members: {
        Row: HouseholdMemberRow;
        Insert: {
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: CategoryRow;
        Insert: {
          id?: string;
          household_id?: string | null;
          name: string;
          icon?: string;
          color?: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          icon?: string;
          color?: string;
          is_active?: boolean;
          household_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: ExpenseRow;
        Insert: {
          id?: string;
          household_id: string;
          spent_by: string;
          category_id?: string | null;
          amount_paise: number;
          expense_date: string;
          merchant?: string | null;
          note?: string | null;
          payment_method?: PaymentMethod;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          amount_paise?: number;
          expense_date?: string;
          merchant?: string | null;
          note?: string | null;
          payment_method?: PaymentMethod;
          spent_by?: string;
          household_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_household_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_spent_by_fkey';
            columns: ['spent_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };

      budgets: {
        Row: BudgetRow;
        Insert: {
          id?: string;
          household_id: string;
          category_id?: string | null;
          amount_paise: number;
          period_month: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          amount_paise?: number;
          period_month?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budgets_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: InvitationRow;
        Insert: {
          id?: string;
          household_id: string;
          email: string;
          role?: HouseholdRole;
          token_hash: string;
          expires_at: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          expires_at?: string;
          email?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_household_member: { Args: { p_household_id: string }; Returns: boolean };
      is_household_owner: { Args: { p_household_id: string }; Returns: boolean };
      shares_household_with: { Args: { p_user_id: string }; Returns: boolean };
      household_period_totals: {
        Args: { p_household_id: string; p_from: string; p_to: string };
        Returns: {
          total_paise: number;
          expense_count: number;
          member_count: number;
          largest_expense_paise: number;
          average_expense_paise: number;
        }[];
      };
      household_category_totals: {
        Args: { p_household_id: string; p_from: string; p_to: string };
        Returns: {
          category_id: string | null;
          category_name: string;
          category_icon: string;
          category_color: string;
          total_paise: number;
          expense_count: number;
        }[];
      };
      household_member_totals: {
        Args: { p_household_id: string; p_from: string; p_to: string };
        Returns: {
          user_id: string;
          display_name: string;
          avatar_url: string | null;
          role: HouseholdRole;
          total_paise: number;
          expense_count: number;
        }[];
      };
      household_daily_totals: {
        Args: { p_household_id: string; p_from: string; p_to: string };
        Returns: { day: string; total_paise: number; expense_count: number }[];
      };
    };
    Enums: {
      household_role: HouseholdRole;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type DatabaseTables = Database['public']['Tables'];

