import { beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn();
const setUserMock = vi.fn();
const setTagMock = vi.fn();
const setContextMock = vi.fn();
const addBreadcrumbMock = vi.fn();
const captureExceptionMock = vi.fn();
const captureMessageMock = vi.fn();
const getClientMock = vi.fn(() => ({}));
const startInactiveSpanMock = vi.fn();

vi.mock('@sentry/react', () => ({
  init: initMock,
  setUser: setUserMock,
  setTag: setTagMock,
  setContext: setContextMock,
  addBreadcrumb: addBreadcrumbMock,
  captureException: captureExceptionMock,
  captureMessage: captureMessageMock,
  getClient: getClientMock,
  startInactiveSpan: startInactiveSpanMock,
  reactRouterV7BrowserTracingIntegration: vi.fn(() => ({ name: 'router' })),
  replayIntegration: vi.fn(() => ({ name: 'replay' })),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('sentry redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).window = {
      ENV: {
        SENTRY_DSN: 'https://example.com/123',
        SENTRY_ENABLED: 'true',
        ENVIRONMENT: 'production',
        GIT_COMMIT_SHA: 'abc123',
      },
    };
  });

  it('configures beforeSend to scrub pii and disables default pii sending', async () => {
    const { initSentry } = await import('./sentry');

    initSentry({ enabled: true });

    const options = initMock.mock.calls[0][0];
    expect(options.sendDefaultPii).toBe(false);

    const sanitized = options.beforeSend(
      {
        message: 'Failure for alice@example.com',
        user: { id: '1', email: 'alice@example.com' },
        request: { headers: { Authorization: 'Bearer secret-token' } },
      },
      { originalException: new Error('boom') }
    );

    expect(JSON.stringify(sanitized)).not.toContain('alice@example.com');
    expect(JSON.stringify(sanitized)).not.toContain('secret-token');
  });

  it('sets only stable user identity and sanitizes message metadata', async () => {
    const {
      setSentryUser,
      addSentryBreadcrumb,
      captureSentryMessage,
    } = await import('./sentry');

    setSentryUser('123', 'alice@example.com', 'tenant-1', 'alice@example.com');
    expect(setUserMock).toHaveBeenCalledWith({ id: '123' });

    addSentryBreadcrumb('auth', 'Authorization=Bearer secret-token', 'warning', {
      email: 'alice@example.com',
    });
    expect(JSON.stringify(addBreadcrumbMock.mock.calls[0][0])).not.toContain('alice@example.com');
    expect(JSON.stringify(addBreadcrumbMock.mock.calls[0][0])).not.toContain('secret-token');

    captureSentryMessage('Oops alice@example.com', 'error', {
      component: 'AuthContext',
      metadata: { authorization: 'Bearer secret-token' },
    });
    expect(JSON.stringify(captureMessageMock.mock.calls[0])).not.toContain('alice@example.com');
    expect(JSON.stringify(captureMessageMock.mock.calls[0])).not.toContain('secret-token');
  });
});
