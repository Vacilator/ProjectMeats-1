import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIInboxSyncProvider } from './AIInboxSyncContext';
import { useAuth } from './AuthContext';
import {
  AI_INBOX_AUTO_SYNC_INTERVAL_MS,
  AI_INBOX_AUTO_SYNC_STATUS_POLL_MS,
  AI_INBOX_REFRESH_EVENT,
  aiInboxSyncApi,
} from '@/services/aiService';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/aiService', () => ({
  AI_INBOX_AUTO_SYNC_INTERVAL_MS: 15 * 60 * 1000,
  AI_INBOX_AUTO_SYNC_COALESCE_MS: 0,
  AI_INBOX_AUTO_SYNC_STATUS_POLL_MS: 5 * 1000,
  AI_INBOX_REFRESH_EVENT: 'pm:ai-inbox-refresh',
  aiInboxSyncApi: {
    trigger: vi.fn(),
    getStatus: vi.fn(),
  },
  emitAIInboxRefreshEvent: (reason: string) => {
    window.dispatchEvent(new CustomEvent('pm:ai-inbox-refresh', { detail: { reason } }));
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockTrigger = vi.mocked(aiInboxSyncApi.trigger);
const mockGetStatus = vi.mocked(aiInboxSyncApi.getStatus);

describe('AIInboxSyncProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('tenantId', 'tenant-123');
    mockUseAuth.mockReturnValue({
      user: { id: 7, email: 'test@example.com' } as never,
      loading: false,
      login: vi.fn(),
      guestLogin: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isAdmin: false,
      refreshUser: vi.fn(),
    });
    mockTrigger.mockResolvedValue({
      ok: true,
      accepted: true,
      task_id: 'task-123',
      source: 'login',
    });
    mockGetStatus.mockResolvedValue({
      task_id: 'task-123',
      state: 'SUCCESS',
      ready: true,
      successful: true,
      failed: false,
      result: { tenant_id: 'tenant-123' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests an immediate sync for authenticated users and dispatches a refresh event', async () => {
    const refreshListener = vi.fn();
    window.addEventListener(AI_INBOX_REFRESH_EVENT, refreshListener);

    render(
      <AIInboxSyncProvider>
        <div>child</div>
      </AIInboxSyncProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });

    expect(mockTrigger).toHaveBeenCalledWith({ source: 'login' });

    await act(async () => {
      vi.advanceTimersByTime(AI_INBOX_AUTO_SYNC_STATUS_POLL_MS);
      await Promise.resolve();
    });

    expect(mockGetStatus).toHaveBeenCalledWith('task-123');
    expect(refreshListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AI_INBOX_REFRESH_EVENT, refreshListener);
  });

  it('queues recurring interval syncs while the session stays authenticated', async () => {
    render(
      <AIInboxSyncProvider>
        <div>child</div>
      </AIInboxSyncProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });

    expect(mockTrigger).toHaveBeenCalledWith({ source: 'login' });

    await act(async () => {
      vi.advanceTimersByTime(AI_INBOX_AUTO_SYNC_STATUS_POLL_MS);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(AI_INBOX_AUTO_SYNC_INTERVAL_MS + 1000);
      await Promise.resolve();
    });

    expect(mockTrigger).toHaveBeenCalledWith({ source: 'interval' });
  });
});
