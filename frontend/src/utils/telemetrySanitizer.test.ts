import { describe, expect, it } from 'vitest';

import { sanitizeTelemetryData, sanitizeTelemetryString } from './telemetrySanitizer';

describe('telemetrySanitizer', () => {
  it('redacts emails phones and tokens in strings', () => {
    const value =
      'User alice@example.com called +1 415-555-2671 with Authorization=Bearer secret-token';

    const sanitized = sanitizeTelemetryString(value);

    expect(sanitized).not.toContain('alice@example.com');
    expect(sanitized).not.toContain('+1 415-555-2671');
    expect(sanitized).not.toContain('secret-token');
    expect(sanitized).toContain('[REDACTED:EMAIL]');
  });

  it('redacts nested sensitive keys and preserves safe diagnostics', () => {
    const sanitized = sanitizeTelemetryData({
      email: 'alice@example.com',
      metadata: {
        requestId: 'req-123',
        status: 500,
        authorization: 'Bearer secret-token',
      },
    }) as Record<string, unknown>;

    expect(sanitized.email).toBe('[REDACTED:EMAIL]');
    expect((sanitized.metadata as Record<string, unknown>).requestId).toBe('req-123');
    expect((sanitized.metadata as Record<string, unknown>).status).toBe(500);
    expect((sanitized.metadata as Record<string, unknown>).authorization).toBe('[REDACTED:TOKEN]');
  });
});
