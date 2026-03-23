/**
 * useActionItemCounts Hook
 * 
 * Fetches action item counts from the API for sidebar badges.
 * Implements Phase 2 of the Forms & Flows Enhancement Plan.
 * 
 * Created: 2026-02-03
 * 
 * Features:
 * - Fetches counts from /api/v1/workflows/action-items/counts/
 * - Polling at configurable interval
 * - Caching to reduce API calls
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiService';

// ============================================================================
// Types
// ============================================================================

export interface ActionItemCounts {
  total: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  by_priority: Record<string, number>;
  by_form: Array<{ form_name: string; count: number }>;
}

export interface UseActionItemCountsResult {
  counts: ActionItemCounts;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_COUNTS: ActionItemCounts = {
  total: 0,
  overdue: 0,
  due_today: 0,
  due_this_week: 0,
  by_priority: {},
  by_form: [],
};

// Polling intervals
const POLL_INTERVAL_ACTIVE = 30000;   // 30 seconds when on Forms & Flows pages
const POLL_INTERVAL_BACKGROUND = 60000; // 60 seconds otherwise

// ============================================================================
// Hook
// ============================================================================

export function useActionItemCounts(
  pollingInterval: number = POLL_INTERVAL_BACKGROUND,
  enabled: boolean = true
): UseActionItemCountsResult {
  const [counts, setCounts] = useState<ActionItemCounts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthFailure, setIsAuthFailure] = useState(false);
  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0); // Track consecutive errors for backoff

  const fetchCounts = useCallback(async () => {
    if (!enabled || !mountedRef.current || isAuthFailure) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get('/workflows/action-items/counts/');
      if (mountedRef.current) {
        setCounts(response.data);
        setError(null);
        errorCountRef.current = 0; // Reset backoff on success
      }
    } catch (err: any) {
      if (mountedRef.current) {
        const status = err.response?.status;
        errorCountRef.current += 1;
        
        // Handle authentication failure - stop all polling immediately
        if (status === 401) {
          console.error('[ActionItemCounts] Authentication failed. Stopping background polling.');
          setIsAuthFailure(true);
          setError('Authentication required');
          setCounts(DEFAULT_COUNTS);
          return;
        }
        
        // Silent errors for 404 (no action items), 502 (backend issue), 503 (service unavailable)
        // These are expected during initial setup or backend maintenance
        if (status === 404 || status === 502 || status === 503) {
          // Don't spam console or show user errors for these
          setError(null);
        } else {
          // Only log unexpected errors
          console.warn('[ActionItemCounts] Fetch error:', err.message, 'Status:', status);
          setError(err.message || 'Failed to fetch action item counts');
        }
        
        // Reset to defaults on error
        setCounts(DEFAULT_COUNTS);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, isAuthFailure]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    if (!isAuthFailure) {
      fetchCounts();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCounts, isAuthFailure]);

  // Polling with exponential backoff on errors
  useEffect(() => {
    if (!enabled || pollingInterval <= 0 || isAuthFailure) return;
    
    // Calculate backoff: double interval for each consecutive error (max 5 minutes)
    const backoffMultiplier = Math.min(Math.pow(2, errorCountRef.current), 10);
    const actualInterval = pollingInterval * backoffMultiplier;
    
    pollingRef.current = setInterval(fetchCounts, actualInterval);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchCounts, pollingInterval, enabled, isAuthFailure]);

  return {
    counts,
    loading,
    error,
    refetch: fetchCounts,
  };
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { POLL_INTERVAL_ACTIVE, POLL_INTERVAL_BACKGROUND };
export default useActionItemCounts;
