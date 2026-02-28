/**
 * Advanced Performance Monitoring Hooks
 * 
 * Production-ready performance monitoring utilities:
 * - Bundle size tracking
 * - Long task detection
 * - Memory leak detection
 * - Network request monitoring
 */

import { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
}

interface NetworkMetrics {
  requestCount: number;
  totalTransferSize: number;
  avgLatency: number;
  failedRequests: number;
}

/**
 * Monitor component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);

  useEffect(() => {
    renderCountRef.current += 1;
    const renderTime = performance.now();
    renderTimesRef.current.push(renderTime);

    // Keep only last 10 render times
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current.shift();
    }

    // Log if render count is excessive
    if (renderCountRef.current > 50) {
      logger.warn(
        `Excessive renders detected`,
        {
          component: componentName,
          metadata: {
            renderCount: renderCountRef.current,
            avgRenderInterval: calculateAvgInterval(renderTimesRef.current)
          }
        }
      );
    }
  });

  return {
    renderCount: renderCountRef.current,
    avgRenderInterval: calculateAvgInterval(renderTimesRef.current)
  };
}

/**
 * Detect long tasks (blocking main thread > 50ms)
 */
export function useLongTaskDetection(threshold = 50) {
  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > threshold) {
          logger.warn(
            `Long task detected`,
            {
              metadata: {
                duration: entry.duration.toFixed(2),
                name: entry.name,
                startTime: entry.startTime.toFixed(2)
              }
            }
          );
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // longtask not supported in this browser
    }

    return () => observer.disconnect();
  }, [threshold]);
}

/**
 * Monitor memory usage and detect potential leaks
 */
export function useMemoryMonitoring(intervalMs = 30000) {
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const previousUsageRef = useRef<number>(0);
  const increasingCountRef = useRef(0);

  useEffect(() => {
    if (!('memory' in performance)) {
      logger.debug('Memory API not available');
      return;
    }

    const checkMemory = () => {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      
      setMemoryUsage(usedMB);

      // Detect potential memory leak (continuously increasing)
      if (usedMB > previousUsageRef.current) {
        increasingCountRef.current += 1;
        
        if (increasingCountRef.current > 5) {
          logger.warn(
            `Potential memory leak detected`,
            {
              metadata: {
                currentUsage: usedMB.toFixed(2),
                limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
                increasingCount: increasingCountRef.current
              }
            }
          );
        }
      } else {
        increasingCountRef.current = 0;
      }

      previousUsageRef.current = usedMB;
    };

    const interval = setInterval(checkMemory, intervalMs);
    checkMemory(); // Initial check

    return () => clearInterval(interval);
  }, [intervalMs]);

  return memoryUsage;
}

/**
 * Monitor network requests
 */
export function useNetworkMonitoring() {
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    requestCount: 0,
    totalTransferSize: 0,
    avgLatency: 0,
    failedRequests: 0
  });

  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceResourceTiming[];
      
      const newMetrics = entries.reduce(
        (acc, entry) => {
          acc.requestCount += 1;
          acc.totalTransferSize += entry.transferSize || 0;
          acc.avgLatency += entry.duration;
          
          // Check for failed requests (heuristic)
          if (entry.duration > 5000 || entry.transferSize === 0) {
            acc.failedRequests += 1;
          }
          
          return acc;
        },
        { ...metrics }
      );

      newMetrics.avgLatency = newMetrics.avgLatency / newMetrics.requestCount;
      
      setMetrics(newMetrics);

      // Log slow requests
      entries.forEach(entry => {
        if (entry.duration > 3000) {
          logger.warn(
            `Slow network request`,
            {
              metadata: {
                url: entry.name,
                duration: entry.duration.toFixed(2),
                size: entry.transferSize
              }
            }
          );
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => observer.disconnect();
  }, []);

  return metrics;
}

/**
 * Track largest contentful paint (LCP)
 */
export function useLCP() {
  const [lcp, setLCP] = useState<number | null>(null);

  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      if (lastEntry) {
        const lcpValue = lastEntry.startTime;
        setLCP(lcpValue);
        
        // Log if LCP is poor (> 2.5s)
        if (lcpValue > 2500) {
          logger.warn(
            `Poor LCP detected`,
            {
              metadata: {
                lcp: lcpValue.toFixed(2),
                element: (lastEntry as any).element
              }
            }
          );
        }
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    return () => observer.disconnect();
  }, []);

  return lcp;
}

/**
 * Track first input delay (FID)
 */
export function useFID() {
  const [fid, setFID] = useState<number | null>(null);

  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstInput = entries[0];
      
      if (firstInput) {
        const fidValue = (firstInput as any).processingStart - firstInput.startTime;
        setFID(fidValue);
        
        // Log if FID is poor (> 100ms)
        if (fidValue > 100) {
          logger.warn(
            `Poor FID detected`,
            {
              metadata: {
                fid: fidValue.toFixed(2),
                eventType: (firstInput as any).name
              }
            }
          );
        }
      }
    });

    observer.observe({ entryTypes: ['first-input'] });

    return () => observer.disconnect();
  }, []);

  return fid;
}

/**
 * Combined performance dashboard hook
 */
export function usePerformanceDashboard() {
  const lcp = useLCP();
  const fid = useFID();
  const memoryUsage = useMemoryMonitoring();
  const networkMetrics = useNetworkMonitoring();

  useLongTaskDetection();

  return {
    lcp,
    fid,
    memoryUsage,
    networkMetrics
  };
}

// Helper functions
function calculateAvgInterval(times: number[]): number {
  if (times.length < 2) return 0;
  
  const intervals = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push(times[i] - times[i - 1]);
  }
  
  return intervals.reduce((a, b) => a + b, 0) / intervals.length;
}
