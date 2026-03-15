/**
 * Tests for useAutoSave hook
 * Phase 7.5: Incremental Auto-Save
 */

import { beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';

// Mock useDebounce to a no-op debouncer so we can assert intermediate pending/dirty state
vi.mock('@/utils/performance', () => ({
  useDebounce: () => () => {},
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with idle status', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutoSave({ name: 'test' }, { onSave })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSaved).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should mark as dirty when data changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
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
    const onSave = vi.fn().mockResolvedValue(undefined);
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
