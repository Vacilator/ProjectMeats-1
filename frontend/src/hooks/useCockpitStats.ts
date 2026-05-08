/**
 * Custom hook for fetching Cockpit dashboard statistics
 *
 * Fetches aggregated stats from the backend API for all dashboard widgets:
 * - Quick stats (orders, revenue, customers, suppliers)
 * - Today's numbers (KPIs)
 * - Recent activity feed
 * - Upcoming scheduled calls
 *
 * Features:
 * - Auto-refresh every 5 minutes
 * - Loading and error states
 * - Type-safe response
 *
 * Created: 2026-02-04 - Phase 1.3 Widget Real Data
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiService';
import { withTenantQueryKey } from '../utils/queryKeys';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface QuickStats {
  total_orders: number;
  total_revenue: number;
  total_customers: number;
  total_suppliers: number;
}

export interface TodaysNumbers {
  orders_today: number;
  pending_orders: number;
  completed_today: number;
  active_customers: number;
}

export interface ActivityItem {
  id: number;
  entity_type: string;
  entity_id: number;
  title: string;
  content: string;
  created_by: string;
  created_on: string;
  is_pinned: boolean;
  tags: string;
}

export interface UpcomingCall {
  id: number;
  entity_type: string;
  entity_id: number;
  title: string;
  description: string;
  scheduled_for: string;
  duration_minutes: number;
  assigned_to: string;
}

export interface CockpitStats {
  quick_stats: QuickStats;
  todays_numbers: TodaysNumbers;
  recent_activity: ActivityItem[];
  upcoming_calls: UpcomingCall[];
}

interface UseCockpitStatsReturn {
  stats: CockpitStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Hook
// ============================================================================

export const useCockpitStats = (): UseCockpitStatsReturn => {
  const query = useQuery({
    queryKey: withTenantQueryKey('cockpit', 'stats'),
    queryFn: async () => {
      const response = await apiClient.get<CockpitStats>('cockpit/stats/');
      return response.data;
    },
    // Circuit breaker: avoid retry-spam and focus refetch loops during backend outages.
    retry: (failureCount, err: any) => {
      const status = err?.response?.status;
      if (typeof status === 'number' && status >= 500) return false;
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const status = (query.state.error as any)?.response?.status;
      if (typeof status === 'number' && status >= 500) return false;
      return REFETCH_INTERVAL;
    },
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export default useCockpitStats;
