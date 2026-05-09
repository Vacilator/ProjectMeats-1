import { describe, expect, it } from 'vitest';
import { getStatusColors, getAntdStatusColor, getRiskColors, type StatusColorSet } from './statusColors';

describe('getStatusColors', () => {
  const expectToken = (status: string, antd: string) => {
    const result = getStatusColors(status);
    expect(result).toBeDefined();
    expect(result.antd).toBe(antd);
    expect(result.text).toContain('rgb(var(--color-');
    expect(result.bg).toContain('rgb(var(--color-');
    expect(result.border).toContain('rgb(var(--color-');
  };

  describe('success statuses', () => {
    it.each(['success', 'completed', 'approved', 'active', 'paid', 'resolved', 'done', 'low'])(
      'maps "%s" to green/success',
      (status) => expectToken(status, 'green'),
    );
  });

  describe('warning statuses', () => {
    it.each(['warning', 'pending', 'review', 'partial', 'medium', 'halted', 'in_review'])(
      'maps "%s" to orange/warning',
      (status) => expectToken(status, 'orange'),
    );
  });

  describe('error statuses', () => {
    it.each(['error', 'danger', 'cancelled', 'rejected', 'overdue', 'unpaid', 'failed', 'high', 'critical'])(
      'maps "%s" to red/error',
      (status) => expectToken(status, 'red'),
    );
  });

  describe('info statuses', () => {
    it.each(['info', 'in_progress', 'running', 'processing'])(
      'maps "%s" to blue/info',
      (status) => expectToken(status, 'blue'),
    );
  });

  describe('neutral/unknown statuses', () => {
    it.each(['draft', 'inactive', 'unknown', 'something_random', ''])(
      'maps "%s" to default/neutral',
      (status) => expectToken(status, 'default'),
    );
  });

  it('normalizes underscores, hyphens, and case', () => {
    expect(getStatusColors('IN_PROGRESS').antd).toBe('blue');
    expect(getStatusColors('in-progress').antd).toBe('blue');
    expect(getStatusColors('InProgress').antd).toBe('blue');
    expect(getStatusColors('IN-REVIEW').antd).toBe('orange');
  });

  it('returns complete StatusColorSet with all required fields', () => {
    const result: StatusColorSet = getStatusColors('success');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('bg');
    expect(result).toHaveProperty('border');
    expect(result).toHaveProperty('antd');
  });
});

describe('getAntdStatusColor', () => {
  it('returns just the antd color string', () => {
    expect(getAntdStatusColor('completed')).toBe('green');
    expect(getAntdStatusColor('error')).toBe('red');
    expect(getAntdStatusColor('pending')).toBe('orange');
    expect(getAntdStatusColor('running')).toBe('blue');
    expect(getAntdStatusColor('draft')).toBe('default');
  });
});

describe('getRiskColors', () => {
  it('maps risk levels to status colors', () => {
    expect(getRiskColors('high').antd).toBe('red');
    expect(getRiskColors('medium').antd).toBe('orange');
    expect(getRiskColors('low').antd).toBe('green');
    expect(getRiskColors('critical').antd).toBe('red');
  });
});
