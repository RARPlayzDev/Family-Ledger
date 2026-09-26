// -----------------------------------------------------------------------------
// FamilyLedger invitation service (Supabase Edge Function)
// -----------------------------------------------------------------------------
// POST { action, ...payload }  with the caller's Supabase access token.
//
//   create   owner only   -> issues a one-time token, stores ONLY its SHA-256 hash
//   list     owner only   -> pending/accepted invitations (never the hash)
//   revoke   owner only   -> invalidates an invitation
//   preview  any member   -> resolves a token to a household name + email hint
//   accept   any member   -> joins the invitee's OWN account to the household
//
// Design notes:
//   * the browser never sees token hashes or the service-role key
//   * tokens are random (32 bytes) and single use; accepting sets accepted_at
//   * an invitation is bound to an email address; the accepting account's email
//     must match it, because that is the only identity signal a Supabase project
//     exposes without an email delivery integration
//   * role is forced to 'member' server-side; invitations can never grant owner
// -----------------------------------------------------------------------------
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.46.1';
import type { EdgeDatabase } from '../_shared/db-types.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { createAdminClient, createCallerClient } from '../_shared/supabase.ts';
import {
  INVITATION_TOKEN_PATTERN,
  generateInvitationToken,
  hashInvitationToken,
  maskEmail,
} from '../_shared/tokens.ts';

const DEFAULT_EXPIRY_DAYS = 7;
const MAX_EXPIRY_DAYS = 30;
const MAX_LISTED_INVITATIONS = 50;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Db = SupabaseClient<EdgeDatabase>;
type Action = 'create' | 'list' | 'revoke' | 'preview' | 'accept';
type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'revoked';

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Public site URL used to build shareable invitation links. */
function appBaseUrl(req: Request): string {
  const configured = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL');
  if (configured) return configured.replace(/\/+$/, '');
  const origin = req.headers.get('Origin');
  if (origin) return origin.replace(/\/+$/, '');
  return 'http://localhost:5173';
}

function statusOf(row: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InvitationStatus {
  if (row.revoked_at) return 'revoked';
  if (row.accepted_at) return 'accepted';
  if (new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  return 'pending';
}

async function roleInHousehold(
  admin: Db,
  householdId: string,
  userId: string,
): Promise<'owner' | 'member' | null> {
  const { data } = await admin
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role ?? null;
}

async function householdName(admin: Db, householdId: string): Promise<string | null> {
  const { data } = await admin
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();
  return data?.name ?? null;
}

async function handleCreate(
  req: Request,
  admin: Db,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const householdId = asString(body.householdId);
  const rawEmail = asString(body.email);
  const email = rawEmail?.trim().toLowerCase() ?? null;
  const expiresInDays = asFiniteNumber(body.expiresInDays) ?? DEFAULT_EXPIRY_DAYS;

  if (!householdId || !UUID_PATTERN.test(householdId)) {
    return errorResponse('A valid household id is required', 400, req, 'invalid_household');
  }
  if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return errorResponse('A valid email address is required', 400, req, 'invalid_email');
  }
  if (expiresInDays < 1 || expiresInDays > MAX_EXPIRY_DAYS) {
    return errorResponse(
      `Invitations must expire between 1 and ${MAX_EXPIRY_DAYS} days from now`,
      400,
      req,
      'invalid_expiry',
    );
  }
  if ((await roleInHousehold(admin, householdId, userId)) !== 'owner') {
    return errorResponse(
      'Only the household owner can invite members',
      403,
      req,
      'not_owner',
    );
  }

  // Only one usable token per (household, email): supersede any pending one.
  const nowIso = new Date().toISOString();
  await admin
    .from('invitations')
    .update({ revoked_at: nowIso })
    .eq('household_id', householdId)
    .eq('email', email)
    .is('accepted_at', null)
    .is('revoked_at', null);

  const token = generateInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: created, error } = await admin
    .from('invitations')
    .insert({
      household_id: householdId,
      email,
      role: 'member',
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: userId,
    })
    .select('id, household_id, email, role, expires_at, created_at')
    .single();

  if (error || !created) {
    return errorResponse('Could not create the invitation', 500, req, 'insert_failed');
  }

  return jsonResponse(
    {
      invitation: {
        id: created.id,
        email: created.email,
        role: created.role,
        expiresAt: created.expires_at,
        createdAt: created.created_at,
      },
      token,
      inviteUrl: `${appBaseUrl(req)}/onboarding?invite=${token}`,
      expiresInDays,
    },
    201,
    req,
  );
}

async function handleList(
  req: Request,
  admin: Db,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const householdId = asString(body.householdId);
  if (!householdId || !UUID_PATTERN.test(householdId)) {
    return errorResponse('A valid household id is required', 400, req, 'invalid_household');
  }
  if ((await roleInHousehold(admin, householdId, userId)) !== 'owner') {
    return errorResponse('Only the household owner can view invitations', 403, req, 'not_owner');
  }

  const { data, error } = await admin
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, revoked_at, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(MAX_LISTED_INVITATIONS);

  if (error) {
    return errorResponse('Could not load invitations', 500, req, 'select_failed');
  }

  return jsonResponse(
    {
      invitations: (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        status: statusOf(row),
      })),
    },
    200,
    req,
  );
}

