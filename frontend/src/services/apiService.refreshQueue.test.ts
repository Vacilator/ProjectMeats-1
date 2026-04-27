export {};

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// vitest.setup.ts globally mocks apiService to avoid network hangs.
// This suite explicitly validates apiService's refresh/queue behavior, so we must use the real module.
vi.unmock('./src/services/apiService');
vi.unmock('@/services/apiService');

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};


const mockRefreshAccessToken = vi.fn<[], Promise<string | null>>();
const mockTriggerGlobalSessionExpired = vi.fn();

vi.mock('axios', () => {
  const create = vi.fn(() => {
    const instance: any = vi.fn((config: any) => instance.request(config));

    instance.request = vi.fn(async (config: any) => ({ data: { ok: true }, config }));

    instance.interceptors = {
      request: { use: vi.fn() },
      response: {
        use: vi.fn(),
      },
    };

    return instance;
  });

  return {
    default: { create },
  };
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

// tenantId utilities import logger via the @ alias; mock it too to avoid noisy output.
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../contexts/SessionManagerContext', () => ({
  triggerGlobalSessionExpired: (...args: any[]) => mockTriggerGlobalSessionExpired(...args),
}));

vi.mock('./apiErrors', () => ({
  ApiServiceError: class ApiServiceError extends Error {
    responseData?: unknown;
  },
  createCircuitBreakerError: (payload: any) => payload,
}));

vi.mock('./jwtService', () => ({
  getAuthHeader: () => 'Bearer new-access',
  needsRefresh: () => false,
  refreshAccessToken: () => mockRefreshAccessToken(),
  clearTokens: vi.fn(),
  isUsingJwt: () => true,
}));

const make401 = (url: string) => ({
  config: {
    url,
    method: 'get',
    headers: {
      Authorization: 'Bearer old-access',
      'X-Tenant-ID': 'tenant-123',
    },
  },
  response: {
    status: 401,
    data: { detail: 'Unauthorized' },
  },
});

describe('apiService JWT refresh queue', () => {
  let apiClient: any;
  let rejected: (err: any) => Promise<any>;
  let resetState: (() => void) | undefined;
  let mockClearTokens: any;

  beforeAll(async () => {
    const jwt = (await import('./jwtService')) as any;
    mockClearTokens = jwt.clearTokens;

    const mod = (await import('./apiService')) as any;
    apiClient = mod.apiClient;
    resetState = mod.__resetAuthRefreshStateForTests;

    expect(apiClient).toBeTruthy();
    expect(apiClient.interceptors?.response?.use).toBeTruthy();
    expect(apiClient.interceptors.response.use).toHaveBeenCalledTimes(1);

    rejected = apiClient.interceptors.response.use.mock.calls[0][1];
  });

  beforeEach(() => {
    resetState?.();
    mockRefreshAccessToken.mockReset();
    mockTriggerGlobalSessionExpired.mockReset();
    mockClearTokens?.mockClear?.();
    apiClient.mockClear();
  });

  it('queues concurrent 401s during refresh and replays them after refresh succeeds', async () => {
    const refresh = deferred<string | null>();
    mockRefreshAccessToken.mockReturnValueOnce(refresh.promise);

    const p1 = rejected(make401('/r1'));
    const p2 = rejected(make401('/r2'));

    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(apiClient).toHaveBeenCalledTimes(0);

    refresh.resolve('new-access');

    await expect(p1).resolves.toBeTruthy();
    await expect(p2).resolves.toBeTruthy();

    expect(apiClient).toHaveBeenCalledTimes(2);

    const firstCallConfig = apiClient.mock.calls[0][0];
    const secondCallConfig = apiClient.mock.calls[1][0];

    expect(firstCallConfig.headers.Authorization).toBe('Bearer new-access');
    expect(secondCallConfig.headers.Authorization).toBe('Bearer new-access');

    // Critical: ensure tenant context is preserved on replay.
    expect(firstCallConfig.headers['X-Tenant-ID']).toBe('tenant-123');
    expect(secondCallConfig.headers['X-Tenant-ID']).toBe('tenant-123');
  });

  it('rejects queued requests when refresh fails', async () => {
    const refresh = deferred<string | null>();
    mockRefreshAccessToken.mockReturnValueOnce(refresh.promise);

    const p1 = rejected(make401('/r1'));
    const p2 = rejected(make401('/r2'));

    const err = new Error('refresh failed');
    refresh.reject(err);

    await expect(p1).rejects.toBe(err);
    await expect(p2).rejects.toBe(err);

    expect(apiClient).toHaveBeenCalledTimes(0);
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });
});
