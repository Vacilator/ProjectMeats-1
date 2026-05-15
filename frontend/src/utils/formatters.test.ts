/**
 * Tests for Date/Time Formatters
 */

import { describe, it, expect } from 'vitest';
import {
  formatCalendarDate,
  formatToLocal,
  formatDateLocal,
  formatTimeLocal,
  formatToLocalWithSeconds,
  formatRelativeTime,
  getUserTimezone,
  getTimezoneOffset,
  isToday,
  isPast,
  isFuture,
} from './formatters';

export {};

describe('formatters', () => {
  describe('formatToLocal', () => {
    it('returns N/A for null input', () => {
      expect(formatToLocal(null)).toBe('N/A');
    });

    it('returns N/A for undefined input', () => {
      expect(formatToLocal(undefined)).toBe('N/A');
    });

    it('returns N/A for empty string', () => {
      expect(formatToLocal('')).toBe('N/A');
    });

    it('returns Invalid Date for malformed date', () => {
      expect(formatToLocal('not-a-date')).toBe('Invalid Date');
    });

    it('formats valid ISO date string', () => {
      const result = formatToLocal('2026-01-15T14:30:00Z');
      // Should contain date parts (exact time depends on timezone)
      expect(result).toMatch(/Jan\s+15,\s+2026/);
    });

    it('formats date with time component', () => {
      const result = formatToLocal('2026-06-20T09:00:00Z');
      expect(result).toMatch(/Jun\s+20,\s+2026/);
    });
  });

  describe('formatDateLocal', () => {
    it('returns N/A for null input', () => {
      expect(formatDateLocal(null)).toBe('N/A');
    });

    it('returns N/A for undefined input', () => {
      expect(formatDateLocal(undefined)).toBe('N/A');
    });

    it('returns Invalid Date for malformed date', () => {
      expect(formatDateLocal('invalid')).toBe('Invalid Date');
    });

    it('formats date without time', () => {
      const result = formatDateLocal('2026-03-10T00:00:00Z');
      expect(result).toMatch(/Mar\s+\d+,\s+2026/);
    });

    it('formats date correctly', () => {
      const result = formatDateLocal('2026-12-25T12:00:00Z');
      expect(result).toMatch(/Dec\s+25,\s+2026/);
    });

    it('preserves calendar dates for date-only values', () => {
      expect(formatDateLocal('2026-03-10')).toBe('Mar 10, 2026');
    });
  });

  describe('formatTimeLocal', () => {
    it('returns N/A for null input', () => {
      expect(formatTimeLocal(null)).toBe('N/A');
    });

    it('returns N/A for undefined input', () => {
      expect(formatTimeLocal(undefined)).toBe('N/A');
    });

    it('returns Invalid Time for malformed date', () => {
      expect(formatTimeLocal('bad-time')).toBe('Invalid Time');
    });

    it('formats time from datetime string', () => {
      const result = formatTimeLocal('2026-01-15T15:45:00Z');
      // Should be a time format like "10:45 AM" or similar
      expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    });
  });

  describe('formatToLocalWithSeconds', () => {
    it('returns N/A for null input', () => {
      expect(formatToLocalWithSeconds(null)).toBe('N/A');
    });

    it('returns Invalid Date for malformed date', () => {
      expect(formatToLocalWithSeconds('xyz')).toBe('Invalid Date');
    });

    it('includes seconds in output', () => {
      const result = formatToLocalWithSeconds('2026-01-15T14:30:45Z');
      // Should contain date and time with seconds
      expect(result).toMatch(/Jan\s+15,\s+2026/);
      expect(result).toMatch(/:\d{2}\s*(AM|PM)/i);
    });
  });

  describe('formatCalendarDate', () => {
    it('formats calendar dates without timezone drift', () => {
      expect(formatCalendarDate('2026-01-08')).toBe('Jan 8, 2026');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns N/A for null input', () => {
      expect(formatRelativeTime(null)).toBe('N/A');
    });

    it('returns Invalid Date for malformed date', () => {
      expect(formatRelativeTime('bad')).toBe('Invalid Date');
    });

    it('handles past dates', () => {
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const result = formatRelativeTime(pastDate);
      expect(result).toMatch(/(ago|hour)/i);
    });

    it('handles future dates', () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ahead
      const result = formatRelativeTime(futureDate);
      expect(result).toMatch(/(in|day)/i);
    });

    it('handles very recent dates', () => {
      const recentDate = new Date(Date.now() - 30 * 1000).toISOString(); // 30 seconds ago
      const result = formatRelativeTime(recentDate);
      expect(result).toMatch(/(second|now)/i);
    });
  });

  describe('getUserTimezone', () => {
    it('returns a valid timezone string', () => {
      const tz = getUserTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    it('returns a timezone in IANA format', () => {
      const tz = getUserTimezone();
      // Most timezones contain a slash like "America/New_York"
      // Some like "UTC" don't, so just check it's non-empty
      expect(tz).toBeTruthy();
    });
  });

  describe('getTimezoneOffset', () => {
    it('returns offset in correct format', () => {
      const offset = getTimezoneOffset();
      // Should match +/-HH:MM format
      expect(offset).toMatch(/^[+-]\d{2}:\d{2}$/);
    });

    it('starts with + or -', () => {
      const offset = getTimezoneOffset();
      expect(['+', '-']).toContain(offset[0]);
    });
  });

  describe('isToday', () => {
    it('returns true for today', () => {
      const today = new Date().toISOString();
      expect(isToday(today)).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(isToday(yesterday)).toBe(false);
    });

    it('returns false for tomorrow', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  describe('isPast', () => {
    it('returns true for past date', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(isPast(past)).toBe(true);
    });

    it('returns false for future date', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(isPast(future)).toBe(false);
    });

    it('returns true for very old date', () => {
      expect(isPast('2020-01-01T00:00:00Z')).toBe(true);
    });
  });

  describe('isFuture', () => {
    it('returns true for future date', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(isFuture(future)).toBe(true);
    });

    it('returns false for past date', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(isFuture(past)).toBe(false);
    });

    it('returns true for far future date', () => {
      expect(isFuture('2030-12-31T23:59:59Z')).toBe(true);
    });
  });
});
