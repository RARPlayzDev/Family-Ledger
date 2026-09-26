import { describe, expect, it } from 'vitest';
import {
  authLinkErrorMessage,
  isAuthCallback,
  parseAuthLinkError,
  stripAuthLinkError,
} from '@/lib/auth-error';

describe('parseAuthLinkError', () => {
  it('parses the real Supabase otp_expired bounce from a query string', () => {
    const parsed = parseAuthLinkError(
      '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      '',
    );
    expect(parsed).toEqual({
      code: 'otp_expired',
      description: 'Email link is invalid or has expired',
    });
  });

  it('parses errors from the hash fragment (implicit flow)', () => {
    const parsed = parseAuthLinkError('', '#error=access_denied&error_code=otp_expired');
    expect(parsed?.code).toBe('otp_expired');
  });

  it('prefers the query string over the hash fragment', () => {
    const parsed = parseAuthLinkError('?error_code=otp_expired', '#error_code=redirect_mismatch');
    expect(parsed?.code).toBe('otp_expired');
  });

  it('falls back to the bare error value when no error_code is present', () => {
    expect(parseAuthLinkError('?error=access_denied', '')).toEqual({
      code: 'access_denied',
      description: null,
    });
  });

  it('returns null when there are no error parameters', () => {
    expect(parseAuthLinkError('?mode=reset-password', '#code=abc')).toBeNull();
    expect(parseAuthLinkError('', '')).toBeNull();
  });
});

describe('authLinkErrorMessage', () => {
  it('explains expired verification links in plain language', () => {
    const message = authLinkErrorMessage({ code: 'otp_expired', description: null });
    expect(message).toContain('expired');
    expect(message).toContain('once');
  });

  it('uses the server description for unknown codes', () => {
    const message = authLinkErrorMessage({ code: 'some_future_code', description: 'Nope.' });
    expect(message).toBe('Nope.');
  });

  it('falls back to a generic message when nothing else is known', () => {
    expect(authLinkErrorMessage({ code: 'mystery', description: null })).toContain('link');
  });
});

describe('isAuthCallback', () => {
  it('detects a PKCE code in the query string', () => {
    expect(isAuthCallback('?code=3081cdd2-aa01-4db3-92f8-e3f90ac19427', '')).toBe(true);
  });

  it('detects error params in the query string', () => {
    expect(isAuthCallback('?error=access_denied&error_code=otp_expired', '')).toBe(true);
  });

  it('detects error params and tokens in the hash fragment', () => {
    expect(isAuthCallback('', '#error=access_denied&error_code=otp_expired')).toBe(true);
    expect(isAuthCallback('', '#access_token=abc&token_type=bearer')).toBe(true);
  });

  it('ignores ordinary URLs', () => {
    expect(isAuthCallback('?mode=reset-password', '')).toBe(false);
    expect(isAuthCallback('', '#state=abc')).toBe(false);
    expect(isAuthCallback('', '')).toBe(false);
  });
});

describe('stripAuthLinkError', () => {
  it('removes only the error params and keeps the rest of the URL', () => {
    const result = stripAuthLinkError(
      '?mode=reset-password&error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
      '#error=access_denied&sb=',
    );
    expect(result.search).toBe('?mode=reset-password');
    expect(result.hash).toBe('#sb=');
  });

  it('returns empty parts when the URL only carried the error', () => {
    expect(
      stripAuthLinkError('?error=access_denied&error_code=otp_expired', ''),
    ).toEqual({ search: '', hash: '' });
  });

  it('leaves clean URLs untouched', () => {
    expect(stripAuthLinkError('?mode=reset-password', '#state=abc')).toEqual({
      search: '?mode=reset-password',
      hash: '#state=abc',
    });
  });
});
