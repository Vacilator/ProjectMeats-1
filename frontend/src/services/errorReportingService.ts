/**
 * Error Reporting Service
 *
 * Sends structured runtime error reports to the backend for persistence
 * and diagnostics. Non-blocking, fire-and-forget with deduplication,
 * debouncing, and circuit breaker to avoid flooding.
 *
 * IMPORTANT: This module uses a standalone axios instance to avoid a
 * circular dependency: apiService → logger → errorReportingService → businessApi → apiService.
 * Do NOT import from businessApi, apiService, or logger here.
 */

import axios from 'axios';

// Standalone axios instance — no interceptors, no auth required.
// The error-reports/report/ endpoint uses AllowAny permission.
function getReportingClient() {
  const baseURL =
    (typeof window !== 'undefined' && window.ENV?.API_BASE_URL) ||
    import.meta.env.VITE_API_BASE_URL ||
    '/api/v1';
  return axios.create({ baseURL, timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorReport {
  level: 'error' | 'warn' | 'fatal';
  source: 'frontend' | 'api';
  message: string;
  stack_trace?: string;
  component?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Recent fingerprints to deduplicate locally before hitting the API. */
const recentFingerprints = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000; // 1 minute

/** Circuit breaker: stop sending after repeated failures. */
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const MAX_FAILURES = 5;
const CIRCUIT_COOLDOWN_MS = 300_000; // 5 minutes

/** Queue for batching reports. */
let pendingReports: ErrorReport[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 2_000; // 2 seconds
const MAX_BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fingerprint(report: ErrorReport): string {
  const raw = `${report.source}:${report.message.slice(0, 200)}:${report.component ?? ''}`;
  // Simple hash — we don't need crypto-grade, just dedup
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function pruneOldFingerprints(): void {
  const now = Date.now();
  for (const [fp, ts] of recentFingerprints) {
    if (now - ts > DEDUP_WINDOW_MS) {
      recentFingerprints.delete(fp);
    }
  }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function enqueue(report: ErrorReport): void {
  // Circuit breaker check
  if (Date.now() < circuitOpenUntil) return;

  // Local deduplication
  pruneOldFingerprints();
  const fp = fingerprint(report);
  if (recentFingerprints.has(fp)) return;
  recentFingerprints.set(fp, Date.now());

  // Add current URL if not provided
  if (!report.url && typeof window !== 'undefined') {
    report.url = window.location.href;
  }

  pendingReports.push(report);

  // Flush immediately if batch is full
  if (pendingReports.length >= MAX_BATCH_SIZE) {
    flush();
    return;
  }

  // Schedule a delayed flush
  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
  }
}

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (pendingReports.length === 0) return;

  const batch = pendingReports.splice(0, MAX_BATCH_SIZE);

  for (const report of batch) {
    try {
      await getReportingClient().post('/error-reports/report/', report);
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_FAILURES) {
        circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        // Don't log via logger.error to avoid infinite recursion
        if (typeof console !== 'undefined') {
          console.warn(
            '[ErrorReporting] Circuit breaker open — pausing error reporting for 5 minutes'
          );
        }
        return;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Report an error to the backend for persistence and diagnostics.
 * Non-blocking — errors in reporting are silently swallowed.
 */
export function reportError(
  message: string,
  options: {
    level?: ErrorReport['level'];
    source?: ErrorReport['source'];
    stack?: string;
    component?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  } = {}
): void {
  enqueue({
    level: options.level ?? 'error',
    source: options.source ?? 'frontend',
    message: message.slice(0, 2000),
    stack_trace: options.stack?.slice(0, 8000),
    component: options.component?.slice(0, 255),
    url: options.url,
    metadata: options.metadata,
  });
}

/**
 * Report an Error object with automatic stack extraction.
 */
export function reportErrorObject(
  error: Error | unknown,
  options: {
    level?: ErrorReport['level'];
    source?: ErrorReport['source'];
    component?: string;
    metadata?: Record<string, unknown>;
  } = {}
): void {
  if (error instanceof Error) {
    reportError(error.message, {
      ...options,
      stack: error.stack,
    });
  } else {
    reportError(String(error), options);
  }
}

/**
 * Report an API error with structured context.
 */
export function reportApiError(
  url: string,
  method: string,
  statusCode: number,
  message: string,
  responseData?: unknown
): void {
  reportError(message, {
    source: 'api',
    level: statusCode >= 500 ? 'error' : 'warn',
    component: 'API',
    metadata: {
      api_url: url,
      method,
      status: statusCode,
      response_preview:
        typeof responseData === 'string'
          ? responseData.slice(0, 500)
          : JSON.stringify(responseData ?? '').slice(0, 500),
    },
  });
}

/**
 * Flush any pending reports immediately (e.g., before page unload).
 */
export function flushErrorReports(): void {
  flush();
}

/** Reset circuit breaker — useful after deployments. */
export function resetErrorReportingCircuit(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flush();
  });
}

export const errorReportingService = {
  reportError,
  reportErrorObject,
  reportApiError,
  flushErrorReports,
  resetErrorReportingCircuit,
};
