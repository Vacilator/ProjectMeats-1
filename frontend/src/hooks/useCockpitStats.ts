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
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiService';

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
  const [stats, setStats] = useState<CockpitStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.get<CockpitStats>('cockpit/stats/');
      setStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch cockpit stats:', err);
      setError(err.response?.data?.error || 'Failed to fetch dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, REFETCH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
};

export default useCockpitStats;
