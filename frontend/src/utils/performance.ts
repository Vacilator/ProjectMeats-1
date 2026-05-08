/**
 * Performance utility hooks and helpers
 * Phase 6.5: Frontend Optimization
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { logger } from './logger';

/**
 * Hook to measure component render performance.
 * Logs render time in development mode.
 *
 * Usage:
 * ```tsx
 * const MyComponent = () => {
 *   useRenderPerformance('MyComponent');
 *   return <div>...</div>;
 * };
 * ```
 */
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0);
  const startTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;

    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      // Warn if render takes longer than one frame (16ms @ 60fps)
      logger.warn(
        `${componentName} render #${renderCount.current} took ${renderTime.toFixed(2)}ms`,
        { component: 'Performance' }
      );
    }

    startTime.current = performance.now();
  });
}

/**
 * Debounced callback hook for expensive operations.
 *
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced version of callback
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Hook to detect if component is in viewport (lazy rendering).
 * Useful for deferring expensive component rendering.
 *
 * @param ref - React ref to element to observe
 * @param options - IntersectionObserver options
 * @returns true if element is visible
 */
export function useInView(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isInView, setIsInView] = React.useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isInView;
}

/**
 * Memoization utility for expensive computations.
 * Similar to useMemo but with explicit cache management.
 */
export class MemoCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first key)
      const firstKey = this.cache.keys().next().value as K | undefined;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
