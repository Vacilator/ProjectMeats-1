export type RetryBackoffStrategy = 'fixed' | 'exponential';

export interface RetryPolicy {
  /** Total attempts including the initial try. */
  maxAttempts: number;
  /** Base delay before retry in milliseconds. */
  backoffMs: number;
  /** Backoff strategy; default is fixed. */
  strategy?: RetryBackoffStrategy;
}

export interface ErrorEdgeContract {
  /** Human label shown on the edge. */
  label?: string;
  /** Optional classifier for grouping errors (e.g. "http_5xx", "timeout"). */
  errorType?: string;
  /** Optional retry policy before routing to the error path. */
  retry?: RetryPolicy;
}
