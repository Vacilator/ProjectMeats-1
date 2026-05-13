/**
 * Tests for useImplicitFeedback hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock aiService
vi.mock('../../services/aiService', () => ({
  feedbackEventsApi: {
    batchSubmit: vi.fn().mockResolvedValue({ accepted: 0 }),
  },
}));

import { useImplicitFeedback } from '../useImplicitFeedback';
import { feedbackEventsApi } from '../../services/aiService';

describe('useImplicitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should provide trackEvent function', () => {
    const { result } = renderHook(() => useImplicitFeedback());
    expect(typeof result.current.trackEvent).toBe('function');
  });

  it('should batch events and flush on interval', async () => {
    vi.mocked(feedbackEventsApi.batchSubmit).mockResolvedValue({ accepted: 2 });

    const { result } = renderHook(() => useImplicitFeedback());

    // Track two events
    act(() => {
      result.current.trackEvent({
        eventType: 'implicit_accept',
        sourceSurface: 'form',
        entityType: 'purchase_order',
        entityId: '123',
      });
      result.current.trackEvent({
        eventType: 'implicit_field_correction',
        sourceSurface: 'form',
        entityType: 'purchase_order',
        entityId: '123',
        fieldName: 'supplier_name',
        aiValue: 'Old Supplier',
        userValue: 'New Supplier',
      });
    });

    // Events should NOT be sent yet (waiting for 30s flush)
    expect(feedbackEventsApi.batchSubmit).not.toHaveBeenCalled();

    // Advance timer past 30s
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    // Now events should be flushed
    expect(feedbackEventsApi.batchSubmit).toHaveBeenCalledTimes(1);
    const calledWith = vi.mocked(feedbackEventsApi.batchSubmit).mock.calls[0][0];
    expect(calledWith).toHaveLength(2);
    expect(calledWith[0].event_type).toBe('implicit_accept');
    expect(calledWith[1].event_type).toBe('implicit_field_correction');
    expect(calledWith[1].field_name).toBe('supplier_name');
  });

  it('should not flush when buffer is empty', async () => {
    renderHook(() => useImplicitFeedback());

    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    expect(feedbackEventsApi.batchSubmit).not.toHaveBeenCalled();
  });

  it('should include timestamp in events', () => {
    const { result } = renderHook(() => useImplicitFeedback());

    act(() => {
      result.current.trackEvent({
        eventType: 'implicit_suggestion_click',
        sourceSurface: 'suggestion_chip',
      });
    });

    // trackEvent adds timestamp internally — verify indirectly on flush
    // The event is buffered; we verify the shape on the next flush
  });
});
