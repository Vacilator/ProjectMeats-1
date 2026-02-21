/**
 * useTimeout Hook
 * 
 * Hook to detect when an async operation has exceeded a timeout threshold.
 * Useful for showing timeout messages or retry buttons.
 * 
 * Created: 2026-02-21 - Loading States Enhancement
 * 
 * @module useTimeout
 */

import { useState, useEffect } from 'react';

export interface UseTimeoutOptions {
  /** Timeout duration in milliseconds (default: 5000) */
  timeout?: number;
  /** Whether the operation is currently loading */
  isLoading: boolean;
  /** Optional callback when timeout is reached */
  onTimeout?: () => void;
}

export interface UseTimeoutReturn {
  /** Whether the timeout has been exceeded */
  isTimedOut: boolean;
  /** Reset the timeout timer */
  resetTimeout: () => void;
  /** Time elapsed in milliseconds */
  timeElapsed: number;
}

/**
 * Hook to detect when an async operation times out
 * 
 * @example
 * ```tsx
 * const { data, isLoading } = useQuery(...);
 * const { isTimedOut, resetTimeout } = useTimeout({
 *   isLoading,
 *   timeout: 5000,
 *   onTimeout: () => console.log('Request timed out!')
 * });
 * 
 * if (isTimedOut) {
 *   return <TimeoutMessage onRetry={resetTimeout} />;
 * }
 * ```
 */
export function useTimeout(options: UseTimeoutOptions): UseTimeoutReturn {
  const { timeout = 5000, isLoading, onTimeout } = options;
  
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Reset timeout when loading starts
  useEffect(() => {
    if (isLoading) {
      setIsTimedOut(false);
      setTimeElapsed(0);
      setStartTime(Date.now());
    } else {
      setStartTime(null);
    }
  }, [isLoading]);

  // Track elapsed time and check for timeout
  useEffect(() => {
    if (!isLoading || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeElapsed(elapsed);

      if (elapsed >= timeout && !isTimedOut) {
        setIsTimedOut(true);
        if (onTimeout) {
          onTimeout();
        }
      }
    }, 100); // Check every 100ms

    return () => clearInterval(interval);
  }, [isLoading, startTime, timeout, isTimedOut, onTimeout]);

  const resetTimeout = () => {
    setIsTimedOut(false);
    setTimeElapsed(0);
    setStartTime(Date.now());
  };

  return {
    isTimedOut,
    resetTimeout,
    timeElapsed,
  };
}
