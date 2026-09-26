import { AppConfigurationError } from '@/lib/supabase';

export type NormalizedError = {
  message: string;
  code: string | null;
  /** True when retrying cannot help (e.g. a permission denial). */
  isAuthError: boolean;
};

/** Messages for the PostgreSQL CHECK/constraint names and RPC error codes. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  expenses_amount_paise_check: 'Enter an amount greater than zero.',
  budgets_amount_paise_check: 'Enter a budget greater than zero.',
  expenses_spender_membership_fkey:
    'That family member is not part of this household, so the expense cannot be recorded.',
  expenses_spent_by_fkey: 'Unknown family member for this expense.',
  budgets_scope_key: 'A budget already exists for that category and month.',
  categories_scope_name_key: 'A category with that name already exists.',
  '23505': 'That record already exists.',
  '23503': 'A related record is missing. Refresh and try again.',
  '23514': 'The value violates a validation rule in the database.',
};

const RPC_MESSAGES: Record<string, string> = {
  not_owner: 'Only the household owner can do that.',
  unauthenticated: 'Please sign in first.',
};

type LooseError = {
  message?: unknown;
  code?: unknown;
  error?: unknown;
};

function asMessage(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function fromDatabaseError(message: string, code: string | null): NormalizedError {
  // Grant-level denials arrive as "permission denied for table X". Raised
  // business messages (same SQLSTATE) keep their text.
  if (code === '42501' && message.includes('permission denied')) {
    return {
      message: 'You do not have access to that data.',
      code,
      isAuthError: true,
    };
  }
  const matchedConstraint = Object.entries(CONSTRAINT_MESSAGES).find(([key]) =>
    code ? code === key || message.includes(key) : message.includes(key),
  );
  const trimmed = message.replace(/^.*?:\s*/, '');
  return {
    message:
      matchedConstraint?.[1] ??
      (message.includes('insufficient_privilege') || message.includes('guard_expense')
        ? 'You do not have permission to change that expense.'
        : trimmed.length > 0
          ? trimmed
          : 'The database rejected the request.'),
    code,
    isAuthError: code === '42501',
  };
}

/** Turns anything thrown by the data layer into a message worth showing a user. */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof AppConfigurationError) {
    return { message: error.message, code: 'not_configured', isAuthError: false };
  }

  if (error !== null && typeof error === 'object') {
    const loose = error as LooseError;
    const message = asMessage(loose.message);
    const code = typeof loose.code === 'string' && loose.code.length > 0 ? loose.code : null;

    if (code || message) {
      const text = message ?? 'The database rejected the request.';
      // An explicit error code from an RPC wins.
      if (code && RPC_MESSAGES[code]) {
        return {
          message: RPC_MESSAGES[code],
          code,
          isAuthError: code === 'unauthenticated',
        };
      }
      const rpcKey = Object.keys(RPC_MESSAGES).find((key) => text.includes(key));
      if (rpcKey) {
        return {
          message: RPC_MESSAGES[rpcKey] ?? text,
          code: rpcKey,
          isAuthError: rpcKey === 'unauthenticated',
        };
      }
      if (code?.startsWith('PGRST') || /^[0-9A-Z]{5}$/.test(code ?? '')) {
        return fromDatabaseError(text, code);
      }
      if (loose.error !== null && loose.error !== undefined && loose.error !== error) {
        return normalizeError(loose.error);
      }
      if (code) return fromDatabaseError(text, code);
      return { message: text, code: null, isAuthError: false };
    }

    if (loose.error !== null && loose.error !== undefined) {
      return normalizeError(loose.error);
    }
  }

  return { message: 'Something went wrong. Please try again.', code: null, isAuthError: false };
}

/** Maps an unknown thrown value to a short toast-friendly string. */
export function errorMessage(error: unknown): string {
  return normalizeError(error).message;
}

