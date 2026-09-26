import { describe, expect, it } from 'vitest';
import { buildJoinLink, isValidJoinCode, normalizeJoinCode } from '@/lib/join-code';

describe('normalizeJoinCode', () => {
  it('uppercases and strips separators', () => {
    expect(normalizeJoinCode('xk 3p-9d')).toBe('XK3P9D');
    expect(normalizeJoinCode('  abcd  ')).toBe('ABCD');
  });

  it('truncates to six characters', () => {
    expect(normalizeJoinCode('ABCDEFGH')).toBe('ABCDEF');
  });

  it('drops non-alphanumeric characters', () => {
    expect(normalizeJoinCode('XK3!P9?D')).toBe('XK3P9D');
  });
});

describe('isValidJoinCode', () => {
  it('accepts valid codes, with or without separators', () => {
    expect(isValidJoinCode('XK3P9D')).toBe(true);
    expect(isValidJoinCode('xk-3p-9d')).toBe(true);
  });

  it('rejects wrong lengths and illegal characters', () => {
    expect(isValidJoinCode('XK3P9')).toBe(false);
    expect(isValidJoinCode('!!')).toBe(false);
    expect(isValidJoinCode('')).toBe(false);
  });
});

describe('buildJoinLink', () => {
  it('builds the onboarding link with a normalized code', () => {
    expect(buildJoinLink('https://family.example.com', 'xk3p9d')).toBe(
      'https://family.example.com/onboarding?join=XK3P9D',
    );
  });

  it('tolerates origins with a trailing slash', () => {
    expect(buildJoinLink('https://family.example.com/', 'XK3P9D')).toBe(
      'https://family.example.com/onboarding?join=XK3P9D',
    );
  });
});
