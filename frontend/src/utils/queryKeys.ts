import { getValidTenantId } from './tenantId';

export const TENANT_QUERY_NAMESPACE = 'tenant';
export const TENANT_QUERY_FALLBACK = 'no-tenant';

export const getTenantQueryScope = (): string => {
  return getValidTenantId() ?? TENANT_QUERY_FALLBACK;
};

export const withTenantQueryKey = <const T extends readonly unknown[]>(...parts: T) => {
  return [TENANT_QUERY_NAMESPACE, getTenantQueryScope(), ...parts] as const;
};

export const isTenantScopedQueryKey = (queryKey: readonly unknown[]): boolean => {
  return queryKey[0] === TENANT_QUERY_NAMESPACE && typeof queryKey[1] === 'string';
};
