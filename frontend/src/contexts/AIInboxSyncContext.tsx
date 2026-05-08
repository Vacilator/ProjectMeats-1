import React, { ReactNode, useCallback, useEffect, useRef } from 'react';

import { useAuth } from './AuthContext';
import {
  AI_INBOX_AUTO_SYNC_COALESCE_MS,
  AI_INBOX_AUTO_SYNC_INTERVAL_MS,
  AI_INBOX_AUTO_SYNC_STATUS_POLL_MS,
  type AIInboxSyncSource,
  aiInboxSyncApi,
  emitAIInboxRefreshEvent,
} from '@/services/aiService';
import { logger } from '@/utils/logger';

interface AIInboxSyncProviderProps {
  children: ReactNode;
}

interface SyncClaim {
  requestedAt: number;
  claimId?: string;
}

const IS_DEV = process.env.NODE_ENV === 'development';
const SYNC_LOG_CTX = { component: 'AIInboxSyncProvider' } as const;
const SYNC_CLAIM_SETTLE_MS = 50;

/** Custom event emitted so the widget can show sync status. */
export const AI_INBOX_SYNC_STATUS_EVENT = 'pm.aiInbox.syncStatus';
export type AIInboxSyncStatus = 'started' | 'completed' | 'failed' | 'skipped';

const emitSyncStatus = (status: AIInboxSyncStatus, source: AIInboxSyncSource, detail?: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(AI_INBOX_SYNC_STATUS_EVENT, {
      detail: { status, source, message: detail },
    }),
  );
};

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const tenantId = window.localStorage.getItem('tenantId');
  return tenantId && tenantId.trim() ? tenantId : null;
};

const getCoalesceKey = (tenantId: string): string => `pm.aiInbox.lastSyncRequest:${tenantId}`;

const parseSyncClaim = (rawValue: string | null): SyncClaim | null => {
  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return { requestedAt: numericValue };
  }

  try {
    const parsed = JSON.parse(rawValue) as SyncClaim;
    if (typeof parsed?.requestedAt === 'number' && Number.isFinite(parsed.requestedAt)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
};

const delay = (timeoutMs: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, timeoutMs));

export const AIInboxSyncProvider: React.FC<AIInboxSyncProviderProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const syncInFlightRef = useRef(false);
  const lastLoginSyncRef = useRef<string | null>(null);

  const requestSync = useCallback(async (source: AIInboxSyncSource) => {
    const tenantId = getTenantId();
    if (!user || !tenantId || syncInFlightRef.current) {
      if (IS_DEV) {
        logger.debug(
          `Sync skipped: user=${!!user} tenant=${!!tenantId} inFlight=${syncInFlightRef.current}`,
          SYNC_LOG_CTX,
        );
      }
      emitSyncStatus('skipped', source, 'precondition not met');
      return;
    }

    const coalesceKey = getCoalesceKey(tenantId);
    const now = Date.now();
    const previousClaim = parseSyncClaim(window.localStorage.getItem(coalesceKey));
    if (previousClaim && now - previousClaim.requestedAt < AI_INBOX_AUTO_SYNC_COALESCE_MS) {
      if (IS_DEV) logger.debug('Sync coalesced (too recent)', SYNC_LOG_CTX);
      emitSyncStatus('skipped', source, 'coalesced');
      return;
    }

    const claimId = `${now}:${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(
      coalesceKey,
      JSON.stringify({
        requestedAt: now,
        claimId,
      }),
    );

    await new Promise((resolve) => window.setTimeout(resolve, SYNC_CLAIM_SETTLE_MS));
    const settledClaim = parseSyncClaim(window.localStorage.getItem(coalesceKey));
    if (settledClaim?.claimId !== claimId) {
      if (IS_DEV) logger.debug('Sync claim lost to another tab', SYNC_LOG_CTX);
      return;
    }

    syncInFlightRef.current = true;
    if (IS_DEV) logger.info(`Email sync triggered (source=${source})`, SYNC_LOG_CTX);
    emitSyncStatus('started', source);

    try {
      const result = await aiInboxSyncApi.trigger({ source });
      if (!result.accepted) {
        if (IS_DEV) {
          logger.debug(
            `Sync not accepted: ${(result as unknown as Record<string, unknown>).code ?? 'unknown'}`,
            SYNC_LOG_CTX,
          );
        }
        emitSyncStatus('skipped', source, 'not accepted by backend');
        return;
      }

      const taskId = typeof result.task_id === 'string' ? result.task_id : null;
      if (!taskId) {
        emitAIInboxRefreshEvent(source);
        emitSyncStatus('completed', source);
        return;
      }

      const deadline = Date.now() + 2 * 60 * 1000;
      while (Date.now() < deadline) {
        await delay(AI_INBOX_AUTO_SYNC_STATUS_POLL_MS);
        const status = await aiInboxSyncApi.getStatus(taskId);
        if (status.ready) {
          emitAIInboxRefreshEvent(source);
          emitSyncStatus('completed', source);
          if (IS_DEV) logger.info('Email sync completed', SYNC_LOG_CTX);
          return;
        }
      }

      emitAIInboxRefreshEvent(source);
      emitSyncStatus('completed', source, 'deadline reached');
    } catch (error) {
      logger.warn('AI inbox auto-sync request failed', SYNC_LOG_CTX);
      emitSyncStatus('failed', source);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (loading || !user) {
      lastLoginSyncRef.current = null;
      return;
    }

    const tenantId = getTenantId();
    if (!tenantId) {
      if (IS_DEV) logger.debug('Login sync skipped — no tenantId yet', SYNC_LOG_CTX);
      return;
    }

    const syncKey = `${user.id}:${tenantId}`;
    if (lastLoginSyncRef.current === syncKey) {
      return;
    }

    lastLoginSyncRef.current = syncKey;
    if (IS_DEV) logger.info(`Login detected — triggering email sync for tenant ${tenantId}`, SYNC_LOG_CTX);
    void requestSync('login');
  }, [loading, requestSync, user]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void requestSync('interval');
    }, AI_INBOX_AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loading, requestSync, user]);

  return <>{children}</>;
};

export default AIInboxSyncProvider;
