import { describe, it, expect } from 'vitest';

import { ApiServiceError, createCircuitBreakerError } from './apiErrors';

describe('apiErrors', () => {
  it('createCircuitBreakerError preserves metadata while keeping a friendly message', () => {
    const err = createCircuitBreakerError({
      friendlyMessage: 'Server error. Please try again shortly.',
      status: 500,
      request: { method: 'get', url: '/workflows/available-forms/', baseURL: 'https://example.com/api/v1' },
      responseData: { detail: 'boom' },
      originalError: new Error('original'),
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiServiceError);
    expect(err.message).toBe('Server error. Please try again shortly.');
    expect(err.friendlyMessage).toBe('Server error. Please try again shortly.');
    expect(err.kind).toBe('circuit_breaker');
    expect(err.code).toBe('CIRCUIT_BREAKER');
    expect(err.status).toBe(500);
    expect(err.request?.url).toBe('/workflows/available-forms/');
    expect(err.responseData).toEqual({ detail: 'boom' });
    expect(err.originalError).toBeInstanceOf(Error);
  });
});
