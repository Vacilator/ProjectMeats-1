/**
 * useImplicitFeedback — Global invisible feedback collection hook.
 *
 * Mount once in App.tsx. Collects implicit signals from user interactions,
 * batches them in memory, and flushes to the backend every 30 seconds.
 *
 * ZERO UI — completely invisible to the user.
 * Fire-and-forget — never blocks the UI.
 */

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { feedbackEventsApi, type FeedbackEventItem } from '../services/aiService';
import { logger } from '@/utils/logger';

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_BATCH_SIZE = 100;

type SourceSurface =
  | 'form'
  | 'inbox'
  | 'approval_queue'
  | 'chat'
  | 'suggestion_chip'
  | 'search'
  | 'entity_page'
  | 'workflow'
  | 'notification';

export interface ImplicitFeedbackEvent {
  eventType: string;
  sourceSurface: SourceSurface;
  entityType?: string;
  entityId?: string;
  fieldName?: string;
  aiValue?: unknown;
  userValue?: unknown;
  confidenceScore?: number;
  resolutionTimeMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Global implicit feedback collector.
 * Call `trackEvent()` from anywhere to record a signal.
 * Events are batched and flushed automatically.
 */
export function useImplicitFeedback() {
  const bufferRef = useRef<FeedbackEventItem[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return;

    const batch = bufferRef.current.splice(0, MAX_BATCH_SIZE);
    try {
      await feedbackEventsApi.batchSubmit(batch);
    } catch (err) {
      // Fire-and-forget — silently drop on failure
      logger.debug('Implicit feedback batch submit failed', { err });
      // Re-add to buffer for next flush attempt (max 1 retry)
      if (bufferRef.current.length < MAX_BATCH_SIZE * 2) {
        bufferRef.current.unshift(...batch);
      }
    }
  }, []);

  const trackEvent = useCallback((event: ImplicitFeedbackEvent) => {
    const item: FeedbackEventItem = {
      event_type: event.eventType,
      source_surface: event.sourceSurface,
      entity_type: event.entityType || '',
      entity_id: event.entityId || '',
      field_name: event.fieldName || '',
      ai_value: event.aiValue,
      user_value: event.userValue,
      confidence_score: event.confidenceScore,
      resolution_time_ms: event.resolutionTimeMs,
      timestamp: new Date().toISOString(),
      metadata: event.metadata || {},
    };

    bufferRef.current.push(item);

    // Auto-flush if buffer is full
    if (bufferRef.current.length >= MAX_BATCH_SIZE) {
      void flush();
    }
  }, [flush]);

  // Set up periodic flush
  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    // Flush on page unload
    const handleBeforeUnload = () => {
      if (bufferRef.current.length > 0) {
        // Use sendBeacon for reliability on page close
        const payload = JSON.stringify({ events: bufferRef.current });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/ai-assistant/feedback-events/', blob);
        bufferRef.current = [];
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Final flush on unmount
      void flush();
    };
  }, [flush]);

  return { trackEvent };
}

// Singleton context for global access

export interface ImplicitFeedbackContextValue {
  trackEvent: (event: ImplicitFeedbackEvent) => void;
}

export const ImplicitFeedbackContext = createContext<ImplicitFeedbackContextValue>({
  trackEvent: () => {}, // No-op default
});

export const useImplicitFeedbackContext = () => useContext(ImplicitFeedbackContext);
