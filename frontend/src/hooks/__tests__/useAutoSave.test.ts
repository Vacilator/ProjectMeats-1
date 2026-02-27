/**
 * Tests for useAutoSave hook
 * Phase 7.5: Incremental Auto-Save
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';

// Mock useDebounce to run immediately in tests
jest.mock('@/utils/performance', () => ({
  useDebounce: (fn: Function) => fn,
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with idle status', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutoSave({ name: 'test' }, { onSave })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSaved).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should mark as dirty when data changes', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(data, { onSave }),
      { initialProps: { data: { name: 'test' } } }
    );

    // Change data
    rerender({ data: { name: 'changed' } });

    await waitFor(() => {
      expect(result.current.isDirty).toBe(true);
      expect(result.current.status).toBe('pending');
    });
  });

  it('should manually save with saveNow()', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(data, { onSave }),
      { initialProps: { data: { name: 'test' } } }
    );

    // Change data
    rerender({ data: { name: 'changed' } });

    // Wait for dirty state
    await waitFor(() => {
      expect(result.current.isDirty).toBe(true);
    });

    // Manual save
    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).toHaveBeenCalledWith({ name: 'changed' });
    expect(result.current.isDirty).toBe(false);
  });
});
