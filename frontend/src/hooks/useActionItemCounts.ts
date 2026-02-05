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
  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get('/workflows/action-items/counts/');
      if (mountedRef.current) {
        setCounts(response.data);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        // Don't set error for 404 (no action items)
        if (err.response?.status !== 404) {
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
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchCounts();
    
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCounts]);

  // Polling
  useEffect(() => {
    if (!enabled || pollingInterval <= 0) return;
    
    pollingRef.current = setInterval(fetchCounts, pollingInterval);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchCounts, pollingInterval, enabled]);

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
