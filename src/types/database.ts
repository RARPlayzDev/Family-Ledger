/**
 * FamilyLedger database types.
 *
 * These mirror supabase/migrations exactly and are shared by the browser app.
 * Regenerate with `supabase gen types typescript` whenever the migrations
 * change, then keep the migration files as the source of truth: this file
 * exists so the app never has to fall back to `any`.
 *
 * Custom auth: profiles IS the user table (email/username; password_hash is
 * deliberately absent from these types - no client code may touch it), and the
 * sign_up/login/resolve_session/logout/join_by_code RPCs are listed under
 * Functions.
 *
 * NOTE: object shapes are declared as *type aliases* (not interfaces) because
 * supabase-js requires row types to be assignable to Record<string, unknown>.
 */

export type HouseholdRole = 'owner' | 'member';
export type PaymentMethod = 'upi' | 'cash' | 'card' | 'bank_transfer' | 'other';

export type ProfileRow = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  // password_hash exists in the table but is intentionally NOT typed here:
  // column-level grants keep it away from every client query.
};

/** Shape returned by the sign_up/login/resolve_session RPCs. */
export type AuthSessionRpc = {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    created_at: string;
  };
};

export type HouseholdRow = {
  id: string;
  name: string;
  owner_id: string;
  currency_code: string;
  timezone: string;
  join_code: string;
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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id?: string;
          email: string;
          username: string;
          password_hash: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
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
          join_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          owner_id?: string;
          timezone?: string;
          currency_code?: string;
          join_code?: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      sign_up: {
        Args: {
          p_email: string;
          p_username: string;
          p_password: string;
          p_display_name?: string;
        };
        Returns: AuthSessionRpc;
      };
      login: { Args: { p_identifier: string; p_password: string }; Returns: AuthSessionRpc };
      resolve_session: { Args: { p_token: string }; Returns: AuthSessionRpc };
      logout: { Args: { p_token: string }; Returns: undefined };
      join_by_code: {
        Args: { p_code: string };
        Returns: { household_id: string; name: string };
      };
      // --- Write RPCs (SECURITY DEFINER) -------------------------------------
      // Every mutation goes through these; direct table writes are revoked
      // from `anon`. See migration 20260101000200_write_rpcs.sql.
      create_household: { Args: { p_name: string; p_timezone?: string | null }; Returns: string };
      update_household: {
        Args: { p_household_id: string; p_name?: string | null; p_timezone?: string | null };
        Returns: undefined;
      };
      transfer_household_ownership: {
        Args: { p_household_id: string; p_new_owner_id: string };
        Returns: undefined;
      };
      /** Owner-only teardown: removes the household and every row scoped to it. */
      delete_household: { Args: { p_household_id: string }; Returns: undefined };
      add_household_member: {
        Args: { p_household_id: string; p_user_id: string };
        Returns: undefined;
      };
      remove_household_member: {
        Args: { p_household_id: string; p_user_id: string };
        Returns: undefined;
      };
      update_my_profile: {
        Args: { p_display_name?: string | null; p_avatar_url?: string | null };
        Returns: undefined;
      };
      create_category: {
        Args: {
          p_household_id: string;
          p_name: string;
          p_icon?: string | null;
          p_color?: string | null;
        };
        Returns: string;
      };
      update_category: {
        Args: {
          p_category_id: string;
          p_name?: string | null;
          p_icon?: string | null;
          p_color?: string | null;
          p_is_active?: boolean | null;
        };
        Returns: undefined;
      };
      delete_category: { Args: { p_category_id: string }; Returns: undefined };
      create_expense: {
        Args: {
          p_household_id: string;
          p_spent_by: string;
          p_amount_paise: number;
          p_expense_date?: string | null;
          p_category_id?: string | null;
          p_merchant?: string | null;
          p_note?: string | null;
          p_payment_method?: PaymentMethod;
        };
        Returns: string;
      };
      update_expense: {
        Args: {
          p_expense_id: string;
          p_spent_by: string;
          p_amount_paise: number;
          p_expense_date: string;
          p_category_id: string | null;
          p_merchant: string | null;
          p_note: string | null;
          p_payment_method: PaymentMethod;
        };
        Returns: undefined;
      };
      delete_expense: { Args: { p_expense_id: string }; Returns: undefined };
      upsert_budget: {
        Args: {
          p_household_id: string;
          p_category_id: string | null;
          p_amount_paise: number;
          p_period_month: string;
        };
        Returns: string;
      };
      delete_budget: { Args: { p_budget_id: string }; Returns: undefined };
      clear_budget: {
        Args: { p_household_id: string; p_period_month: string; p_category_id: string | null };
        Returns: undefined;
      };
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

