import { describe, it, expect } from 'vitest';
import { assertSafeIdentifier } from '../sqlGuards.js';

describe('assertSafeIdentifier', () => {
  it('akzeptiert gültige Identifier', () => {
    expect(() => assertSafeIdentifier('bl_appointments', 'table')).not.toThrow();
    expect(() => assertSafeIdentifier('bl', 'prefix')).not.toThrow();
    expect(() => assertSafeIdentifier('counselor_id', 'column')).not.toThrow();
    expect(() => assertSafeIdentifier('a', 'x')).not.toThrow();
  });

  it('wirft bei Leerzeichen', () => {
    expect(() => assertSafeIdentifier('bl appointments', 'table')).toThrow(/Invalid SQL identifier/);
  });

  it('wirft bei führender Ziffer', () => {
    expect(() => assertSafeIdentifier('1bl', 'table')).toThrow(/Invalid SQL identifier/);
  });

  it('wirft bei SQL-Injection-Versuch', () => {
    expect(() => assertSafeIdentifier('bl;DROP', 'table')).toThrow();
    expect(() => assertSafeIdentifier("bl' OR 1=1", 'table')).toThrow();
    expect(() => assertSafeIdentifier('bl--', 'table')).toThrow();
  });

  it('wirft bei Großbuchstaben', () => {
    expect(() => assertSafeIdentifier('BL_appointments', 'table')).toThrow();
  });

  it('wirft bei leerem String', () => {
    expect(() => assertSafeIdentifier('', 'table')).toThrow();
  });
});
