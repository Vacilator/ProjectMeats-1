import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIInboxSyncProvider, useAIInboxSync } from './AIInboxSyncContext';
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
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockTrigger = vi.mocked(aiInboxSyncApi.trigger);
const mockGetStatus = vi.mocked(aiInboxSyncApi.getStatus);

const SyncProbe = () => {
  const { syncState, requestSync } = useAIInboxSync();

  return (
    <div>
      <div data-testid="sync-status">{syncState.status}</div>
      <div data-testid="sync-summary">{syncState.summary ?? ''}</div>
      <div data-testid="sync-action">{syncState.action?.label ?? ''}</div>
      <button type="button" onClick={() => void requestSync('manual')}>
        Trigger manual sync
      </button>
    </div>
  );
};

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
      progress: {
        phase: 'queued',
        percent: 5,
        summary: 'Email sync queued. Checking Outlook shortly…',
      },
    });
    mockGetStatus.mockResolvedValue({
      task_id: 'task-123',
      state: 'SUCCESS',
      ready: true,
      successful: true,
      failed: false,
      progress: {
        phase: 'completed',
        percent: 100,
        summary: 'Email sync completed.',
      },
      result: {
        tenant_id: 'tenant-123',
        success: true,
        summary: 'Email sync completed.',
      },
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
        <SyncProbe />
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
    expect(screen.getByTestId('sync-status')).toHaveTextContent('succeeded');
    expect(screen.getByTestId('sync-summary')).toHaveTextContent('Email sync completed.');
    window.removeEventListener(AI_INBOX_REFRESH_EVENT, refreshListener);
  });

  it('queues recurring interval syncs while the session stays authenticated', async () => {
    render(
      <AIInboxSyncProvider>
        <SyncProbe />
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

  it('publishes retryable reconnect state for failed manual syncs', async () => {
    mockTrigger
      .mockResolvedValueOnce({
        ok: true,
        accepted: true,
        task_id: 'task-123',
        source: 'login',
      })
      .mockResolvedValueOnce({
        ok: false,
        accepted: false,
        source: 'manual',
        message: 'Outlook needs to be reconnected.',
        action: {
          type: 'reconnect_outlook',
          label: 'Reconnect Outlook',
          url: '/api/v1/integrations/oauth/authorize/?provider=microsoft&tenant_id=tenant-123&redirect=1',
        },
        failure: {
          code: 'OUTLOOK_CONNECTION_EXPIRED',
          retryable: false,
          hint: 'Reconnect Outlook in Settings → Email Integrations.',
        },
      });

    render(
      <AIInboxSyncProvider>
        <SyncProbe />
      </AIInboxSyncProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(60 + AI_INBOX_AUTO_SYNC_STATUS_POLL_MS);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /Trigger manual sync/i }));

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });

    expect(screen.getByTestId('sync-status')).toHaveTextContent('failed');
    expect(screen.getByTestId('sync-summary')).toHaveTextContent('Outlook needs to be reconnected.');
    expect(screen.getByTestId('sync-action')).toHaveTextContent('Reconnect Outlook');
  });

  it('does not treat deadline-reached polling as successful completion', async () => {
    mockGetStatus.mockResolvedValue({
      task_id: 'task-123',
      state: 'PROGRESS',
      ready: false,
      successful: false,
      failed: false,
      progress: {
        phase: 'syncing_outlook',
        percent: 30,
        summary: 'Syncing Outlook inbox…',
      },
    });

    render(
      <AIInboxSyncProvider>
        <SyncProbe />
      </AIInboxSyncProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime((AI_INBOX_AUTO_SYNC_STATUS_POLL_MS * 24) + 1000);
      await Promise.resolve();
    });

    expect(screen.getByTestId('sync-status')).toHaveTextContent('failed');
    expect(screen.getByTestId('sync-summary')).toHaveTextContent('taking longer than expected');
    expect(screen.getByTestId('sync-action')).toHaveTextContent('Retry Sync');
  });
});
