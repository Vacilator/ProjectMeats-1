/**
 * ActionItemsContext
 * 
 * Provides action item counts throughout the application.
 * Used by NavigationMenu to display badges and by Forms & Flows pages.
 * 
 * Features:
 * - Circuit breaker pattern for resilient error handling
 * - Auto-stops polling on consecutive 500 errors or 401
 * - Graceful degradation with safe defaults
 * 
 * Created: 2026-02-03 - Phase 2 Forms & Flows Enhancement
 * Updated: 2026-03-03 - Added circuit breaker pattern
 */
import React, { createContext, useContext, ReactNode, useCallback, useRef, useEffect } from 'react';
import { useActionItemCounts, ActionItemCounts, POLL_INTERVAL_BACKGROUND } from '../hooks/useActionItemCounts';
import { useAuth } from './AuthContext';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ActionItemsContextValue {
  counts: ActionItemCounts;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isCircuitBreakerOpen: boolean; // Exposed for debugging/monitoring
}

// Circuit breaker states
type CircuitState = 'closed' | 'open' | 'half-open';

// ============================================================================
// Context
// ============================================================================

const ActionItemsContext = createContext<ActionItemsContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface ActionItemsProviderProps {
  children: ReactNode;
  pollingInterval?: number;
}

export const ActionItemsProvider: React.FC<ActionItemsProviderProps> = ({ 
  children,
  pollingInterval = POLL_INTERVAL_BACKGROUND 
}) => {
  const { user, loading: authLoading } = useAuth();
  
  // Circuit breaker state
  const circuitState = useRef<CircuitState>('closed');
  const consecutiveErrorCount = useRef(0);
  const circuitOpenUntil = useRef<number>(0);
  const lastErrorStatus = useRef<number | null>(null);
  
  // Circuit breaker configuration
  const MAX_CONSECUTIVE_ERRORS = 5;
  const CIRCUIT_OPEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  
  // Check if circuit breaker should open
  const checkCircuitBreaker = useCallback((errorStatus?: number) => {
    const now = Date.now();
    
    // If circuit is open, check if timeout expired
    if (circuitState.current === 'open') {
      if (now >= circuitOpenUntil.current) {
        circuitState.current = 'half-open';
        consecutiveErrorCount.current = 0;
        logger.info('[ActionItems] Circuit breaker transitioning to half-open. Retrying...');
        return false; // Allow retry
      }
      return true; // Still open, block requests
    }
    
    // Handle errors
    if (errorStatus) {
      lastErrorStatus.current = errorStatus;
      
      // Immediate circuit open on auth failure
      if (errorStatus === 401) {
        circuitState.current = 'open';
        circuitOpenUntil.current = now + CIRCUIT_OPEN_DURATION_MS;
        logger.error('[ActionItems] Circuit breaker OPEN: Authentication failed. Stopping all polling for 5 minutes.');
        return true;
      }
      
      // Count consecutive 500 errors
      if (errorStatus >= 500) {
        consecutiveErrorCount.current += 1;
        
        if (consecutiveErrorCount.current >= MAX_CONSECUTIVE_ERRORS) {
          circuitState.current = 'open';
          circuitOpenUntil.current = now + CIRCUIT_OPEN_DURATION_MS;
          logger.error(
            `[ActionItems] Circuit breaker OPEN: ${consecutiveErrorCount.current} consecutive 5xx errors. ` +
            `Stopping all polling for 5 minutes.`
          );
          return true;
        } else {
          logger.warn(
            `[ActionItems] Server error (${consecutiveErrorCount.current}/${MAX_CONSECUTIVE_ERRORS}). ` +
            `Will open circuit breaker if this continues.`
          );
        }
      }
    } else {
      // Success - reset error count
      if (consecutiveErrorCount.current > 0) {
        logger.info('[ActionItems] Backend recovered. Resetting circuit breaker.');
      }
      consecutiveErrorCount.current = 0;
      circuitState.current = 'closed';
    }
    
    return false;
  }, []);
  
  // Reset circuit breaker when user logs out
  useEffect(() => {
    if (!user) {
      circuitState.current = 'closed';
      consecutiveErrorCount.current = 0;
      circuitOpenUntil.current = 0;
    }
  }, [user]);
  
  // Only enable polling if user is authenticated AND circuit is not open
  const isCircuitOpen = circuitState.current === 'open';
  const enabled = !!user && !authLoading && !isCircuitOpen;
  
  const { counts, loading, error, refetch } = useActionItemCounts(pollingInterval, enabled);
  
  // Monitor errors and update circuit breaker
  useEffect(() => {
    if (error) {
      // Try to extract status from error message or assume 500
      const statusMatch = error.match(/status[:\s]+(\d+)/i);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
      checkCircuitBreaker(status);
    } else if (!loading && counts) {
      // Success
      checkCircuitBreaker();
    }
  }, [error, loading, counts, checkCircuitBreaker]);

  return (
    <ActionItemsContext.Provider value={{ 
      counts, 
      loading, 
      error, 
      refetch,
      isCircuitBreakerOpen: isCircuitOpen
    }}>
      {children}
    </ActionItemsContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useActionItems(): ActionItemsContextValue {
  const context = useContext(ActionItemsContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      counts: {
        total: 0,
        overdue: 0,
        due_today: 0,
        due_this_week: 0,
        by_priority: {},
        by_form: [],
      },
      loading: false,
      error: null,
      refetch: () => {},
      isCircuitBreakerOpen: false,
    };
  }
  return context;
}

// ============================================================================
// Badge Value Selector
// ============================================================================

/**
 * Gets the badge value for a given badge key from counts
 */
export function getBadgeValue(
  counts: ActionItemCounts | undefined,
  badgeKey: 'actionRequired' | 'waiting' | 'overdue' | 'total' | undefined
): number | undefined {
  if (!counts || !badgeKey) return undefined;
  
  switch (badgeKey) {
    case 'actionRequired':
    case 'total':
      return counts.total > 0 ? counts.total : undefined;
    case 'overdue':
      return counts.overdue > 0 ? counts.overdue : undefined;
    case 'waiting':
      return counts.due_today > 0 ? counts.due_today : undefined;
    default:
      return undefined;
  }
}

export default ActionItemsContext;
