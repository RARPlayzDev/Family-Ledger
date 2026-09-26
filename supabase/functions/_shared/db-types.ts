// Minimal database typing for the Edge runtime.
//
// The function only touches three tables, so it carries its own trimmed copy of
// the schema instead of importing from ../../../src (Edge Function bundles stay
// self-contained). Keep this in sync with supabase/migrations and
// src/types/database.ts.

export type HouseholdRole = 'owner' | 'member';

export type HouseholdMemberRow = {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
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

export type HouseholdRow = {
  id: string;
  name: string;
  owner_id: string;
  currency_code: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type EdgeDatabase = {
  public: {
    Tables: {
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
      household_members: {
        Row: HouseholdMemberRow;
        Insert: {
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Update: {
          role?: HouseholdRole;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: HouseholdRow;
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          currency_code?: string;
          timezone?: string;
        };
        Update: {
          name?: string;
          owner_id?: string;
          timezone?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { household_role: HouseholdRole };
    CompositeTypes: Record<string, never>;
  };
};
