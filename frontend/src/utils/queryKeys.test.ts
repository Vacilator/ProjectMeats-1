import { beforeEach, describe, expect, it } from 'vitest';

import {
  getTenantQueryScope,
  isTenantScopedQueryKey,
  TENANT_QUERY_FALLBACK,
  TENANT_QUERY_NAMESPACE,
  withTenantQueryKey,
} from './queryKeys';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('query key utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the valid tenant id as the query scope', () => {
    localStorage.setItem('tenantId', VALID_UUID);

    expect(getTenantQueryScope()).toBe(VALID_UUID);
    expect(withTenantQueryKey('customers')).toEqual([TENANT_QUERY_NAMESPACE, VALID_UUID, 'customers']);
  });

  it('falls back to a stable anonymous scope when tenant id is unavailable', () => {
    expect(getTenantQueryScope()).toBe(TENANT_QUERY_FALLBACK);
    expect(withTenantQueryKey('customers')).toEqual([TENANT_QUERY_NAMESPACE, TENANT_QUERY_FALLBACK, 'customers']);
  });

  it('detects tenant-scoped query keys', () => {
    expect(isTenantScopedQueryKey([TENANT_QUERY_NAMESPACE, VALID_UUID, 'suppliers'])).toBe(true);
    expect(isTenantScopedQueryKey(['health'])).toBe(false);
  });
});
