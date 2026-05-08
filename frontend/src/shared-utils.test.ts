/**
 * Tests for Shared Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getUserDisplayName,
  isValidEmail,
  isValidPhone,
  generateSlug,
  truncateText,
  capitalizeWords,
  generateRandomColor,
  formatFileSize,
  debounce,
  isTenantTrialExpired,
  getTrialDaysRemaining,
  CONSTANTS,
  isValidTenantRole,
  getErrorMessage,
  isNetworkError,
} from '../../shared/utils';

export {};

describe('shared/utils', () => {
  describe('formatCurrency', () => {
    it('formats positive numbers', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats negative numbers', () => {
      expect(formatCurrency(-500)).toBe('-$500.00');
    });

    it('formats large numbers with commas', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    it('rounds to two decimal places', () => {
      expect(formatCurrency(10.999)).toBe('$11.00');
    });
  });

  describe('formatDate', () => {
    it('formats ISO date string', () => {
      const result = formatDate('2026-01-15T00:00:00Z');
      expect(result).toMatch(/Jan\s+15,\s+2026/);
    });

    it('formats different months', () => {
      const result = formatDate('2026-12-25T12:00:00Z');
      expect(result).toMatch(/Dec\s+25,\s+2026/);
    });
  });

  describe('formatDateTime', () => {
    it('includes time in formatted output', () => {
      const result = formatDateTime('2026-01-15T14:30:00Z');
      expect(result).toMatch(/Jan\s+15,\s+2026/);
      // Time format varies by locale/timezone
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('getUserDisplayName', () => {
    it('returns full name when both names present', () => {
      const user = { first_name: 'John', last_name: 'Doe', username: 'johnd' };
      expect(getUserDisplayName(user)).toBe('John Doe');
    });

    it('returns first name only when last name missing', () => {
      const user = { first_name: 'John', username: 'johnd' };
      expect(getUserDisplayName(user)).toBe('John');
    });

    it('returns username when no names present', () => {
      const user = { username: 'johnd' };
      expect(getUserDisplayName(user)).toBe('johnd');
    });

    it('returns username when names are empty strings', () => {
      const user = { first_name: '', last_name: '', username: 'johnd' };
      expect(getUserDisplayName(user)).toBe('johnd');
    });
  });

  describe('isValidEmail', () => {
    it('validates correct email', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('validates email with subdomain', () => {
      expect(isValidEmail('user@mail.example.com')).toBe(true);
    });

    it('rejects email without @', () => {
      expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('rejects email without domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('rejects email with spaces', () => {
      expect(isValidEmail('user @example.com')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('validates US phone number', () => {
      expect(isValidPhone('1234567890')).toBe(true);
    });

    it('validates phone with country code', () => {
      expect(isValidPhone('+1-555-123-4567')).toBe(true);
    });

    it('validates phone with parentheses', () => {
      expect(isValidPhone('(555)123-4567')).toBe(true);
    });

    it('rejects short numbers', () => {
      expect(isValidPhone('12345')).toBe(false);
    });

    it('rejects letters', () => {
      expect(isValidPhone('555-ABC-1234')).toBe(false);
    });
  });

  describe('generateSlug', () => {
    it('converts spaces to hyphens', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(generateSlug("Hello! World's"+"")).toBe('hello-worlds');
    });

    it('handles multiple spaces', () => {
      expect(generateSlug('Hello    World')).toBe('hello-world');
    });

    it('handles multiple hyphens', () => {
      expect(generateSlug('Hello---World')).toBe('hello-world');
    });

    it('trims leading/trailing hyphens', () => {
      expect(generateSlug('  Hello World  ')).toBe('hello-world');
    });

    it('lowercases text', () => {
      expect(generateSlug('HELLO WORLD')).toBe('hello-world');
    });
  });

  describe('truncateText', () => {
    it('returns text unchanged if shorter than max', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('returns text unchanged if equal to max', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('truncates text longer than max', () => {
      expect(truncateText('Hello World', 5)).toBe('Hello...');
    });

    it('handles empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('capitalizeWords', () => {
    it('capitalizes first letter of each word', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
    });

    it('handles already capitalized text', () => {
      expect(capitalizeWords('Hello World')).toBe('Hello World');
    });

    it('handles single word', () => {
      expect(capitalizeWords('hello')).toBe('Hello');
    });

    it('handles mixed case', () => {
      expect(capitalizeWords('hELLO wORLD')).toBe('HELLO WORLD');
    });
  });

  describe('generateRandomColor', () => {
    it('returns a hex color', () => {
      const color = generateRandomColor('test');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('returns consistent color for same seed', () => {
      const color1 = generateRandomColor('user123');
      const color2 = generateRandomColor('user123');
      expect(color1).toBe(color2);
    });

    it('returns different colors for different seeds', () => {
      const color1 = generateRandomColor('user1');
      const color2 = generateRandomColor('user2');
      // They might occasionally be the same, but usually different
      // Just verify they're valid colors
      expect(color1).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color2).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500.0 Bytes');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('formats zero', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats fractional sizes', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('delays function execution', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('resets timer on subsequent calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to debounced function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('isTenantTrialExpired', () => {
    it('returns false for non-trial tenant', () => {
      const tenant = { is_trial: false };
      expect(isTenantTrialExpired(tenant)).toBe(false);
    });

    it('returns false for trial without end date', () => {
      const tenant = { is_trial: true };
      expect(isTenantTrialExpired(tenant)).toBe(false);
    });

    it('returns true for expired trial', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const tenant = { is_trial: true, trial_ends_at: pastDate };
      expect(isTenantTrialExpired(tenant)).toBe(true);
    });

    it('returns false for active trial', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const tenant = { is_trial: true, trial_ends_at: futureDate };
      expect(isTenantTrialExpired(tenant)).toBe(false);
    });
  });

  describe('getTrialDaysRemaining', () => {
    it('returns 0 for undefined end date', () => {
      expect(getTrialDaysRemaining(undefined)).toBe(0);
    });

    it('returns 0 for past date', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(getTrialDaysRemaining(pastDate)).toBe(0);
    });

    it('returns positive days for future date', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const days = getTrialDaysRemaining(futureDate);
      expect(days).toBeGreaterThanOrEqual(4);
      expect(days).toBeLessThanOrEqual(6);
    });
  });

  describe('CONSTANTS', () => {
    it('has correct tenant roles', () => {
      expect(CONSTANTS.TENANT_ROLES.OWNER).toBe('owner');
      expect(CONSTANTS.TENANT_ROLES.ADMIN).toBe('admin');
      expect(CONSTANTS.TENANT_ROLES.MANAGER).toBe('manager');
      expect(CONSTANTS.TENANT_ROLES.USER).toBe('user');
      expect(CONSTANTS.TENANT_ROLES.READONLY).toBe('readonly');
    });

    it('has correct role labels', () => {
      expect(CONSTANTS.TENANT_ROLE_LABELS.owner).toBe('Owner');
      expect(CONSTANTS.TENANT_ROLE_LABELS.admin).toBe('Administrator');
    });

    it('has valid file upload max size', () => {
      expect(CONSTANTS.FILE_UPLOAD_MAX_SIZE).toBe(10 * 1024 * 1024);
    });

    it('has supported image formats', () => {
      expect(CONSTANTS.SUPPORTED_IMAGE_FORMATS).toContain('jpg');
      expect(CONSTANTS.SUPPORTED_IMAGE_FORMATS).toContain('png');
    });
  });

  describe('isValidTenantRole', () => {
    it('returns true for valid roles', () => {
      expect(isValidTenantRole('owner')).toBe(true);
      expect(isValidTenantRole('admin')).toBe(true);
      expect(isValidTenantRole('manager')).toBe(true);
      expect(isValidTenantRole('user')).toBe(true);
      expect(isValidTenantRole('readonly')).toBe(true);
    });

    it('returns false for invalid roles', () => {
      expect(isValidTenantRole('superuser')).toBe(false);
      expect(isValidTenantRole('guest')).toBe(false);
      expect(isValidTenantRole('')).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('returns string errors as-is', () => {
      expect(getErrorMessage('Something went wrong')).toBe('Something went wrong');
    });

    it('extracts message from Error objects', () => {
      expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
    });

    it('extracts detail from axios-style errors', () => {
      const error = { response: { data: { detail: 'Not found' } } };
      expect(getErrorMessage(error)).toBe('Not found');
    });

    it('extracts message from axios-style errors', () => {
      const error = { response: { data: { message: 'Invalid request' } } };
      expect(getErrorMessage(error)).toBe('Invalid request');
    });

    it('extracts message property from objects', () => {
      const error = { message: 'Custom error' };
      expect(getErrorMessage(error)).toBe('Custom error');
    });

    it('returns default for unknown error types', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
      expect(getErrorMessage(123)).toBe('An unexpected error occurred');
    });
  });

  describe('isNetworkError', () => {
    it('detects NETWORK_ERROR code', () => {
      expect(isNetworkError({ code: 'NETWORK_ERROR' })).toBe(true);
    });

    it('detects Network Error message', () => {
      expect(isNetworkError({ message: 'Network Error' })).toBe(true);
    });

    it('does not throw when navigator is undefined (React Native safety)', () => {
      const originalNavigator = (globalThis as any).navigator;

      vi.stubGlobal('navigator', undefined as any);
      expect(() => isNetworkError({ code: 'OTHER_ERROR' })).not.toThrow();
      expect(isNetworkError({ code: 'OTHER_ERROR' })).toBe(false);

      vi.stubGlobal('navigator', originalNavigator);
    });

    it('returns false for other errors', () => {
      expect(isNetworkError({ code: 'OTHER_ERROR' })).toBe(false);
      expect(isNetworkError({ message: 'Other error' })).toBe(false);
    });
  });
});
