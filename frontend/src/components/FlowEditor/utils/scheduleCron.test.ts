import { describe, it, expect } from 'vitest';

import {
  parseTimeOfDay,
  buildCronExpressionFromFriendlySchedule,
  buildScheduleSummary,
} from './scheduleCron';

describe('scheduleCron', () => {
  describe('parseTimeOfDay', () => {
    it('parses HH:mm', () => {
      expect(parseTimeOfDay('13:05')).toEqual({ hour: 13, minute: 5 });
    });

    it('falls back to 09:00 for invalid input', () => {
      expect(parseTimeOfDay('not-a-time')).toEqual({ hour: 9, minute: 0 });
      expect(parseTimeOfDay(null)).toEqual({ hour: 9, minute: 0 });
    });
  });

  describe('buildCronExpressionFromFriendlySchedule', () => {
    it('builds hourly cron (minute only)', () => {
      expect(buildCronExpressionFromFriendlySchedule({ frequency: 'hourly', atTime: '09:15' })).toBe('15 * * * *');
    });

    it('builds daily cron', () => {
      expect(buildCronExpressionFromFriendlySchedule({ frequency: 'daily', atTime: '09:15' })).toBe('15 9 * * *');
    });

    it('builds weekly cron with DOW mapping', () => {
      expect(
        buildCronExpressionFromFriendlySchedule({
          frequency: 'weekly',
          atTime: '07:30',
          daysOfWeek: ['MON', 'WED', 'SUN'],
        })
      ).toBe('30 7 * * 0,1,3');
    });

    it('defaults weekly DOW to Monday when none provided', () => {
      expect(buildCronExpressionFromFriendlySchedule({ frequency: 'weekly', atTime: '07:30' })).toBe('30 7 * * 1');
    });

    it('builds monthly cron with clamped dayOfMonth', () => {
      expect(buildCronExpressionFromFriendlySchedule({ frequency: 'monthly', atTime: '07:30', dayOfMonth: 0 })).toBe(
        '30 7 1 * *'
      );
      expect(buildCronExpressionFromFriendlySchedule({ frequency: 'monthly', atTime: '07:30', dayOfMonth: 99 })).toBe(
        '30 7 31 * *'
      );
    });
  });

  describe('buildScheduleSummary', () => {
    it('adds timezone suffix only when not UTC', () => {
      expect(buildScheduleSummary({ frequency: 'daily', atTime: '09:00', timezone: 'UTC' })).toBe('Daily at 09:00');
      expect(buildScheduleSummary({ frequency: 'daily', atTime: '09:00', timezone: 'America/Chicago' })).toBe(
        'Daily at 09:00 (America/Chicago)'
      );
    });
  });
});
