import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocalStorageDraft } from './useLocalStorageDraft';

describe('useLocalStorageDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates stored draft values over the provided base values', () => {
    localStorage.setItem(
      'unified-form-draft::tenant::purchase_order::new::example',
      JSON.stringify({
        supplier: '42',
        notes: 'Restored from storage',
      }),
    );

    const { result } = renderHook(() =>
      useLocalStorageDraft({
        storageKey: 'unified-form-draft::tenant::purchase_order::new::example',
        baseValues: {
          status: 'pending',
          supplier: '5',
        },
      }),
    );

    expect(result.current.hydratedInitialValues).toEqual({
      status: 'pending',
      supplier: '42',
      notes: 'Restored from storage',
    });
  });

  it('persists changed draft values after the debounce window', () => {
    const storageKey = 'unified-form-draft::tenant::inquiries.inquiry::new::example';
    const { result } = renderHook(() =>
      useLocalStorageDraft({
        storageKey,
        baseValues: { entityType: 'customer' },
      }),
    );

    act(() => {
      result.current.persistDraft({
        entityType: 'customer',
        entityId: '8',
        notes: 'Need trim next week',
      });
    });

    expect(localStorage.getItem(storageKey)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(JSON.parse(localStorage.getItem(storageKey) || '{}')).toEqual({
      entityType: 'customer',
      entityId: '8',
      notes: 'Need trim next week',
    });
  });

  it('clears stored draft state explicitly', () => {
    const storageKey = 'unified-form-draft::tenant::purchase_order::new::example';
    localStorage.setItem(storageKey, JSON.stringify({ notes: 'stale' }));

    const { result } = renderHook(() =>
      useLocalStorageDraft({
        storageKey,
        baseValues: { status: 'pending' },
      }),
    );

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
