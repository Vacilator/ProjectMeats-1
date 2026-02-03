/**
 * useActionItemCounts Hook
 * 
 * Fetches and manages action item counts for the current user.
 * Used primarily for displaying badges in the sidebar navigation.
 * 
 * Features:
 * - Automatic polling (60s interval)
 * - Error handling
 * - Loading states
 * - Tenant-aware
 * 
 * @returns Action item counts with loading and error states
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionItemCounts {
  total: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  by_priority: {
    urgent?: number;
    high?: number;
    normal?: number;
  };
  by_form: Array<{
    form_name: string;
    count: number;
  }>;
}

interface UseActionItemCountsReturn {
  counts: ActionItemCounts;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_COUNTS: ActionItemCounts = {
  total: 0,
  overdue: 0,
  due_today: 0,
  due_this_week: 0,
  by_priority: {},
  by_form: [],
};

const POLLING_INTERVAL = 60000; // 60 seconds
const API_ENDPOINT = '/api/v1/workflows/action-items/counts/';

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to fetch and manage action item counts.
 * 
 * @param options.enabled - Whether to enable polling (default: true)
 * @param options.pollingInterval - Polling interval in milliseconds (default: 60000)
 * @returns Counts, loading state, error, and refetch function
 */
export const useActionItemCounts = (options?: {
  enabled?: boolean;
  pollingInterval?: number;
}): UseActionItemCountsReturn => {
  const { enabled = true, pollingInterval = POLLING_INTERVAL } = options || {};
  
  const [counts, setCounts] = useState<ActionItemCounts>(DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  /**
   * Fetch action item counts from the API.
   */
  const fetchCounts = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await axios.get<ActionItemCounts>(API_ENDPOINT);
      setCounts(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching action item counts:', err);
      
      // Set error but don't clear existing counts
      if (axios.isAxiosError(err)) {
        setError(new Error(err.response?.data?.message || err.message));
      } else {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
      
      // Only reset counts if this is the first load
      if (isLoading) {
        setCounts(DEFAULT_COUNTS);
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, isLoading]);
  
  /**
   * Refetch counts on demand.
   */
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchCounts();
  }, [fetchCounts]);
  
  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchCounts();
    }
  }, [enabled, fetchCounts]);
  
  // Polling
  useEffect(() => {
    if (!enabled) {
      return;
    }
    
    const intervalId = setInterval(() => {
      fetchCounts();
    }, pollingInterval);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollingInterval, fetchCounts]);
  
  return {
    counts,
    isLoading,
    error,
    refetch,
  };
};

export default useActionItemCounts;
