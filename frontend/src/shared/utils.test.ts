import { describe, expect, it } from 'vitest';

import { coerceFiniteNumber, formatCurrency, formatFixedNumber } from './utils';

describe('shared numeric formatters', () => {
  it('coerces strings and rejects empty or invalid numeric values', () => {
    expect(coerceFiniteNumber('12.5')).toBe(12.5);
    expect(coerceFiniteNumber('  ')).toBeNull();
    expect(coerceFiniteNumber(null)).toBeNull();
    expect(coerceFiniteNumber('abc')).toBeNull();
  });

  it('formats null-safe currency values while preserving zero amounts', () => {
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency('12.5')).toBe('$12.50');
  });

  it('formats fixed numbers without calling toFixed on nullish values', () => {
    expect(formatFixedNumber(undefined, 2)).toBe('-');
    expect(formatFixedNumber(null, 2, 'N/A')).toBe('N/A');
    expect(formatFixedNumber('3.456', 2)).toBe('3.46');
  });
});
