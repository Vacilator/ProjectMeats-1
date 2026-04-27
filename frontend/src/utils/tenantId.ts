/**
 * Tenant ID utilities
 *
 * Prevents accidental propagation of malformed tenant context (e.g. the literal
 * strings "undefined"/"null") into request headers.
 */

import { logger } from '@/utils/logger';

// UUID v1-v5 w/ RFC4122 variant check.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
};

/**
 * Reads tenantId from localStorage and returns a valid UUID or null.
 *
 * NOTE: We intentionally treat non-UUID values as invalid, because the backend
 * expects a UUID in X-Tenant-ID.
 */
export const getValidTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = localStorage.getItem('tenantId') || localStorage.getItem('currentTenantId');
  } catch {
    return null;
  }

  if (!raw) return null;

  const trimmed = raw.trim();

  // Common failure mode: someone did localStorage.setItem('tenantId', String(undefined))
  // or the value got persisted incorrectly.
  if (trimmed === 'undefined' || trimmed === 'null') {
    try {
      localStorage.removeItem('tenantId');
    } catch {
      // best-effort
    }

    logger.warn('[Tenant] Ignoring malformed tenantId in storage', { tenantId: trimmed });
    return null;
  }

  if (!isUuid(trimmed)) {
    logger.warn('[Tenant] Ignoring non-UUID tenantId in storage', { tenantId: trimmed });
    return null;
  }

  return trimmed;
};
