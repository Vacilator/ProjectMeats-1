import { describe, expect, it } from 'vitest';

import {
  formatTradeDate,
  formatTradeDateTime,
  formatTradeWeight,
  getTradeDateInputValue,
  getTradeWeightInputValue,
  normalizeTradeUnit,
} from './trade';

describe('trade helpers', () => {
  const timeline = {
    storage_timezone: 'UTC',
    render_timezone: 'UTC',
    datetime_fields: {
      date_time_stamp: '2026-01-08T13:30:00Z',
    },
    date_fields: {
      order_date: '2026-01-08',
      delivery_date: '2026-01-10',
    },
  };

  it('formats weight from additive trade payloads', () => {
    expect(
      formatTradeWeight({
        trade_weight: {
          entered_value: '1000.50',
          entered_unit: 'LBS',
          normalized_lbs: '1000.50',
          normalized_kg: '453.82',
        },
      })
    ).toBe('1,000.50 LBS');
  });

  it('falls back to raw weight fields when additive payload is absent', () => {
    expect(formatTradeWeight({ total_weight: '500.00', weight_unit: 'kg' })).toBe('500.00 KG');
  });

  it('formats date-only trade fields without timezone drift', () => {
    expect(formatTradeDate(timeline, 'order_date')).toBe('Jan 8, 2026');
    expect(formatTradeDate(timeline, 'delivery_date')).toBe('Jan 10, 2026');
  });

  it('formats datetime trade fields for detail views', () => {
    expect(formatTradeDateTime(timeline, 'date_time_stamp')).toMatch(/Jan\s+8,\s+2026/);
  });

  it('preserves date-only fallback values when timeline metadata is absent', () => {
    expect(formatTradeDate(null, 'order_date', '2026-01-08')).toBe('Jan 8, 2026');
  });

  it('extracts stable input values from datetime fallbacks', () => {
    expect(getTradeDateInputValue(null, 'order_date', '2026-01-08T23:59:59Z')).toBe('2026-01-08');
  });

  it('provides stable form input values from trade payloads', () => {
    expect(getTradeDateInputValue(timeline, 'order_date')).toBe('2026-01-08');
    expect(
      getTradeWeightInputValue({
        trade_weight: {
          entered_value: '1000.50',
          entered_unit: 'lbs',
          normalized_lbs: '1000.50',
          normalized_kg: '453.82',
        },
      })
    ).toEqual({
      totalWeight: '1000.50',
      weightUnit: 'LBS',
    });
  });

  it('normalizes empty and mixed-case units consistently', () => {
    expect(normalizeTradeUnit(null)).toBe('');
    expect(normalizeTradeUnit('')).toBe('');
    expect(normalizeTradeUnit('kg')).toBe('KG');
  });

  it('preserves the incoming decimal precision up to two places', () => {
    expect(formatTradeWeight({ total_weight: '1000.5', weight_unit: 'lbs' })).toBe('1,000.5 LBS');
  });
});
