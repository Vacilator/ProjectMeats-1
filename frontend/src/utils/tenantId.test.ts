import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { getValidTenantId, isUuid } from './tenantId';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('tenantId utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('isUuid', () => {
    it('accepts valid UUIDs', () => {
      expect(isUuid(VALID_UUID)).toBe(true);
    });

    it('rejects non-UUID values', () => {
      expect(isUuid('tenant-123')).toBe(false);
      expect(isUuid('')).toBe(false);
      expect(isUuid(null)).toBe(false);
    });
  });

  describe('getValidTenantId', () => {
    it('returns null when tenantId is missing', () => {
      expect(getValidTenantId()).toBeNull();
    });

    it('returns tenantId when it is a valid UUID', () => {
      localStorage.setItem('tenantId', VALID_UUID);
      expect(getValidTenantId()).toBe(VALID_UUID);
    });

    it('treats literal "undefined" as invalid and clears storage', () => {
      localStorage.setItem('tenantId', 'undefined');
      expect(getValidTenantId()).toBeNull();
      expect(localStorage.getItem('tenantId')).toBeNull();
    });

    it('treats literal "null" as invalid and clears storage', () => {
      localStorage.setItem('tenantId', 'null');
      expect(getValidTenantId()).toBeNull();
      expect(localStorage.getItem('tenantId')).toBeNull();
    });

    it('treats non-UUID tenantId as invalid', () => {
      localStorage.setItem('tenantId', 'tenant-123');
      expect(getValidTenantId()).toBeNull();
    });

    it('falls back to currentTenantId key', () => {
      localStorage.setItem('currentTenantId', VALID_UUID);
      expect(getValidTenantId()).toBe(VALID_UUID);
    });
  });
});
