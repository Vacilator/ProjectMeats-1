/**
 * Shared API retry utility with exponential backoff + jitter.
 *
 * Used by AI services where transient failures (rate limits, timeouts)
 * are common and retrying is safe.
 */

export interface RetryOptions {
  /** Max number of retries (default: 2) */
  maxRetries?: number;
  /** Base delay in ms (default: 1000) */
  baseDelayMs?: number;
  /** Max delay cap in ms (default: 10000) */
  maxDelayMs?: number;
  /** HTTP status codes that should be retried (default: 429, 502, 503, 504) */
  retryableStatuses?: number[];
  /** Called before each retry with attempt number */
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [429, 502, 503, 504];

function getHttpStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
    if (e.response && typeof e.response === 'object') {
      const resp = e.response as Record<string, unknown>;
      if (typeof resp.status === 'number') return resp.status;
    }
  }
  return null;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED') return true;
  }
  return false;
}

function isRetryable(error: unknown, retryableStatuses: number[]): boolean {
  if (isNetworkError(error)) return true;
  const status = getHttpStatus(error);
  return status !== null && retryableStatuses.includes(status);
}

function delayWithJitter(baseMs: number, attempt: number, maxMs: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs * 0.5;
  return Math.min(exponential + jitter, maxMs);
}

/**
 * Execute an async function with exponential backoff retry.
 *
 * Only retries on transient/retryable errors (network, 429, 5xx).
 * Non-retryable errors (400, 401, 403, 404, 422) are thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 1000,
    maxDelayMs = 10_000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryable(error, retryableStatuses)) {
        throw error;
      }

      onRetry?.(attempt + 1, error);

      const delay = delayWithJitter(baseDelayMs, attempt, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Normalize API errors into a consistent shape for UI consumption.
 */
export interface AIError {
  message: string;
  status: number | null;
  retryable: boolean;
  code?: string;
}

export function normalizeAIError(error: unknown): AIError {
  const status = getHttpStatus(error);
  const retryable = isRetryable(error, DEFAULT_RETRYABLE_STATUSES);

  let message = 'An unexpected error occurred';
  let code: string | undefined;

  if (error instanceof Error) {
    message = error.message;
  }

  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (e.response && typeof e.response === 'object') {
      const resp = e.response as Record<string, unknown>;
      const data = resp.data as Record<string, unknown> | undefined;
      if (data) {
        if (typeof data.detail === 'string') message = data.detail;
        else if (typeof data.message === 'string') message = data.message;
        else if (typeof data.error === 'string') message = data.error;
      }
    }
    if (typeof e.code === 'string') code = e.code;
  }

  if (isNetworkError(error)) {
    message = 'Network error — please check your connection';
    code = 'NETWORK_ERROR';
  } else if (status === 429) {
    message = 'Rate limited — please try again shortly';
    code = 'RATE_LIMITED';
  } else if (status === 401 || status === 403) {
    message = 'Authentication error — please refresh the page';
    code = 'AUTH_ERROR';
  }

  return { message, status, retryable, code };
}

/**
 * Stable query key builders for TanStack Query.
 *
 * These produce referentially stable arrays (primitive values only)
 * to prevent infinite re-render loops.
 */
export const AI_QUERY_KEYS = {
  pendingReviews: (highlightedId?: string | null) =>
    ['ai', 'pending-reviews', highlightedId ?? ''] as const,

  contextualSuggestions: (entityType: string, entityId: string) =>
    ['ai', 'contextual-suggestions', entityType, entityId] as const,

  tradeProposals: () =>
    ['ai', 'trade-proposals'] as const,

  activeTrades: () =>
    ['trades', 'active'] as const,

  tradeStatus: (sessionId: string) =>
    ['trades', 'status', sessionId] as const,

  dependencies: (inquiryId: string) =>
    ['trades', 'dependencies', inquiryId] as const,

  chatSessions: () =>
    ['ai', 'chat-sessions'] as const,

  chatMessages: (sessionId: string) =>
    ['ai', 'chat-messages', sessionId] as const,

  documents: () =>
    ['ai', 'documents'] as const,

  emailLogs: () =>
    ['ai', 'email-logs'] as const,

  syncStatus: (taskId: string) =>
    ['ai', 'sync-status', taskId] as const,
} as const;
