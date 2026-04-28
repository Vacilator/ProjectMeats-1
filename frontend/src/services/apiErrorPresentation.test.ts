import { describe, expect, it } from 'vitest';

import { getApiErrorPresentation, toApiErrorText } from './apiErrorPresentation';

describe('apiErrorPresentation', () => {
  it('normalizes AI_NOT_CONFIGURED into a friendly not_configured message', () => {
    const error = {
      response: {
        status: 503,
        data: { code: 'AI_NOT_CONFIGURED' },
      },
      code: 'ERR_BAD_RESPONSE',
      message: 'Request failed with status code 503',
    };

    const p = getApiErrorPresentation(error);
    expect(p.kind).toBe('not_configured');
    expect(p.code).toBe('AI_NOT_CONFIGURED');
    expect(p.friendlyMessage).toMatch(/AI is not enabled/i);
  });

  it('normalizes EMAIL_SEND_NOT_CONFIGURED into a friendly not_configured message', () => {
    const error = {
      response: {
        status: 503,
        data: { error_code: 'EMAIL_SEND_NOT_CONFIGURED' },
      },
      code: 'ERR_BAD_RESPONSE',
      message: 'Request failed with status code 503',
    };

    const p = getApiErrorPresentation(error);
    expect(p.kind).toBe('not_configured');
    expect(p.code).toBe('EMAIL_SEND_NOT_CONFIGURED');
    expect(p.friendlyMessage).toMatch(/Email sending is not configured/i);
  });

  it('falls back safely when backend provides no message or code', () => {
    const error = {
      response: {
        status: 500,
        data: {},
      },
      message: 'Request failed with status code 500',
    };

    const text = toApiErrorText(error, { fallbackMessage: 'Fallback', includeMeta: false });
    expect(text).toBe('Fallback');
  });
});
