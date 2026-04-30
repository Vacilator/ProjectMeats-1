import { describe, expect, it } from 'vitest';

import { ApiServiceError } from '@/services/apiErrors';
import { getWorkformsErrorMessage, getWorkformsErrorUi } from './workformsErrors';

describe('workformsErrors', () => {
  it('prefers backend detail/error/message over generic fallback', () => {
    const err = { response: { status: 500, data: { detail: 'Backend exploded' } } };
    expect(getWorkformsErrorMessage(err, 'Fallback')).toBe('Backend exploded');
  });

  it('hides Axios-style status-code messages behind fallback', () => {
    const err = { message: 'Request failed with status code 500' };
    expect(getWorkformsErrorMessage(err, 'Fallback')).toBe('Fallback');
  });

  it('maps 403 to access denied', () => {
    const err = { response: { status: 403, data: { detail: 'Forbidden' } } };
    expect(getWorkformsErrorUi(err, 'catalog.load').title).toMatch(/access/i);
  });

  it('maps 404 to not found (execution details specific message)', () => {
    const err = { response: { status: 404, data: { detail: 'Not found.' } } };
    const ui = getWorkformsErrorUi(err, 'executionDetails.load');
    expect(ui.title).toBe('Not found');
    expect(ui.message).toMatch(/run/i);
  });

  it('maps offline-like errors', () => {
    const err = { message: 'Network Error' };
    const ui = getWorkformsErrorUi(err, 'history.load');
    expect(ui.title).toMatch(/offline/i);
  });

  it('uses context title for 5xx errors', () => {
    const err = { response: { status: 500, data: { detail: 'Boom' } } };
    const ui = getWorkformsErrorUi(err, 'catalog.load');
    expect(ui.title).toBe("Couldn't load catalog");
    expect(ui.message).toBe('Boom');
  });

  it('reads status/message from ApiServiceError (circuit breaker)', () => {
    const err = new ApiServiceError('Server error. Please try again shortly.', {
      kind: 'circuit_breaker',
      status: 503,
      responseData: { code: 'CIRCUIT_BREAKER' },
    });

    const executeUi = getWorkformsErrorUi(err, 'execute.start');
    expect(executeUi.title).toMatch(/temporarily paused/i);
    expect(executeUi.message).toMatch(/preventing further executions/i);

    const catalogUi = getWorkformsErrorUi(err, 'catalog.load');
    expect(catalogUi.title).toMatch(/temporarily unavailable/i);
    expect(catalogUi.message).toMatch(/temporarily paused/i);
  });
});
