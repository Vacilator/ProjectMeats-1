/**
 * useServerRecovery — auto-recovers React Query after backend 504 outages.
 *
 * Listens for circuit-breaker 5xx errors. When one fires, starts a background
 * health poll. Once the backend responds 200, invalidates ALL stale queries
 * so the UI refetches automatically instead of staying stuck on "No data".
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/utils/logger';

const HEALTH_URL = '/api/v1/health/';
const POLL_INTERVAL_MS = 8_000;
const MAX_POLLS = 20; // give up after ~160s
const EVENT_NAME = 'pm.apiCircuitBreaker';

/** Emit this from the apiService interceptor when a 5xx is seen. */
export const emitCircuitBreakerEvent = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
};

export function useServerRecovery(): void {
  const queryClient = useQueryClient();
  const pollingRef = useRef(false);

  useEffect(() => {
    const onCircuitBreaker = () => {
      if (pollingRef.current) return; // already polling
      pollingRef.current = true;

      let polls = 0;
      const interval = window.setInterval(async () => {
        polls += 1;
        if (polls > MAX_POLLS) {
          window.clearInterval(interval);
          pollingRef.current = false;
          return;
        }
        try {
          const res = await fetch(HEALTH_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            window.clearInterval(interval);
            pollingRef.current = false;
            logger.info('[ServerRecovery] Backend recovered — refetching all queries');
            void queryClient.invalidateQueries();
          }
        } catch (err) {
          // still down — keep polling
          logger.debug('[ServerRecovery] Backend still unreachable', { err });
        }
      }, POLL_INTERVAL_MS);
    };

    window.addEventListener(EVENT_NAME, onCircuitBreaker);
    return () => window.removeEventListener(EVENT_NAME, onCircuitBreaker);
  }, [queryClient]);
}
