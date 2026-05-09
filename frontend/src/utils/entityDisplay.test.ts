import { describe, it, expect } from 'vitest';
import {
  isUuidLike,
  isIdentifierLike,
  containsUuidToken,
  humanizeEntityType,
  resolveEntityDisplay,
  resolveRouteBreadcrumbLabel,
} from './entityDisplay';

// ─── isUuidLike ────────────────────────────────────────────────────────────────

describe('isUuidLike', () => {
  it('recognizes standard UUID v4', () => {
    expect(isUuidLike('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('recognizes uppercase UUID', () => {
    expect(isUuidLike('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('recognizes 32-char hex string (no dashes)', () => {
    expect(isUuidLike('550e8400e29b41d4a716446655440000')).toBe(true);
  });

  it('rejects short strings', () => {
    expect(isUuidLike('550e8400')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isUuidLike('')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isUuidLike(null)).toBe(false);
    expect(isUuidLike(undefined)).toBe(false);
  });

  it('rejects plain text', () => {
    expect(isUuidLike('hello world')).toBe(false);
  });

  it('rejects numeric id', () => {
    expect(isUuidLike('12345')).toBe(false);
  });
});

// ─── isIdentifierLike ──────────────────────────────────────────────────────────

describe('isIdentifierLike', () => {
  it('identifies UUID as identifier-like', () => {
    expect(isIdentifierLike('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('identifies numeric id as identifier-like', () => {
    expect(isIdentifierLike('42')).toBe(true);
    expect(isIdentifierLike('123456')).toBe(true);
  });

  it('rejects text strings', () => {
    expect(isIdentifierLike('John Doe')).toBe(false);
  });

  it('rejects empty', () => {
    expect(isIdentifierLike('')).toBe(false);
  });

  it('rejects alphanumeric codes', () => {
    expect(isIdentifierLike('INQ-2026-00001')).toBe(false);
  });
});

// ─── containsUuidToken ─────────────────────────────────────────────────────────

describe('containsUuidToken', () => {
  it('finds UUID embedded in text', () => {
    expect(containsUuidToken('Record 550e8400-e29b-41d4-a716-446655440000 details')).toBe(true);
  });

  it('finds standalone UUID', () => {
    expect(containsUuidToken('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsUuidToken('Acme Corp Supplier')).toBe(false);
  });

  it('returns false for empty/null', () => {
    expect(containsUuidToken('')).toBe(false);
    expect(containsUuidToken(null)).toBe(false);
  });
});

// ─── humanizeEntityType ─────────────────────────────────────────────────────────

describe('humanizeEntityType', () => {
  it('maps known singular types', () => {
    expect(humanizeEntityType('supplier')).toBe('Supplier');
    expect(humanizeEntityType('customer')).toBe('Customer');
    expect(humanizeEntityType('contact')).toBe('Contact');
    expect(humanizeEntityType('inquiry')).toBe('Inquiry');
  });

  it('maps known plural types', () => {
    expect(humanizeEntityType('suppliers')).toBe('Supplier');
    expect(humanizeEntityType('customers')).toBe('Customer');
    expect(humanizeEntityType('plants')).toBe('Plant');
  });

  it('maps hyphenated types', () => {
    expect(humanizeEntityType('sales-orders')).toBe('Sales Order');
    expect(humanizeEntityType('purchase-orders')).toBe('Purchase Order');
  });

  it('maps underscored types', () => {
    expect(humanizeEntityType('sales_order')).toBe('Sales Order');
    expect(humanizeEntityType('purchase_order')).toBe('Purchase Order');
  });

  it('handles case-insensitive matching', () => {
    expect(humanizeEntityType('SUPPLIER')).toBe('Supplier');
    expect(humanizeEntityType('Customer')).toBe('Customer');
  });

  it('falls back to title-cased singular for unknown types', () => {
    const result = humanizeEntityType('widgets');
    expect(result).toBe('Widget');
  });

  it('handles "-ies" plural (e.g., "factories")', () => {
    const result = humanizeEntityType('factories');
    expect(result).toBe('Factory');
  });

  it('returns "Record" for empty/null', () => {
    expect(humanizeEntityType('')).toBe('Record');
    expect(humanizeEntityType(null)).toBe('Record');
    expect(humanizeEntityType(undefined)).toBe('Record');
  });

  it('does not strip "ss" ending', () => {
    const result = humanizeEntityType('process');
    expect(result).toBe('Process');
  });
});

// ─── resolveEntityDisplay ───────────────────────────────────────────────────────

describe('resolveEntityDisplay', () => {
  it('resolves display name from "name" field', () => {
    const result = resolveEntityDisplay({ name: 'Acme Corp' });
    expect(result.text).toBe('Acme Corp');
    expect(result.usedIdentifierFallback).toBe(false);
  });

  it('resolves display name from "display_name" field (higher priority)', () => {
    const result = resolveEntityDisplay({ display_name: 'Acme Display', name: 'Acme' });
    expect(result.text).toBe('Acme Display');
  });

  it('resolves person name from first_name + last_name', () => {
    const result = resolveEntityDisplay({ first_name: 'John', last_name: 'Doe' });
    expect(result.text).toBe('John Doe');
  });

  it('falls back to identifier when no display field found', () => {
    const result = resolveEntityDisplay({ id: 42 });
    expect(result.usedIdentifierFallback).toBe(true);
    expect(result.text).toContain('42');
  });

  it('falls back to UUID identifier with truncation', () => {
    const result = resolveEntityDisplay(
      { id: '550e8400-e29b-41d4-a716-446655440000' },
      { entityType: 'supplier' }
    );
    expect(result.usedIdentifierFallback).toBe(true);
    expect(result.text).toContain('Supplier');
    expect(result.text).toContain('550e8400');
  });

  it('uses entityType label in fallback', () => {
    const result = resolveEntityDisplay({ id: 99 }, { entityType: 'customer' });
    expect(result.text).toBe('Customer #99');
  });

  it('skips identifier-like candidate values', () => {
    const result = resolveEntityDisplay(
      { name: '42', title: 'Acme Corp' },
    );
    expect(result.text).toBe('Acme Corp');
  });

  it('skips values containing UUID tokens', () => {
    const result = resolveEntityDisplay(
      { name: 'Record 550e8400-e29b-41d4-a716-446655440000', title: 'Good Title' },
    );
    expect(result.text).toBe('Good Title');
  });

  it('handles null/undefined source', () => {
    const result = resolveEntityDisplay(null);
    expect(result.usedIdentifierFallback).toBe(true);
  });

  it('handles string source (non-identifier)', () => {
    const result = resolveEntityDisplay('Acme Corp');
    expect(result.text).toBe('Acme Corp');
    expect(result.usedIdentifierFallback).toBe(false);
  });

  it('handles string source (identifier)', () => {
    const result = resolveEntityDisplay('42', { entityType: 'plant' });
    expect(result.usedIdentifierFallback).toBe(true);
    expect(result.text).toContain('Plant');
  });

  it('uses preferredKeys when provided', () => {
    const result = resolveEntityDisplay(
      { custom_field: 'Custom Value', name: 'Regular Name' },
      { preferredKeys: ['custom_field'] }
    );
    expect(result.text).toBe('Custom Value');
  });

  it('uses fallbackStyle "details"', () => {
    const result = resolveEntityDisplay(
      { id: 5 },
      { entityType: 'invoice', fallbackStyle: 'details' }
    );
    expect(result.text).toBe('Invoice Details');
  });

  it('returns entity label when no identifier at all', () => {
    const result = resolveEntityDisplay({}, { entityType: 'contact' });
    expect(result.text).toBe('Contact');
    expect(result.usedIdentifierFallback).toBe(true);
  });

  it('handles empty record with fallbackStyle details', () => {
    const result = resolveEntityDisplay({}, { entityType: 'supplier', fallbackStyle: 'details' });
    expect(result.text).toBe('Supplier Details');
  });
});

// ─── resolveRouteBreadcrumbLabel ────────────────────────────────────────────────

describe('resolveRouteBreadcrumbLabel', () => {
  it('returns mapped label for known entity types', () => {
    const result = resolveRouteBreadcrumbLabel('suppliers');
    expect(result.text).toBe('Supplier');
    expect(result.usedIdentifierFallback).toBe(false);
  });

  it('returns capitalized label for unknown segments', () => {
    const result = resolveRouteBreadcrumbLabel('dashboard');
    expect(result.text).toBe('Dashboard');
  });

  it('replaces hyphens with spaces', () => {
    const result = resolveRouteBreadcrumbLabel('cold-storage');
    expect(result.text).toBe('Cold storage');
  });

  it('returns "Details" for empty pathname', () => {
    const result = resolveRouteBreadcrumbLabel('');
    expect(result.text).toBe('Details');
  });

  it('falls back to identifier display for UUID segments', () => {
    const result = resolveRouteBreadcrumbLabel(
      '550e8400-e29b-41d4-a716-446655440000',
      'suppliers'
    );
    expect(result.usedIdentifierFallback).toBe(true);
    expect(result.text).toContain('Supplier');
  });

  it('falls back to identifier display for numeric segments', () => {
    const result = resolveRouteBreadcrumbLabel('42', 'contacts');
    expect(result.usedIdentifierFallback).toBe(true);
    expect(result.text).toContain('Contact');
  });

  it('uses "Record" when no previous pathname', () => {
    const result = resolveRouteBreadcrumbLabel('42');
    expect(result.text).toContain('Record');
    expect(result.usedIdentifierFallback).toBe(true);
  });
});