async function handleRevoke(
  req: Request,
  admin: Db,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const invitationId = asString(body.invitationId);
  if (!invitationId || !UUID_PATTERN.test(invitationId)) {
    return errorResponse('A valid invitation id is required', 400, req, 'invalid_invitation');
  }

  const { data: invitation } = await admin
    .from('invitations')
    .select('id, household_id, accepted_at, revoked_at')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation) {
    return errorResponse('Invitation not found', 404, req, 'not_found');
  }
  if ((await roleInHousehold(admin, invitation.household_id, userId)) !== 'owner') {
    return errorResponse('Only the household owner can revoke invitations', 403, req, 'not_owner');
  }
  if (invitation.accepted_at || invitation.revoked_at) {
    return jsonResponse({ revoked: false, reason: 'already_closed' }, 200, req);
  }

  const { error } = await admin
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) {
    return errorResponse('Could not revoke the invitation', 500, req, 'update_failed');
  }
  return jsonResponse({ revoked: true }, 200, req);
}


async function loadInvitationByToken(admin: Db, token: string) {
  const tokenHash = await hashInvitationToken(token);
  const { data } = await admin
    .from('invitations')
    .select('id, household_id, email, role, expires_at, accepted_at, accepted_by, revoked_at, created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  return data;
}

async function handlePreview(
  req: Request,
  admin: Db,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const token = asString(body.token);
  if (!token || !INVITATION_TOKEN_PATTERN.test(token)) {
    return jsonResponse({ status: 'invalid' }, 200, req);
  }

  const invitation = await loadInvitationByToken(admin, token);
  if (!invitation) {
    return jsonResponse({ status: 'invalid' }, 200, req);
  }

  const status = statusOf(invitation);
  const alreadyMember = (await roleInHousehold(admin, invitation.household_id, userId)) !== null;

  return jsonResponse(
    {
      status,
      householdId: invitation.household_id,
      householdName: await householdName(admin, invitation.household_id),
      emailHint: maskEmail(invitation.email),
      expiresAt: invitation.expires_at,
      alreadyMember,
    },
    200,
    req,
  );
}

async function handleAccept(
  req: Request,
  admin: Db,
  user: { id: string; email: string | null },
  body: Record<string, unknown>,
): Promise<Response> {
  const token = asString(body.token);
  if (!token || !INVITATION_TOKEN_PATTERN.test(token)) {
    return errorResponse('This invitation link is not valid', 404, req, 'invalid_invitation');
  }

  const invitation = await loadInvitationByToken(admin, token);
  if (!invitation) {
    return errorResponse('This invitation link is not valid', 404, req, 'invalid_invitation');
  }

  const status = statusOf(invitation);
  if (status === 'revoked') {
    return errorResponse('This invitation was revoked by the household owner', 410, req, 'revoked');
  }
  if (status === 'expired') {
    return errorResponse('This invitation has expired. Ask the owner for a new one.', 410, req, 'expired');
  }
  if (status === 'accepted') {
    if (invitation.accepted_by === user.id) {
      return jsonResponse(
        { joined: true, alreadyAccepted: true, householdId: invitation.household_id },
        200,
        req,
      );
    }
    return errorResponse('This invitation has already been used', 409, req, 'already_used');
  }

  const callerEmail = user.email?.trim().toLowerCase() ?? null;
  if (!callerEmail || callerEmail !== invitation.email.toLowerCase()) {
    return errorResponse(
      `This invitation was issued to ${maskEmail(invitation.email)}. Sign in with that account to accept it.`,
      403,
      req,
      'email_mismatch',
    );
  }

  const existingRole = await roleInHousehold(admin, invitation.household_id, user.id);
  if (existingRole === null) {
    const { error: insertError } = await admin.from('household_members').insert({
      household_id: invitation.household_id,
      user_id: user.id,
      role: 'member',
    });
    if (insertError) {
      return errorResponse('Could not join the household', 500, req, 'join_failed');
    }
  }

  const { error: updateError } = await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq('id', invitation.id)
    .is('accepted_at', null);

  if (updateError) {
    return errorResponse('Could not finalise the invitation', 500, req, 'update_failed');
  }

  return jsonResponse(
    {
      joined: true,
      alreadyMember: existingRole !== null,
      householdId: invitation.household_id,
      householdName: await householdName(admin, invitation.household_id),
    },
    200,
    req,
  );
}


Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return errorResponse('Only POST requests are supported', 405, req, 'method_not_allowed');
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return errorResponse('Request body must be a JSON object', 400, req, 'invalid_body');
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse('Request body must be valid JSON', 400, req, 'invalid_body');
  }

  const action = asString(body.action) as Action | null;
  const supported: Action[] = ['create', 'list', 'revoke', 'preview', 'accept'];
  if (!action || !supported.includes(action)) {
    return errorResponse(
      `Unknown action. Supported actions: ${supported.join(', ')}`,
      400,
      req,
      'unknown_action',
    );
  }

  const caller = createCallerClient(req);
  if (!caller) {
    return errorResponse('A bearer access token is required', 401, req, 'unauthenticated');
  }

  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) {
    return errorResponse('Your session is invalid or has expired', 401, req, 'unauthenticated');
  }
  const user = { id: authData.user.id, email: authData.user.email ?? null };

  let admin: Db;
  try {
    admin = createAdminClient();
  } catch {
    return errorResponse(
      'Server configuration error: the invitation service is not fully configured',
      500,
      req,
      'not_configured',
    );
  }

  try {
    switch (action) {
      case 'create':
        return await handleCreate(req, admin, user.id, body);
      case 'list':
        return await handleList(req, admin, user.id, body);
      case 'revoke':
        return await handleRevoke(req, admin, user.id, body);
      case 'preview':
        return await handlePreview(req, admin, user.id, body);
      case 'accept':
        return await handleAccept(req, admin, user, body);
      default:
        return errorResponse('Unsupported action', 400, req, 'unknown_action');
    }
  } catch {
    // Never leak internal details to the caller.
    return errorResponse('The invitation service failed unexpectedly', 500, req, 'unexpected_error');
  }
});

