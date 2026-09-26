import { getSupabase } from '@/lib/supabase';

/**
 * Client for the `invitations` Edge Function.
 *
 * The browser never touches the invitations table: RLS has no policies for it and
 * the Edge Function holds the only privileged key. Token generation, hashing,
 * expiry, single-use enforcement and the email binding all happen server-side.
 */

export class InvitationServiceError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'InvitationServiceError';
    this.code = code;
  }
}

type ApiErrorPayload = { error?: { code?: unknown; message?: unknown } };

type InvokeOptions = {
  action: 'create' | 'list' | 'revoke' | 'preview' | 'accept';
  householdId?: string;
  email?: string;
  invitationId?: string;
  token?: string;
  expiresInDays?: number;
};

async function extractApiError(response: Response | undefined): Promise<InvitationServiceError | null> {
  if (!response || typeof response.json !== 'function') return null;
  try {
    const payload = (await response.clone().json()) as ApiErrorPayload;
    const code = typeof payload.error?.code === 'string' ? payload.error.code : null;
    const message =
      typeof payload.error?.message === 'string'
        ? payload.error.message
        : 'The invitation service rejected the request.';
    return new InvitationServiceError(message, code);
  } catch {
    return null;
  }
}

async function invoke<T>(options: InvokeOptions): Promise<T> {
  const { error, data } = await getSupabase().functions.invoke<T>('invitations', {
    body: options,
  });

  if (error) {
    const apiError = await extractApiError(
      (error as { context?: Response }).context ?? undefined,
    );
    throw apiError ?? new InvitationServiceError(error.message, null);
  }
  if (data === null || data === undefined) {
    throw new InvitationServiceError('The invitation service returned no data.', null);
  }
  return data;
}

export type CreateInvitationResult = {
  invitation: {
    id: string;
    email: string;
    role: 'member';
    expiresAt: string;
    createdAt: string;
  };
  token: string;
  inviteUrl: string;
  expiresInDays: number;
};

export type ListInvitationsResult = {
  invitations: Array<{
    id: string;
    email: string;
    role: 'member';
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    status: 'pending' | 'expired' | 'accepted' | 'revoked';
  }>;
};

export type PreviewInvitationResult = {
  status: 'pending' | 'expired' | 'accepted' | 'revoked' | 'invalid';
  householdId?: string;
  householdName?: string | null;
  emailHint?: string;
  expiresAt?: string;
  alreadyMember?: boolean;
};

export type AcceptInvitationResult = {
  joined: boolean;
  alreadyMember?: boolean;
  alreadyAccepted?: boolean;
  householdId: string;
  householdName?: string | null;
};

export function createInvitation(input: {
  householdId: string;
  email: string;
  expiresInDays?: number;
}): Promise<CreateInvitationResult> {
  return invoke<CreateInvitationResult>({ action: 'create', ...input });
}

export function listInvitations(householdId: string): Promise<ListInvitationsResult> {
  return invoke<ListInvitationsResult>({ action: 'list', householdId });
}

export function revokeInvitation(invitationId: string): Promise<{ revoked: boolean }> {
  return invoke<{ revoked: boolean }>({ action: 'revoke', invitationId });
}

export function previewInvitation(token: string): Promise<PreviewInvitationResult> {
  return invoke<PreviewInvitationResult>({ action: 'preview', token });
}

export function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  return invoke<AcceptInvitationResult>({ action: 'accept', token });
}

/** Reads `?invite=<token>` from the current URL, validating the shape. */
export function readInviteToken(searchParams: URLSearchParams): string | null {
  const token = searchParams.get('invite');
  if (!token) return null;
  return /^[A-Za-z0-9_-]{20,120}$/.test(token) ? token : null;
}
