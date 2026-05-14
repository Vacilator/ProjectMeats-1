import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from './AuthContext';
import {
  AI_INBOX_AUTO_SYNC_COALESCE_MS,
  AI_INBOX_AUTO_SYNC_INTERVAL_MS,
  AI_INBOX_AUTO_SYNC_STATUS_POLL_MS,
  type AIInboxSyncAction,
  type AIInboxSyncFailure,
  type AIInboxSyncProgress,
  type AIInboxSyncResult,
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

export type AIInboxSyncStatus = 'started' | 'completed' | 'failed' | 'skipped';
export type AIInboxSyncLifecycleState = 'idle' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface AIInboxSyncSnapshot {
  status: AIInboxSyncLifecycleState;
  source?: AIInboxSyncSource;
  taskId?: string | null;
  message?: string;
  summary?: string | null;
  retryable?: boolean;
  action?: AIInboxSyncAction | null;
  failure?: AIInboxSyncFailure | null;
  progress?: AIInboxSyncProgress | null;
  result?: AIInboxSyncResult | null;
  startedAt?: number;
  finishedAt?: number;
}

interface AIInboxSyncContextValue {
  syncState: AIInboxSyncSnapshot;
  requestSync: (source: AIInboxSyncSource) => Promise<AIInboxSyncSnapshot>;
  retryLastSync: () => Promise<AIInboxSyncSnapshot>;
}

interface AIInboxSyncEventDetail {
  status: AIInboxSyncStatus;
  source?: AIInboxSyncSource;
  message?: string;
  syncState: AIInboxSyncSnapshot;
}

const IS_DEV = process.env.NODE_ENV === 'development';
const SYNC_LOG_CTX = { component: 'AIInboxSyncProvider' } as const;
const SYNC_CLAIM_SETTLE_MS = 50;
const SYNC_DEADLINE_MS = 2 * 60 * 1000;
const DEFAULT_TIMEOUT_MESSAGE = 'Email sync is taking longer than expected. Retry the sync if it remains stuck.';

const initialSyncState: AIInboxSyncSnapshot = {
  status: 'idle',
  taskId: null,
  summary: null,
  retryable: false,
  action: null,
  failure: null,
  progress: null,
  result: null,
};

/** Custom event emitted so existing listeners can observe sync status. */
export const AI_INBOX_SYNC_STATUS_EVENT = 'pm.aiInbox.syncStatus';

const AIInboxSyncContext = createContext<AIInboxSyncContextValue | undefined>(undefined);

const normalizeFailure = (failure: unknown): AIInboxSyncFailure | null => {
  if (!failure || typeof failure !== 'object' || Array.isArray(failure)) {
    return null;
  }
  return failure as AIInboxSyncFailure;
};

const normalizeAction = (action: unknown): AIInboxSyncAction | null => {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return null;
  }
  const candidate = action as AIInboxSyncAction;
  return typeof candidate.label === 'string' && candidate.label.trim() ? candidate : null;
};

const normalizeProgress = (progress: unknown): AIInboxSyncProgress | null => {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    return null;
  }
  const candidate = progress as AIInboxSyncProgress;
  if (
    typeof candidate.phase !== 'string' ||
    typeof candidate.percent !== 'number' ||
    typeof candidate.summary !== 'string'
  ) {
    return null;
  }
  return candidate;
};

const toEventStatus = (snapshot: AIInboxSyncSnapshot): AIInboxSyncStatus => {
  if (snapshot.status === 'running') {
    return 'started';
  }
  if (snapshot.status === 'failed') {
    return 'failed';
  }
  if (snapshot.status === 'skipped') {
    return 'skipped';
  }
  return 'completed';
};

