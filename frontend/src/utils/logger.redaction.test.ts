import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureMessage = vi.fn();
const captureException = vi.fn();
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  (globalThis as any).window = {
    Sentry: {
      captureMessage,
      captureException,
    },
  };
});

describe('logger redaction', () => {
  it('redacts console payloads before logging', async () => {
    const { logger } = await import('./logger');

    logger.error('Request failed for alice@example.com', {
      component: 'AuthContext',
      metadata: {
        authorization: 'Bearer secret-token',
      },
    }, {
      email: 'alice@example.com',
      phone: '+1 415-555-2671',
    });

    const rendered = JSON.stringify(consoleError.mock.calls);
    expect(rendered).not.toContain('alice@example.com');
    expect(rendered).not.toContain('secret-token');
    expect(rendered).not.toContain('+1 415-555-2671');
  });
});
