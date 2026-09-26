// Shared HTTP helpers for FamilyLedger Edge Functions.
// Kept dependency-free (Deno Web APIs only) so no remote module is required.

const DEFAULT_ALLOWED = ['http://localhost:5173'];

function allowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED;
}

/**
 * CORS headers for the calling web app.
 * Requests are authenticated with a bearer token (never cookies), so when
 * ALLOWED_ORIGINS is not configured we fall back to the requesting origin only.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = allowedOrigins();
  const isAllowed = origin.length > 0 && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  req: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function errorResponse(
  message: string,
  status: number,
  req: Request,
  code = 'request_failed',
): Response {
  return jsonResponse({ error: { code, message } }, status, req);
}