const emitSyncStatus = (snapshot: AIInboxSyncSnapshot) => {
  if (typeof window === 'undefined') return;

  const detail: AIInboxSyncEventDetail = {
    status: toEventStatus(snapshot),
    source: snapshot.source,
    message: snapshot.message,
    syncState: snapshot,
  };

  window.dispatchEvent(
    new CustomEvent(AI_INBOX_SYNC_STATUS_EVENT, {
      detail,
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
  const [syncState, setSyncState] = useState<AIInboxSyncSnapshot>(initialSyncState);

  const publishSyncState = useCallback((nextState: AIInboxSyncSnapshot): AIInboxSyncSnapshot => {
    setSyncState(nextState);
    emitSyncStatus(nextState);
    return nextState;
  }, []);

  const requestSync = useCallback(async (source: AIInboxSyncSource): Promise<AIInboxSyncSnapshot> => {
    const tenantId = getTenantId();
    if (!user || !tenantId || (syncInFlightRef.current && source !== 'manual')) {
      if (IS_DEV) {
        logger.debug(
          `Sync skipped: user=${!!user} tenant=${!!tenantId} inFlight=${syncInFlightRef.current}`,
          SYNC_LOG_CTX,
        );
      }
      return publishSyncState({
        ...initialSyncState,
        status: 'skipped',
        source,
        message: 'Email sync prerequisites were not met.',
        summary: 'Email sync prerequisites were not met.',
        finishedAt: Date.now(),
      });
    }

    const now = Date.now();
    if (source !== 'manual') {
      const coalesceKey = getCoalesceKey(tenantId);
      const previousClaim = parseSyncClaim(window.localStorage.getItem(coalesceKey));
      if (previousClaim && now - previousClaim.requestedAt < AI_INBOX_AUTO_SYNC_COALESCE_MS) {
        if (IS_DEV) logger.debug('Sync coalesced (too recent)', SYNC_LOG_CTX);
        return publishSyncState({
          ...initialSyncState,
          status: 'skipped',
          source,
          message: 'Email sync was skipped because another request just ran.',
          summary: 'Email sync was skipped because another request just ran.',
          finishedAt: now,
        });
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
        return publishSyncState({
          ...initialSyncState,
          status: 'skipped',
          source,
          message: 'Another tab already owns this sync request.',
          summary: 'Another tab already owns this sync request.',
          finishedAt: Date.now(),
        });
      }
    }

    syncInFlightRef.current = true;
    const runningState = publishSyncState({
      ...initialSyncState,
      status: 'running',
      source,
      startedAt: now,
      message: 'Email sync queued. Checking Outlook shortly…',
      summary: 'Email sync queued. Checking Outlook shortly…',
      progress: {
        phase: 'queued',
        percent: 5,
        summary: 'Email sync queued. Checking Outlook shortly…',
      },
    });

    if (IS_DEV) logger.info(`Email sync triggered (source=${source})`, SYNC_LOG_CTX);

    try {
      const triggerResult = await aiInboxSyncApi.trigger({ source });
      const triggerAction = normalizeAction(triggerResult.action);
      const triggerFailure = normalizeFailure(triggerResult.failure);
      const triggerProgress = normalizeProgress(triggerResult.progress) ?? runningState.progress ?? null;

      if (!triggerResult.accepted) {
        return publishSyncState({
          ...initialSyncState,
          status: triggerFailure || triggerAction ? 'failed' : 'skipped',
          source,
          startedAt: now,
          finishedAt: Date.now(),
          message: triggerResult.message || triggerFailure?.message || 'Email sync was not accepted.',
          summary: triggerResult.message || triggerFailure?.message || 'Email sync was not accepted.',
          retryable: Boolean(triggerFailure?.retryable),
          action: triggerAction,
          failure: triggerFailure,
          progress: triggerProgress,
        });
      }

      const taskId = typeof triggerResult.task_id === 'string' ? triggerResult.task_id : null;
      if (!taskId) {
        emitAIInboxRefreshEvent(source);
        return publishSyncState({
          ...initialSyncState,
          status: 'succeeded',
          source,
          startedAt: now,
          finishedAt: Date.now(),
          message: triggerResult.message || 'Email sync completed.',
          summary: triggerResult.message || 'Email sync completed.',
          progress: triggerProgress ?? {
            phase: 'completed',
            percent: 100,
            summary: triggerResult.message || 'Email sync completed.',
          },
        });
      }

      const deadline = Date.now() + SYNC_DEADLINE_MS;
      let lastProgress = triggerProgress;

      while (Date.now() < deadline) {
        await delay(AI_INBOX_AUTO_SYNC_STATUS_POLL_MS);
        const status = await aiInboxSyncApi.getStatus(taskId);
        const nextProgress = normalizeProgress(status.progress) ?? lastProgress;

        if (nextProgress) {
          lastProgress = nextProgress;
          setSyncState((current) => ({
            ...current,
            status: 'running',
            source,
            taskId,
            startedAt: now,
            message: nextProgress.summary,
            summary: nextProgress.summary,
            progress: nextProgress,
          }));
        }

        if (!status.ready) {
          continue;
        }

        const terminalResult = status.result ?? null;
        const terminalFailure = normalizeFailure(terminalResult?.failure);
        const terminalAction = normalizeAction(terminalResult?.action);
        const terminalProgress = normalizeProgress(terminalResult?.progress) ?? lastProgress;
        const terminalSummary =
          terminalResult?.summary ||
          terminalProgress?.summary ||
          (status.successful ? 'Email sync completed.' : 'Email sync failed.');

        if (status.failed || terminalResult?.success === false) {
          return publishSyncState({
            ...initialSyncState,
            status: 'failed',
            source,
            taskId,
            startedAt: now,
            finishedAt: Date.now(),
            message: terminalSummary,
            summary: terminalSummary,
            retryable: Boolean(terminalFailure?.retryable),
            action: terminalAction,
            failure: terminalFailure,
            progress: terminalProgress,
            result: terminalResult,
          });
        }

        emitAIInboxRefreshEvent(source);
        if (IS_DEV) logger.info('Email sync completed', SYNC_LOG_CTX);
        return publishSyncState({
          ...initialSyncState,
          status: 'succeeded',
          source,
          taskId,
          startedAt: now,
          finishedAt: Date.now(),
          message: terminalSummary,
          summary: terminalSummary,
          progress: terminalProgress,
          result: terminalResult,
        });
      }

      return publishSyncState({
        ...initialSyncState,
        status: 'failed',
        source,
        taskId,
        startedAt: now,
        finishedAt: Date.now(),
        message: DEFAULT_TIMEOUT_MESSAGE,
        summary: DEFAULT_TIMEOUT_MESSAGE,
        retryable: true,
        action: {
          type: 'retry_sync',
          label: 'Retry Sync',
        },
        progress: lastProgress,
      });
    } catch (_error) {
      logger.warn('AI inbox auto-sync request failed', SYNC_LOG_CTX);
      return publishSyncState({
        ...initialSyncState,
        status: 'failed',
        source,
        startedAt: now,
        finishedAt: Date.now(),
        message: 'Email integration is not configured. Connect your email in Settings to enable sync.',
        summary: 'Email integration is not configured. Connect your email in Settings to enable sync.',
        retryable: true,
        action: {
          type: 'retry_sync',
          label: 'Retry Sync',
        },
      });
    } finally {
      syncInFlightRef.current = false;
    }
  }, [publishSyncState, user]);

  const retryLastSync = useCallback(async (): Promise<AIInboxSyncSnapshot> => {
    return requestSync('manual');
  }, [requestSync]);

  useEffect(() => {
    if (loading || !user) {
      lastLoginSyncRef.current = null;
      setSyncState(initialSyncState);
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

  const value = useMemo<AIInboxSyncContextValue>(() => ({
    syncState,
    requestSync,
    retryLastSync,
  }), [requestSync, retryLastSync, syncState]);

  return (
    <AIInboxSyncContext.Provider value={value}>
      {children}
    </AIInboxSyncContext.Provider>
  );
};

export const useAIInboxSync = (): AIInboxSyncContextValue => {
  const context = useContext(AIInboxSyncContext);
  if (!context) {
    throw new Error('useAIInboxSync must be used within an AIInboxSyncProvider');
  }
  return context;
};

export default AIInboxSyncProvider;
