/**
 * Render-stability regression test for NotificationsContext.
 *
 * Guards against React #185 (Maximum update depth exceeded) which was caused by
 * including `unreadCount` state in the polling useEffect dependency array.
 * When the count changed → effect re-ran → new interval → immediate fetch →
 * count changed again → infinite loop.
 *
 * The fix uses a ref (`unreadCountRef`) to read the previous count inside the
 * polling callback, keeping `unreadCount` out of the effect's deps.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

// Mock AuthContext before importing NotificationsProvider
const mockIsAuthenticated = vi.hoisted(() => ({ value: true }));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated.value,
    user: { id: '1', email: 'test@test.com' },
  }),
}));

// Track how many times the unread-count API is called
const fetchUnreadCountCalls = vi.hoisted(() => ({ count: 0 }));
const fetchNotificationsCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock('../services/notificationsService', () => ({
  notificationsService: {
    getNotifications: vi.fn(async () => {
      fetchNotificationsCalls.count++;
      return [];
    }),
    getUnreadCount: vi.fn(async () => {
      fetchUnreadCountCalls.count++;
      // Alternate between 0 and 1 to simulate changing counts
      return fetchUnreadCountCalls.count % 2;
    }),
    getActionItems: vi.fn(async () => ({ items: [], counts: null })),
    markAsRead: vi.fn(async () => {}),
    markAllAsRead: vi.fn(async () => {}),
    dismiss: vi.fn(async () => {}),
    getPreferences: vi.fn(async () => null),
    updatePreferences: vi.fn(async () => {}),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { NotificationsProvider, useNotifications } from './NotificationsContext';

function TestConsumer() {
  const { unreadCount } = useNotifications();
  return <div data-testid="unread-count">{unreadCount}</div>;
}

describe('NotificationsContext polling stability', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchUnreadCountCalls.count = 0;
    fetchNotificationsCalls.count = 0;
    mockIsAuthenticated.value = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not create an infinite polling loop when unreadCount changes', async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = args.map(String).join(' ');
      if (msg.includes('Maximum update depth') || msg.includes('#185')) {
        errors.push(msg);
      }
      origError(...args);
    };

    render(
      <NotificationsProvider pollingInterval={1000}>
        <TestConsumer />
      </NotificationsProvider>,
    );

    // Initial fetch fires immediately
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const initialFetchCount = fetchUnreadCountCalls.count;

    // Advance through 5 polling intervals — each returns an alternating count
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
      });
    }

    console.error = origError;

    // No infinite loop errors
    expect(errors).toHaveLength(0);

    // Fetch count should grow linearly with intervals, not exponentially.
    // With 5 intervals of 1s each, we expect roughly 5-7 fetches (initial + polling).
    // Before the fix, this would be hundreds or thousands.
    const totalFetches = fetchUnreadCountCalls.count;
    expect(totalFetches).toBeGreaterThan(0);
    expect(totalFetches).toBeLessThan(20);
  });

  it('cleans up the polling interval on unmount', async () => {
    const { unmount } = render(
      <NotificationsProvider pollingInterval={500}>
        <TestConsumer />
      </NotificationsProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const countBeforeUnmount = fetchUnreadCountCalls.count;
    unmount();

    // Advance more time — no additional fetches should happen
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(fetchUnreadCountCalls.count).toBe(countBeforeUnmount);
  });
});
