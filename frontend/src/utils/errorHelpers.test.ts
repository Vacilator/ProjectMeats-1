/**
 * Tests for errorHelpers utility functions.
 */
import { describe, it, expect } from 'vitest';
import { getAxiosErrorInfo, getErrorMessage } from './errorHelpers';

describe('getAxiosErrorInfo', () => {
  it('extracts status and message from axios-style error', () => {
    const error = {
      response: {
        status: 400,
        data: { error: 'Validation failed' },
      },
    };
    const info = getAxiosErrorInfo(error);
    expect(info.status).toBe(400);
    expect(info.message).toBe('Validation failed');
    expect(info.data).toEqual({ error: 'Validation failed' });
  });

  it('extracts detail field from response data', () => {
    const error = {
      response: {
        status: 403,
        data: { detail: 'Permission denied' },
      },
    };
    const info = getAxiosErrorInfo(error);
    expect(info.status).toBe(403);
    expect(info.message).toBe('Permission denied');
  });

  it('handles string response data', () => {
    const error = {
      response: {
        status: 500,
        data: 'Internal Server Error',
      },
    };
    const info = getAxiosErrorInfo(error);
    expect(info.status).toBe(500);
    expect(info.message).toBe('Internal Server Error');
  });

  it('handles standard Error objects', () => {
    const error = new Error('Network timeout');
    const info = getAxiosErrorInfo(error);
    expect(info.status).toBe(0);
    expect(info.message).toBe('Network timeout');
  });

  it('handles string errors', () => {
    const info = getAxiosErrorInfo('Something went wrong');
    expect(info.status).toBe(0);
    expect(info.message).toBe('Something went wrong');
  });

  it('returns fallback for null/undefined', () => {
    expect(getAxiosErrorInfo(null).message).toBe('An unexpected error occurred');
    expect(getAxiosErrorInfo(undefined).message).toBe('An unexpected error occurred');
  });

  it('uses custom fallback message', () => {
    const info = getAxiosErrorInfo(null, 'Custom fallback');
    expect(info.message).toBe('Custom fallback');
  });

  it('handles response without data', () => {
    const error = { response: { status: 204 } };
    const info = getAxiosErrorInfo(error);
    expect(info.status).toBe(204);
  });
});

describe('getErrorMessage', () => {
  it('returns message from axios error', () => {
    const error = { response: { status: 422, data: { error: 'Invalid payload' } } };
    expect(getErrorMessage(error)).toBe('Invalid payload');
  });

  it('returns fallback for non-errors', () => {
    expect(getErrorMessage(42, 'Oops')).toBe('Oops');
  });

  it('returns Error.message', () => {
    expect(getErrorMessage(new TypeError('x is undefined'))).toBe('x is undefined');
  });
});
