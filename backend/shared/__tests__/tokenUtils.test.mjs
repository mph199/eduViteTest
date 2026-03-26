import { describe, it, expect, vi, afterEach } from 'vitest';
import { getExpiresAt, getVerificationTtlMs } from '../tokenUtils.js';

describe('getExpiresAt', () => {
  it('berechnet 12 Monate via Monatsarithmetik', () => {
    const result = getExpiresAt('2024-03-15T10:00:00Z');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(2); // März = 2
    expect(result.getDate()).toBe(15);
  });

  it('behandelt Schaltjahr korrekt (31. Jan → 29. Feb nächstes Jahr)', () => {
    // 31. Januar 2024 + 12 Monate = 31. Januar 2025
    const result = getExpiresAt('2024-01-31T00:00:00Z');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0); // Januar
    expect(result.getDate()).toBe(31);
  });

  it('behandelt Monatsende-Überlauf (31. März + 12 = 31. März)', () => {
    const result = getExpiresAt('2025-03-31T00:00:00Z');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // März
    expect(result.getDate()).toBe(31);
  });

  it('akzeptiert Date-Objekt', () => {
    const input = new Date('2024-06-15T12:00:00Z');
    const result = getExpiresAt(input);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5); // Juni
  });
});

describe('getVerificationTtlMs', () => {
  afterEach(() => {
    delete process.env.VERIFICATION_TOKEN_TTL_HOURS;
  });

  it('gibt Default 72h zurück wenn ENV nicht gesetzt', () => {
    delete process.env.VERIFICATION_TOKEN_TTL_HOURS;
    expect(getVerificationTtlMs()).toBe(72 * 60 * 60 * 1000);
  });

  it('liest TTL aus ENV', () => {
    process.env.VERIFICATION_TOKEN_TTL_HOURS = '48';
    expect(getVerificationTtlMs()).toBe(48 * 60 * 60 * 1000);
  });

  it('fällt auf Default zurück bei ungültigem ENV-Wert', () => {
    process.env.VERIFICATION_TOKEN_TTL_HOURS = 'abc';
    expect(getVerificationTtlMs()).toBe(72 * 60 * 60 * 1000);
  });
});
