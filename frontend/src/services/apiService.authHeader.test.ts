export {};

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// vitest.setup.ts globally mocks apiService to avoid network hangs.
// This suite explicitly validates request-interceptor behavior.
vi.unmock('./src/services/apiService');
vi.unmock('@/services/apiService');

vi.mock('axios', () => {
  const create = vi.fn(() => {
    const instance: any = vi.fn(async (config: any) => ({ data: { ok: true }, config }));

    instance.request = vi.fn(async (config: any) => ({ data: { ok: true }, config }));

    instance.interceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    };

    return instance;
  });

  return { default: { create } };
});

vi.mock('../config/runtime', () => ({
  config: { API_BASE_URL: 'http://example.test/api/v1' },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./apiErrors', () => ({
  ApiServiceError: class ApiServiceError extends Error {
    responseData?: unknown;
  },
  createCircuitBreakerError: (payload: any) => payload,
}));

vi.mock('./jwtService', () => ({
  getAuthHeader: () => 'Bearer token',
  needsRefresh: () => false,
  refreshAccessToken: vi.fn(async () => 'new-access'),
  clearTokens: vi.fn(),
  isUsingJwt: () => true,
}));

vi.mock('../utils/tenantId', () => ({
  getValidTenantId: () => '11111111-1111-4111-8111-111111111111',
}));

describe('apiService auth endpoints', () => {
  let requestInterceptor: ((cfg: any) => any) | undefined;

  beforeAll(async () => {
    const mod = (await import('./apiService')) as any;
    const apiClient = mod.apiClient;
    expect(apiClient?.interceptors?.request?.use).toBeTruthy();
    expect(apiClient.interceptors.request.use).toHaveBeenCalled();

    requestInterceptor = apiClient.interceptors.request.use.mock.calls[0][0];
    expect(typeof requestInterceptor).toBe('function');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not attach Authorization header to auth endpoints', async () => {
    const cfg = {
      url: '/auth/token/',
      headers: { Authorization: 'Bearer old' },
    };

    const out = await requestInterceptor?.(cfg);
    expect(out.headers.Authorization).toBeUndefined();
  });
});
